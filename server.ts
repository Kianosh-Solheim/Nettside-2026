import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// We can read the firebase config to avoid hardcoding
import fsSync from "fs";
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
if (fsSync.existsSync(firebaseConfigPath)) {
  firebaseConfig = JSON.parse(fsSync.readFileSync(firebaseConfigPath, "utf-8"));
}
const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId || "(default)";

async function fetchWritingMeta(slug: string) {
  if (!PROJECT_ID) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: "blog_posts" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "slug" },
          op: "EQUAL",
          value: { stringValue: slug }
        }
      },
      limit: 1
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data[0] && data[0].document) {
      const doc = data[0].document.fields;
      return {
        title: doc.title?.stringValue || "Writings",
        excerpt: doc.excerpt?.stringValue || "",
        imageUrl: doc.imageUrl?.stringValue || ""
      };
    }
  } catch (err) {
    console.error("Error fetching writing meta:", err);
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
  }

  // Server-side YouTube search & oEmbed helper to reliably fetch video thumbnails and metadata without API keys or CORS blocks
  app.get('/api/youtube-search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) {
        return res.json({ items: [] });
      }

      const vimeoMatch = q.match(
        /(?:vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?|player\.vimeo\.com\/video\/)(\d+)(?:\/([a-zA-Z0-9]+))?/i
      );
      if (vimeoMatch?.[1]) {
        const vimeoId = vimeoMatch[1];
        const vimeoHash = vimeoMatch[2] || '';
        const vimeoUrl = vimeoHash
          ? `https://vimeo.com/${vimeoId}/${vimeoHash}`
          : `https://vimeo.com/${vimeoId}`;
        try {
          const oembedRes = await fetch(
            `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(vimeoUrl)}`
          );
          if (oembedRes.ok) {
            const data: any = await oembedRes.json();
            return res.json({
              items: [
                {
                  videoId: vimeoId,
                  title: data.title || '',
                  creator: data.author_name || '',
                  description: data.description || '',
                  link: vimeoUrl,
                  imageUrl: data.thumbnail_url || ''
                }
              ]
            });
          }
        } catch {
          // ignore oembed failure
        }
        return res.json({
          items: [
            {
              videoId: vimeoId,
              title: '',
              creator: '',
              description: '',
              link: vimeoUrl,
              imageUrl: ''
            }
          ]
        });
      }

      const ytIdMatch = q.match(
        /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
      );
      const directId = ytIdMatch?.[1] || (/^[a-zA-Z0-9_-]{11}$/.test(q) ? q : null);

      if (directId) {
        const watchUrl = `https://www.youtube.com/watch?v=${directId}`;
        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`
          );
          if (oembedRes.ok) {
            const data: any = await oembedRes.json();
            return res.json({
              items: [
                {
                  videoId: directId,
                  title: data.title || '',
                  creator: data.author_name || '',
                  description: '',
                  link: watchUrl,
                  imageUrl: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`
                }
              ]
            });
          }
        } catch {
          // fallback if oembed fails
        }
        return res.json({
          items: [
            {
              videoId: directId,
              title: '',
              creator: '',
              description: '',
              link: watchUrl,
              imageUrl: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`
            }
          ]
        });
      }

      // Search YouTube directly and parse ytInitialData
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9,nb;q=0.8'
        }
      });

      if (!response.ok) {
        return res.json({ items: [] });
      }

      const html = await response.text();
      const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
      if (!match?.[1]) {
        return res.json({ items: [] });
      }

      const initialData = JSON.parse(match[1]);
      const contents =
        initialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
          ?.contents || [];

      const items: Array<{
        videoId: string;
        title: string;
        creator: string;
        description: string;
        link: string;
        imageUrl: string;
      }> = [];

      for (const section of contents) {
        const renderers = section?.itemSectionRenderer?.contents || [];
        for (const entry of renderers) {
          const v = entry?.videoRenderer;
          if (v?.videoId) {
            const vidId = v.videoId;
            const title =
              v.title?.runs?.map((r: any) => r.text).join('') ||
              v.title?.simpleText ||
              '';
            const creator =
              v.ownerText?.runs?.[0]?.text ||
              v.longBylineText?.runs?.[0]?.text ||
              v.shortBylineText?.runs?.[0]?.text ||
              '';
            const desc =
              v.detailedMetadataSnippets?.[0]?.snippetText?.runs
                ?.map((r: any) => r.text)
                .join('') ||
              v.descriptionSnippet?.runs?.map((r: any) => r.text).join('') ||
              '';
            items.push({
              videoId: vidId,
              title,
              creator,
              description: desc,
              link: `https://www.youtube.com/watch?v=${vidId}`,
              imageUrl: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`
            });
            if (items.length >= 6) break;
          }
        }
        if (items.length >= 6) break;
      }

      return res.json({ items });
    } catch (err) {
      console.error('Error in /api/youtube-search:', err);
      return res.json({ items: [] });
    }
  });

  // Intercept writing pages to inject Open Graph meta tags for link previews
  app.get('/writings/:slug', async (req, res, next) => {
    try {
      const slug = req.params.slug;
      
      // If it ends with /print, ignore the interceptor to let standard logic handle it
      if (slug.endsWith('print')) {
        return next();
      }

      const meta = await fetchWritingMeta(slug);
      let template: string;

      if (process.env.NODE_ENV !== "production") {
        template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
      } else {
        template = fs.readFileSync(path.resolve(process.cwd(), "dist", "index.html"), "utf-8");
      }

      if (meta) {
        const ogTags = `
          <title>${meta.title} - Kianosh F. Solheim</title>
          <meta name="description" content="${meta.excerpt}" />
          <meta property="og:title" content="${meta.title}" />
          <meta property="og:description" content="${meta.excerpt}" />
          <meta property="og:type" content="article" />
          ${meta.imageUrl ? `<meta property="og:image" content="${meta.imageUrl}" />` : ''}
          <meta name="twitter:card" content="${meta.imageUrl ? 'summary_large_image' : 'summary'}" />
          <meta name="twitter:title" content="${meta.title}" />
          <meta name="twitter:description" content="${meta.excerpt}" />
          ${meta.imageUrl ? `<meta name="twitter:image" content="${meta.imageUrl}" />` : ''}
        `;
        // Replace </head> with ogTags + </head>
        template = template.replace('</head>', `${ogTags}</head>`);
      }

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e: any) {
      if (process.env.NODE_ENV !== "production") {
        vite.ssrFixStacktrace(e);
      }
      next(e);
    }
  });

  // Default handlers
  if (process.env.NODE_ENV !== "production") {
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false })); // index: false to avoid intercepting root index.html if we want to add more meta later
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
