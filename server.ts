import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { google } from "googleapis";
import cookieSession from "cookie-session";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp as initializeFirebaseApp } from "firebase/app";
import fs from "fs";
import Parser from "rss-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const parser = new Parser();

async function startServer() {
  const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "./firebase-applet-config.json"), "utf-8"));

  const firebaseApp = initializeFirebaseApp(firebaseConfig);

  // Initialize Firebase Admin
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: firebaseConfig.projectId,
      });
    } catch (e) {
      console.error("Firebase Admin initialization failed:", e);
    }
  }

  const db = getFirestore(firebaseConfig.firestoreDatabaseId);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 
    (process.env.APP_URL ? `${process.env.APP_URL}/api/auth/google/callback` : "http://localhost:3000/api/auth/google/callback")
  );

  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'secret-key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none'
  }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/rss", async (req, res) => {
    try {
      const urls = [
        { url: "https://www.nrk.no/nyheter/siste.rss", name: 'NRK' },
        { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: 'BBC World' },
        { url: "https://bsky.app/profile/did:plc:3jxcojdw76kvrvajuwclbg2l/rss", name: 'UiB Sampol' }
      ];

      const feedResults = await Promise.allSettled(urls.map(u => parser.parseURL(u.url)));
      
      const allItems: any[] = [];
      
      feedResults.forEach((result, index) => {
        const sourceName = urls[index].name;
        if (result.status === 'fulfilled') {
          const feed = result.value;
          const items = (feed.items || []).map(item => ({
            ...item,
            source: sourceName,
            title: item.title || item.contentSnippet || item.content || 'Uten tittel',
            logo: sourceName.includes('NRK') ? 'https://www.nrk.no/serum/latest/media/nrk-logo-vit-pa-svart.png' :
                  sourceName.includes('BBC') ? 'https://nav.files.bbci.co.uk/orbit/2.0.0-rc.30/img/blq-orbit-blocks_grey.svg' :
                  'https://bsky.app/static/apple-touch-icon.png'
          }));
          allItems.push(...items);
        } else {
          console.error(`Failed to fetch ${sourceName}:`, result.reason);
        }
      });

      const sortByDate = (a: any, b: any) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();

      const generalNews = allItems.filter(i => i.source === 'NRK' || i.source === 'BBC World').sort(sortByDate);
      const academicUpdates = allItems.filter(i => i.source === 'UiB Sampol').sort(sortByDate);

      res.json({ 
        news: generalNews.slice(0, 20),
        academic: academicUpdates.slice(0, 30)
      });
    } catch (error) {
      console.error("RSS route error:", error);
      res.status(500).json({ error: "Internal server error fetching feeds" });
    }
  });

  // Avinor Flight Proxy
  app.get("/api/flights", async (req, res) => {
    const { airport, direction } = req.query;
    if (!airport) return res.status(400).json({ error: "Missing airport parameter" });

    try {
      // Documentation shows airport and direction are lowercase in the parameter name
      const url = `https://asrv.avinor.no/XmlFeed/v1.0?airport=${airport}&direction=${direction || 'D'}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Avinor API responded with ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || '';
      
      // Avinor API often uses ISO-8859-1 but might not always advertise it correctly
      // or uses UTF-8. ISO-8859-1 is the most common cause for "Kbenhavn"
      let charset = 'utf-8';
      if (contentType.toLowerCase().includes('iso-8859-1')) {
        charset = 'iso-8859-1';
      } else {
        // Look for encoding in the XML prologue if possible
        const head = new TextDecoder('ascii').decode(buffer.slice(0, 500));
        if (head.toLowerCase().includes('encoding="iso-8859-1"')) {
          charset = 'iso-8859-1';
        }
      }
      
      const decoder = new TextDecoder(charset);
      const xml = decoder.decode(buffer);
      
      res.set('Content-Type', 'text/xml; charset=utf-8');
      res.send(xml);
    } catch (error) {
      console.error("Flight proxy error:", error);
      res.status(500).json({ error: "Failed to fetch flight data" });
    }
  });

  // Metadata Caches
  let airportNamesCache = { data: null, timestamp: 0 };
  let airlineNamesCache = { data: null, timestamp: 0 };
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  app.get("/api/flights/airports", async (req, res) => {
    const now = Date.now();
    if (airportNamesCache.data && (now - airportNamesCache.timestamp < CACHE_DURATION)) {
      res.set('Content-Type', 'text/xml');
      return res.send(airportNamesCache.data);
    }

    try {
      const response = await fetch('https://asrv.avinor.no/airportNames/v1.0');
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || '';
      let charset = 'utf-8';
      if (contentType.toLowerCase().includes('iso-8859-1')) {
        charset = 'iso-8859-1';
      } else {
        const head = new TextDecoder('ascii').decode(buffer.slice(0, 500));
        if (head.toLowerCase().includes('encoding="iso-8859-1"')) {
          charset = 'iso-8859-1';
        }
      }
      const decoder = new TextDecoder(charset);
      const xml = decoder.decode(buffer);
      airportNamesCache = { data: xml as any, timestamp: now };
      res.set('Content-Type', 'text/xml; charset=utf-8');
      res.send(xml);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch airport names" });
    }
  });

  app.get("/api/flights/airlines", async (req, res) => {
    const now = Date.now();
    if (airlineNamesCache.data && (now - airlineNamesCache.timestamp < CACHE_DURATION)) {
      res.set('Content-Type', 'text/xml');
      return res.send(airlineNamesCache.data);
    }

    try {
      const response = await fetch('https://asrv.avinor.no/airlineNames/v1.0');
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || '';
      let charset = 'utf-8';
      if (contentType.toLowerCase().includes('iso-8859-1')) {
        charset = 'iso-8859-1';
      } else {
        const head = new TextDecoder('ascii').decode(buffer.slice(0, 500));
        if (head.toLowerCase().includes('encoding="iso-8859-1"')) {
          charset = 'iso-8859-1';
        }
      }
      const decoder = new TextDecoder(charset);
      const xml = decoder.decode(buffer);
      airlineNamesCache = { data: xml as any, timestamp: now };
      res.set('Content-Type', 'text/xml; charset=utf-8');
      res.send(xml);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch airline names" });
    }
  });

  // Google OAuth URL
  app.get("/api/auth/google/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
      prompt: 'consent'
    });
    res.json({ url });
  });

  // Google OAuth Callback
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
      if (!db) {
        throw new Error("Firestore not initialized");
      }
      const { tokens } = await oauth2Client.getToken(code as string);
      
      // Store tokens in Firestore
      await db.collection('config').doc('google_calendar_tokens').set({
        tokens,
        updatedAt: new Date()
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/admin';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // Fetch busy slots
  app.get("/api/calendar/busy", async (req, res) => {
    try {
      const docSnap = await db.collection('config').doc('google_calendar_tokens').get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: "Google Calendar not connected" });
      }
      const { tokens } = docSnap.data()!;
      oauth2Client.setCredentials(tokens);

      // Refresh token if needed
      oauth2Client.on('tokens', async (newTokens) => {
        const configDocRef = db.collection('config').doc('google_calendar_tokens');
        if (newTokens.refresh_token) {
          await configDocRef.update({
            'tokens.refresh_token': newTokens.refresh_token
          });
        }
        await configDocRef.update({
          'tokens.access_token': newTokens.access_token,
          'tokens.expiry_date': newTokens.expiry_date
        });
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30); // Next 30 days

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: 'primary' }]
        }
      });

      const busySlots = response.data.calendars?.primary?.busy || [];
      res.json({ busySlots });
    } catch (error) {
      console.error("Error fetching calendar data:", error);
      res.status(500).json({ error: "Failed to fetch calendar data" });
    }
  });

  // Contact form endpoint
  app.post("/api/contact", async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      // Configure nodemailer with your SMTP settings
      // For now, we'll use a placeholder. In a real app, you'd use environment variables.
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.example.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // If no SMTP configured, we'll just log it and return success for demo purposes
      if (!process.env.SMTP_USER) {
        console.log("No SMTP configured. Logging contact form submission:");
        console.log(`From: ${name} <${email}>`);
        console.log(`Message: ${message}`);
        return res.json({ success: true, message: "Message logged (SMTP not configured)" });
      }

      await transporter.sendMail({
        from: `"${name}" <${process.env.SMTP_USER}>`,
        to: "Kianosh@Solheim.Online",
        subject: `New Contact Form Submission from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        replyTo: email,
      });

      res.json({ success: true, message: "Email sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve from dist
    const distPath = path.resolve(__dirname, "dist");
    
    // Serve static files
    app.use(express.static(distPath));
    
    // Explicitly handle index.html for SPA
    app.get("*", (req, res) => {
      // Use absolute path for reliability
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Build artifacts not found. Please run 'npm run build' first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
