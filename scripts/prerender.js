import fs from 'fs';
import path from 'path';

// read firebase-applet-config.json
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig = {};
if (fs.existsSync(configPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId || "(default)";

async function generatePages() {
  if (!PROJECT_ID) {
    console.log('No Firebase Project ID found. Skipping static page generation.');
    return;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: "blog_posts" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "status" },
          op: "EQUAL",
          value: { stringValue: "published" }
        }
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" }
    });
    
    if (!res.ok) {
      console.error('Failed to fetch blog posts', await res.text());
      return;
    }

    const data = await res.json();
    
    const indexPath = path.resolve(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) {
      console.error('dist/index.html not found, make sure to run this after build');
      return;
    }
    
    const baseHtml = fs.readFileSync(indexPath, 'utf-8');

    // Create writings directory if it doesn't exist
    const writingsDir = path.resolve(process.cwd(), 'dist', 'writings');
    if (!fs.existsSync(writingsDir)) {
      fs.mkdirSync(writingsDir, { recursive: true });
    }

    let generatedCount = 0;

    for (const item of data) {
      if (item.document && item.document.fields) {
        const doc = item.document.fields;
        const slug = doc.slug?.stringValue;
        if (!slug) continue;

        const title = doc.title?.stringValue || "Writings";
        const excerpt = doc.excerpt?.stringValue || "";
        const imageUrl = doc.imageUrl?.stringValue || "";

        const ogTags = `
    <title>${title} - Kianosh F. Solheim</title>
    <meta name="description" content="${excerpt}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${excerpt}" />
    <meta property="og:type" content="article" />
    ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
    <meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${excerpt}" />
    ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}
        `;

        // Replace the default head tags
        let pageHtml = baseHtml
          .replace(/<title>.*?<\/title>/, '')
          .replace(/<meta name="description" content=".*?"\s*\/?>/, '')
          .replace(/<meta property="og:title" content=".*?"\s*\/?>/, '')
          .replace(/<meta property="og:description" content=".*?"\s*\/?>/, '')
          .replace(/<meta property="og:type" content=".*?"\s*\/?>/, '')
          .replace(/<meta name="twitter:card" content=".*?"\s*\/?>/, '');

        pageHtml = pageHtml.replace('</head>', `${ogTags}</head>`);

        const articleDir = path.join(writingsDir, slug);
        if (!fs.existsSync(articleDir)) {
          fs.mkdirSync(articleDir, { recursive: true });
        }

        fs.writeFileSync(path.join(articleDir, 'index.html'), pageHtml);
        generatedCount++;
      }
    }
    
    console.log(`Static site generation complete: generated static HTML meta-tags for ${generatedCount} articles.`);

  } catch (err) {
    console.error('Error in static page generation:', err);
  }
}

generatePages();
