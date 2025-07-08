// ✅ server.js
const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const { getFirestore } = require("firebase-admin/firestore");
require("dotenv").config();

const app = express();

// ✅ Secure CORS setup for your Vercel frontend
app.use(cors({
  origin: "https://mkenterprices.vercel.app", // ✅ exact frontend URL
  methods: ["GET", "POST"],
  credentials: true,
}));

app.use(express.json());

// ✅ Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore();
const ADMIN_KEY = "super_secret_123";

// ✅ POST: /sendNotification
app.post("/sendNotification", async (req, res) => {
  console.log("🔔 Incoming request:", req.body);

  const { title, body, key } = req.body;

  if (!title || !body) {
    return res.status(400).json({ success: false, error: "Missing title or body" });
  }

  if (key !== undefined && key !== ADMIN_KEY) {
    return res.status(403).json({ success: false, error: "Unauthorized request" });
  }

  try {
    const snapshot = await db.collection("user").get();

    const tokens = snapshot.docs
      .map((doc) => doc.data().fcmToken)
      .filter((token) => typeof token === "string" && token.trim() !== "");

    if (tokens.length === 0) {
      return res.status(400).json({ success: false, error: "No valid FCM tokens found" });
    }

    // ✅ Send to each token individually
    const results = await Promise.all(
      tokens.map((token) =>
        admin.messaging().send({
          token,
          notification: {
            title,
            body,
          },
          webpush: {
            notification: {
              icon: "https://mkenterprices.vercel.app/images/logo.jpg",
              badge: "https://mkenterprices.vercel.app/images/logo.jpg",
              image: "https://mkenterprices.vercel.app/images/logo.jpg",
            },
          },
        }).then(() => ({ success: true })).catch((err) => {
          console.error(`❌ Failed to send to token ${token}:`, err.message);
          return { success: false, error: err.message };
        })
      )
    );

    const successCount = results.filter(r => r.success).length;

    console.log(`✅ Notifications sent: ${successCount}`);
    res.json({ success: true, sent: successCount });
  } catch (err) {
    console.error("❌ Error sending notification:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ mkenterprises-backend is live and working!");
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
