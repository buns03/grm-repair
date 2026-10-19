const express = require("express");
const { lookupCustomers } = require("./portal");

const router = express.Router();
const hits = new Map(); // uid -> recent request times
const cache = new Map(); // query -> { at, results }

router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 3) return res.status(400).json({ error: "Type at least 3 characters." });

  // 30 lookups per minute per person
  const now = Date.now();
  const recent = (hits.get(req.uid) || []).filter((t) => now - t < 60000);
  if (recent.length >= 30) {
    return res.status(429).json({ error: "Too many lookups. Please wait a minute." });
  }
  recent.push(now);
  hits.set(req.uid, recent);

  // same search within 5 minutes is answered from memory
  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && now - cached.at < 5 * 60000) return res.json({ results: cached.results });

  try {
    const results = await lookupCustomers(q);
    cache.set(key, { at: now, results });
    res.json({ results });
  } catch (err) {
    console.error("Lookup failed:", err.message);
    res.status(err.status || 502).json({
      error: err.publicMessage || "Could not reach the customer portal.",
    });
  }
});

module.exports = router;