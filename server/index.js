require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : JSON.parse(fs.readFileSync(path.join(__dirname, "serviceAccountKey.json"), "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

const app = express();
app.use(cors()); // fine for development; we'll restrict this when deploying
app.use(express.json());

const ROLES = ["user", "technician", "admin"];

// Verifies the login token and loads the caller's profile
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const decoded = await auth.verifyIdToken(token, true);
    const snap = await db.collection("users").doc(decoded.uid).get();
    if (!snap.exists || snap.data().active === false) {
      return res.status(403).json({ error: "Account not allowed" });
    }
    req.uid = decoded.uid;
    req.profile = snap.data();
    next();
   } catch (e) {
    console.error("Auth failed:", e.code, e.message);
    res.status(401).json({ error: "Invalid or expired login" });
  }
}

function adminOnly(req, res, next) {
  if (req.profile.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }
  next();
}

function authError(e, res) {
  if (e.code === "auth/email-already-exists") {
    return res.status(409).json({ error: "That email is already in use" });
  }
  if (e.code === "auth/invalid-email") {
    return res.status(400).json({ error: "Invalid email address" });
  }
  console.error(e);
  return res.status(500).json({ error: "Something went wrong" });
}

// ADMIN: create an account
app.post("/api/users", authenticate, adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const created = await auth.createUser({
      email: email.trim(),
      password,
      displayName: name.trim(),
    });
    await db.collection("users").doc(created.uid).set({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      active: true,
      createdBy: req.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    res.status(201).json({ uid: created.uid });
  } catch (e) {
    authError(e, res);
  }
});

// ADMIN: edit any account
app.patch("/api/users/:uid", authenticate, adminOnly, async (req, res) => {
  const { uid } = req.params;
  const { name, email, role, active, password } = req.body;

  try {
    const target = await db.collection("users").doc(uid).get();
    if (!target.exists) return res.status(404).json({ error: "Account not found" });

    if (uid === req.uid && ((role && role !== "admin") || active === false)) {
      return res.status(400).json({ error: "You can't demote or disable your own account" });
    }

    const profileUpdate = {};
    const authUpdate = {};

    if (typeof name === "string" && name.trim()) {
      profileUpdate.name = name.trim();
      authUpdate.displayName = name.trim();
    }
    if (typeof email === "string" && email.trim()) {
      profileUpdate.email = email.trim().toLowerCase();
      authUpdate.email = email.trim();
    }
    if (role !== undefined) {
      if (!ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
      profileUpdate.role = role;
    }
    if (typeof active === "boolean") {
      profileUpdate.active = active;
      authUpdate.disabled = !active;
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      authUpdate.password = password;
    }

    if (Object.keys(authUpdate).length) await auth.updateUser(uid, authUpdate);
    if (active === false || password) await auth.revokeRefreshTokens(uid);
    if (Object.keys(profileUpdate).length) {
      await db.collection("users").doc(uid).update(profileUpdate);
    }
    res.json({ ok: true });
  } catch (e) {
    authError(e, res);
  }
});

// EVERYONE: edit own name / password (role and email can't be changed here)
app.patch("/api/me", authenticate, async (req, res) => {
  const { name, password } = req.body;

  try {
    const profileUpdate = {};
    const authUpdate = {};

    if (typeof name === "string" && name.trim()) {
      profileUpdate.name = name.trim();
      authUpdate.displayName = name.trim();
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      authUpdate.password = password;
    }

    if (Object.keys(authUpdate).length) await auth.updateUser(req.uid, authUpdate);
    if (Object.keys(profileUpdate).length) {
      await db.collection("users").doc(req.uid).update(profileUpdate);
    }
    res.json({ ok: true });
  } catch (e) {
    authError(e, res);
  }
});
const lookupRoutes = require("./lookup");
app.use("/api/lookup", authenticate, lookupRoutes);

const supportRoutes = require("./support");
app.use("/api/support", supportRoutes); // public on purpose: no authenticate

app.get("/", (req, res) => res.send("GRM server is running"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://192.168.3.39:${PORT}`);
});