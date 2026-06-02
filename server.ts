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
