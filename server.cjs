const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const { getFirestore } = require("firebase-admin/firestore");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Load service account key
const serviceAccount = require("./serviceAccountKey.json");

// ✅ Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ✅ Firestore reference
const db = getFirestore();

// 🔐 ADMIN SECRET KEY
const ADMIN_KEY = "super_secret_123"; // Change this to something stronger

// ✅ Send Notification Endpoint
app.post("/sendNotification", async (req, res) => {
  console.log("🔔 Incoming request:", req.body);

  const { title, body, key } = req.body;

  // ✅ Validate input
  if (!title || !body || !key) {
    return res.status(400).json({ success: false, error: "Missing title, body, or key" });
  }

  // 🔐 Check admin key
  if (key !== ADMIN_KEY) {
    return res.status(403).json({ success: false, error: "Unauthorized request" });
  }

  try {
    // ✅ Fetch all user FCM tokens from Firestore
    const snapshot = await db.collection("user").get();
    const tokens = snapshot.docs
      .map((doc) => doc.data().fcmToken)
      .filter((token) => typeof token === "string" && token.trim() !== "");

    if (tokens.length === 0) {
      return res.status(400).json({ success: false, error: "No valid FCM tokens found" });
    }

    // ✅ Notification message payload
    const message = {
      notification: { title, body },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          icon: "https://mkenterprices.vercel.app/images/logo.jpg",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
      webpush: {
        notification: {
          icon: "https://mkenterprices.vercel.app/images/logo.jpg",
        },
      },
    };

    // ✅ Send notifications to all tokens
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      ...message,
    });

    console.log(`✅ Notifications sent: ${response.successCount}`);
    res.json({ success: true, sent: response.successCount });
  } catch (err) {
    console.error("❌ Error sending notification:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
