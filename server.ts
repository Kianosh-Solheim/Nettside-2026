import express from "express";
import { createServer as createViteServer } from "vite";
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

dotenv.config();

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 
  (process.env.APP_URL ? `${process.env.APP_URL}/api/auth/google/callback` : "http://localhost:3000/api/auth/google/callback")
);

async function startServer() {
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
