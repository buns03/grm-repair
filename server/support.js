const express = require("express");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { lookupCustomers } = require("./portal");

const db = getFirestore();

const FB_PAGE = "Glercimor Network OPC San Jose Del Monte Bulacan";

const T = {
  askIssue: "What issue are you experiencing with your internet connection today?",
  restart:
    "Let's try a quick fix first. Please:\n1. Unplug your modem's power adapter.\n2. Wait 10 seconds.\n3. Plug it back in and wait 2-3 minutes for the lights to settle.\n\nDid that fix the issue?",
  askFixed: "Did restarting your modem fix the issue?",
  fixed:
    "Wonderful, I'm glad you're back online! If anything comes up again, feel free to chat with us anytime. Thank you for choosing Glercimor Network OPC!",
  askLight:
    "I'm sorry the restart didn't help. Let's check your modem/router. What lights are on right now, and what color are they? For example: a red LOS light, a yellow or orange light, green lights, or all lights off. If the lights look normal, please describe the problem you're seeing instead.",
  askAccount:
    "Thank you. So our Tech Support Team can assist you, may I have your account name or account number?",
  askAccountAgain:
    "I still need your account name or account number so I can endorse your concern to our Tech Support Team. Could you please type it?",
  needMore: "Could you please type your full account name or your account number (at least 3 characters)?",
  notFound: (q) =>
    `I couldn't find an account matching "${q}". Please check the spelling, or type your account number instead.`,
  confirmAsk: "Is this the correct account? Please reply Yes or No.",
  noMore: "I've run out of matches for that search. Please type your full account name or account number again.",
  endorsed:
    "Thank you for confirming! I've endorsed your concern to our Tech Support Team and they will follow up with you. Thank you for your patience and for choosing Glercimor Network OPC!",
  contactFb: `I'm sorry, I wasn't able to find your account in our system. For this concern, please contact our Facebook page, "${FB_PAGE}", and our team will assist you directly. Thank you for your patience!`,
  ended: "This chat has ended. Please refresh the page to start a new conversation.",
};

const Q = {
  fixed: ["Yes, it's fixed", "No, still not working"],
  light: ["Red light", "Yellow light", "Green light", "All lights off"],
  confirm: ["Yes, that's correct", "No, that's not me"],
};

// ---------- tiny rate limiter + session store (in memory) ----------
const buckets = new Map();
function allow(key, max, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000;



function getSession(id, ip) {
  let s = sessions.get(id);
  if (!s) {
    if (sessions.size > 5000) return null;
    s = {
      ip,
      stage: "ask_issue",
      words: [],    
      replies: [],        // what the customer said about the problem (last 3)
      category: "OTHERS",  // one of the Repairs concerns
      candidates: [],
      idx: 0,
      lookups: 0,          // portal searches (abuse limit)
      tries: 0,            // failed attempts to get an account (max 3)
      lightTries: 0,       // unclear answers to the modem light question (max 2)
      turns: 0,
      busy: false,
      at: 0,
    };
    sessions.set(id, s);
  }
  s.at = Date.now();
  return s;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.at > SESSION_TTL) sessions.delete(k);
  for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > 3600000) buckets.delete(k);
}, 10 * 60000).unref();

// =====================================================================
//  UNDERSTANDING ENGINE (free, no AI service).
//  To teach the bot new wordings, add words to the lists below.
// =====================================================================
const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const countWords = (t) => (t ? t.split(" ").length : 0);

// ---- What the customer said -> one of the Repairs concerns ----
// Order matters: the first match wins.
// Categories must match client/src/utils/concerns.js exactly.
const NET_RE = /\b(internet|net|wifi|wi fi|connection|konek\w*|signal|browse|browsing|data)\b/;
const NEG_RE = /\b(wala|walang|nawala|nawalan|no|not|ayaw|hindi|di|cant|cannot|unable|down|offline|off|dead|patay)\b/;

function detectIssue(t) {
  const hit = (category, ack, extra = {}) => ({ category, ack, ...extra });

  if (/\b(password|pass word|pw|passcode|wifi name|ssid)\b/.test(t))
    return hit("CHANGE/FORGOT PASSWORD", "I understand you need help with your WiFi password.");

  // red light = RED LOS
  if (/\b(red|los|pula\w*|namumula)\b/.test(t))
    return hit("RED LOS", "I'm sorry to hear about the red light on your modem.");

  // yellow light = NO INTERNET CONNECTION
  if (/\b(yellow|dilaw|orange|amber)\b/.test(t))
    return hit("NO INTERNET CONNECTION", "I'm sorry to hear about the yellow light on your modem.");

  // all lights off = NO INTERNET CONNECTION
  if (/\b(no lights?|walang ilaw|patay|(lights?|ilaw)( is| are| po)? off|all lights off|modem (is )?off|walang power)\b/.test(t))
    return hit("NO INTERNET CONNECTION", "Thank you for checking. It sounds like the modem isn't getting a signal.");

  // intermittent = INTERMITTENT CONNECTION
  if (/\b(intermittent|on and off|on off|paputol putol|putol putol|nawawala|disconnect\w*|unstable|not stable|hindi stable|di stable|nagdadrop|drops?|dropping)\b/.test(t))
    return hit("INTERMITTENT CONNECTION", "I'm sorry your connection keeps dropping.");

  if (/\bvpn\b/.test(t))
    return hit("OTHERS", "I'm sorry you're having trouble with your VPN connection.");

  // slow browse or any similar term = SLOW BROWSE
  if (/\b(slow\w*|mabagal|bagal|bumabagal|lag|laggy|lagging|buffer\w*|mahina|high ping)\b/.test(t))
    return hit("SLOW BROWSE", "I'm sorry your connection is slow.");

  // any internet word + any "no / wala / ayaw / hindi" word anywhere = NO INTERNET CONNECTION
  if (NET_RE.test(t) && NEG_RE.test(t))
    return hit("NO INTERNET CONNECTION", "I'm sorry to hear you have no internet connection.");

  // vague repair-related message = OTHERS
  if (/\b(modem|router|cable|kable|fiber|ethernet|lan|repair|technician|tech|ayusin|paayos|sira|nasira|problem|issue|concern|broken|not working|gumagana|ilaw|light|lights|internet|wifi|connection)\b/.test(t))
    return hit("OTHERS", "I'm sorry to hear you're having trouble with your connection.", { generic: true });

  return null;
}
const useful = (issue, t) => !!issue && (!issue.generic || countWords(t) > 5);

const GREEN = /\b(green|berde|luntian)\b/;
const ISSUE_STRICT = /\b(internet|wifi|wi fi|modem|connection|slow|walang|ayaw|not working|no signal|red light)\b/;
const NEG = /\b(no|nope|not|hindi|di|dont|still|pa rin|parin|same|ayaw|nothing)\b|\bwala(ng)? pa\b/;
const FIXED = /\b(fixed|solved|resolved|ok na|okay na|ayos na|gumagana na|nagana na|gumana na|balik na|bumalik na|connected na|may internet na|back online|working now|working na|now working|yes|yep|yeah|yup|oo|opo)\b/;
const FIXED_STRONG = /\b(fixed|solved|resolved|ok na|okay na|ayos na|gumagana na|nagana na|gumana na|balik na|bumalik na|connected na|may internet na|back online|working now|working na|now working)\b/;
const YES = /\b(yes|yep|yeah|yup|oo|opo|tama|correct|tumpak|ako po|ako yan|thats me|right|confirm\w*)\b/;
const NO = /\b(no|nope|not|hindi|di|mali|wrong|iba|dont)\b/;
const Q_WORDS = /\b(what|why|how|when|where|who|ano|bakit|paano|kailan|saan|sino|magkano)\b/;
const GREETING = /\b(hi|hello|hey|good morning|good afternoon|good evening|kumusta|musta|magandang \w+)\b/;
const THANKS = /\b(thanks|thank you|salamat)\b/;
const BOT = /\b(bot|ai|human|real person|tao|agent)\b/;
const BILLING = /\b(bill|billing|payment|bayad|promo|plan|upgrade|price|magkano|subscription|application|new connection|installation|relocate|transfer)\b/;
const ETA = /\b(when|kailan|how long|gaano katagal|anong oras|what time)\b/;
const DONT_KNOW = /\b(dont know|do not know|di ko alam|hindi ko alam|d ko alam|nakalimutan|forgot)\b/;

// Replies for messages that are not part of the repair flow
function sideReply(t) {
  if (BILLING.test(t))
    return `I can only help with internet connection and repair concerns. For billing, plans or new applications, please contact our Facebook page, "${FB_PAGE}".`;
  if (BOT.test(t))
    return "I'm Glercimor Network OPC's virtual support assistant. I'll gather your details so our Tech Support Team can help you.";
  if (THANKS.test(t)) return "You're welcome!";
  if (GREETING.test(t)) return "Hello, welcome to Glercimor Network OPC Support!";
  if (ETA.test(t))
    return "Once your concern is endorsed, our Tech Support Team will follow up and schedule the repair.";
  return "I'm sorry, I can only help with internet connection and repair concerns.";
}

// Pulls an account number or name out of a sentence
function extractAccount(raw) {
  const num = raw.match(/\d[\d\s-]{4,}\d/);
  if (num) return num[0].replace(/[\s-]/g, "");
  const s = raw
    .trim()
    .replace(/^(hi|hello|hey|good (morning|afternoon|evening)|kumusta|magandang (umaga|hapon|gabi))\b[\s,!.]*/i, "")
    .replace(/^(ang |yung |my )?(account |acct )?(name|number|pangalan)\b( ko)?( po)?( is| ay)?[\s:,-]*/i, "")
    .replace(/\s+po[\s.!]*$/i, "")
    .replace(/[\s.!]+$/, "")
    .trim();
  if (/^(po|opo)$/i.test(s)) return null;
  return s.length >= 3 && s.length <= 60 && /[a-z]/i.test(s) ? s : null;
}

// Returns { intent, concern, category, account_query, ack }
function understand(s, text) {
  const t = norm(text);
  const raw = text.trim().slice(0, 200);
  const out = { intent: "other", concern: null, category: null, account_query: null, ack: "" };
  const issue = detectIssue(t);
  const side = () => ((out.ack = sideReply(t)), out);
  const hasNum = /\d[\d\s-]{4,}\d/.test(text);
  const isQuestion = /\?/.test(text) || Q_WORDS.test(t);

  switch (s.stage) {
    case "ask_issue":
      if (issue) {
        out.intent = "describe_issue";
        out.concern = raw;
        out.category = issue.category;
        out.ack = issue.ack;
        return out;
      }
      return side();

    case "restart":
      if (NEG.test(t)) {
        out.intent = "not_fixed";
        if (useful(issue, t)) {
          out.concern = raw;
          out.category = issue.category;
        }
        return out;
      }
      if (FIXED.test(t)) {
        out.intent = "fixed";
        return out;
      }
      if (issue) {
        out.intent = "describe_issue";
        out.concern = raw;
        out.category = issue.category;
        return out;
      }
      return side();

    case "ask_light":
      if (FIXED_STRONG.test(t) && countWords(t) <= 6) {
        out.intent = "fixed";
        return out;
      }
      if (issue && !issue.generic) {
        out.intent = "describe_issue";
        out.concern = raw;
        out.category = issue.category;
        out.ack = issue.ack;
        return out;
      }
      if (GREEN.test(t)) {
        // green lights but still not working: keep the earlier category
        out.intent = "describe_issue";
        out.concern = raw;
        out.category = s.category !== "OTHERS" ? s.category : "NO INTERNET CONNECTION";
        out.ack = "Thank you for checking your modem lights.";
        return out;
      }
      if (useful(issue, t)) {
        out.intent = "describe_issue";
        out.concern = raw;
        out.category = issue.category;
        out.ack = issue.ack;
        return out;
      }
      return side();

    case "ask_account": {
      if (FIXED_STRONG.test(t) && !hasNum && countWords(t) <= 6) {
        out.intent = "fixed";
        return out;
      }
      if (DONT_KNOW.test(t) && /\b(account|number|acct)\b/.test(t)) {
        out.ack = "That's okay! You can type your full name as registered on your account instead.";
        return out;
      }
      if (!hasNum && ISSUE_STRICT.test(t)) {
        out.intent = "describe_issue";
        out.concern = raw;
        out.category = issue ? issue.category : "OTHERS";
        out.ack = "Thank you, I've noted that.";
        return out;
      }
      if (!hasNum && (isQuestion || BILLING.test(t) || BOT.test(t) || THANKS.test(t))) return side();
      const name = extractAccount(text);
      if (!name) return side();
      out.intent = "provide_account";
      out.account_query = name;
      return out;
    }

    case "confirm": {
      if (NO.test(t)) {
        out.intent = "confirm_no";
        return out;
      }
      if (YES.test(t)) {
        out.intent = "confirm_yes";
        return out;
      }
      const name = extractAccount(text);
      if (name && (hasNum || (!isQuestion && countWords(norm(name)) >= 2 && countWords(norm(name)) <= 6 && !ISSUE_STRICT.test(t)))) {
        out.intent = "provide_account";
        out.account_query = name;
        return out;
      }
      return side();
    }

    default:
      return side();
  }
}

// =====================================================================
//  THE FLOW (decided by the server)
// =====================================================================
const say = (ack, text, extra = {}) => ({
  replies: [{ text: [ack, text].filter(Boolean).join("\n\n") }],
  quick: [],
  done: false,
  ...extra,
});

// Saves what the customer said and the Repairs concern it maps to.
// A specific concern is never replaced by a vague "OTHERS".
function remember(s, r) {
  if (!r.concern) return;
  s.words.push(r.concern);
  s.words = s.words.slice(-3);
  if (r.category && (r.category !== "OTHERS" || s.category === "OTHERS")) s.category = r.category;
}

// Could not get a usable account: ask again; after 3 failed tries point to the FB page
function failAccount(s, ack, msg) {
  s.tries++;
  if (s.tries >= 3) {
    s.stage = "done";
    return say("", T.contactFb, { done: true });
  }
  return say(ack, msg);
}

function showCandidate(s, ack) {
  const c = s.candidates[s.idx];
  const intro = s.idx === 0 ? "I found an account that may match:" : "Here is the next possible match:";
  return {
    replies: [
      { text: [ack, intro].filter(Boolean).join("\n\n") },
      { card: { name: c.name, accountNumber: c.accountNumber, phone: c.phone, address: c.address } },
      { text: "Is this the correct account?" },
    ],
    quick: Q.confirm,
    done: false,
  };
}

async function search(s, query, ack) {
  const q = query.trim().slice(0, 60);
  if (q.length < 3) return failAccount(s, ack, T.needMore);

  if (s.lookups >= 5 || !allow(`lookup:${s.ip}`, 10, 10 * 60000)) {
    s.stage = "done";
    return say("", T.contactFb, { done: true });
  }
  s.lookups++;

  let found = [];
  try {
    found = await lookupCustomers(q);
  } catch (err) {
    console.error("[support] lookup failed:", err.message);
  }
  if (!found.length) return failAccount(s, ack, T.notFound(q));

  s.candidates = found;
  s.idx = 0;
  s.stage = "confirm";
  return showCandidate(s, ack);
}

function nextCandidate(s, ack) {
  s.idx++;
  if (s.idx < s.candidates.length) return showCandidate(s, ack);
  s.stage = "ask_account";
  s.candidates = [];
  return failAccount(s, ack, T.noMore);
}

async function endorse(s) {
  const c = s.candidates[s.idx];
  await db.collection("verifications").add({
    name: c.name,
    accountNumber: c.accountNumber,
    phone: c.phone,
    address: c.address,
    source: c.source || "",
    // the exact Repairs concern (used by the Dashboard); OTHERS keeps the customer's own words
    concern: s.category !== "OTHERS" ? s.category : s.words[s.words.length - 1] || "Not specified",
    category: s.category,
    customerReplies: s.replies,
    status: "to_verify",
    origin: "ai_support",
    createdAt: FieldValue.serverTimestamp(),
  });
  s.stage = "done";
  return say("", T.endorsed, { done: true });
}

async function step(s, text) {
  if (s.stage === "done") return say("", T.ended, { done: true });
  if (++s.turns > 30) {
    s.stage = "done";
    return say("", T.contactFb, { done: true });
  }

s.replies.push(text.slice(0, 500));
  s.replies = s.replies.slice(-30);

  const r = understand(s, text);
  if (r.intent === "describe_issue" || r.intent === "not_fixed") remember(s, r);

  // the problem got fixed at any point after the first question
  if (r.intent === "fixed" && !["ask_issue", "confirm"].includes(s.stage)) {
    s.stage = "done";
    return say("", T.fixed, { done: true });
  }

  switch (s.stage) {
    case "ask_issue":
      if (r.intent === "describe_issue") {
        s.stage = "restart"; // ALWAYS restart the modem first
        return say(r.ack, T.restart, { quick: Q.fixed });
      }
      return say(r.ack, T.askIssue);

    case "restart":
      if (r.intent === "not_fixed" || r.intent === "describe_issue") {
        s.stage = "ask_light"; // ALWAYS ask about the modem/router lights
        return say(r.ack, T.askLight, { quick: Q.light });
      }
      return say(r.ack, T.askFixed, { quick: Q.fixed });

    case "ask_light":
      if (r.intent === "describe_issue") {
        s.stage = "ask_account";
        return say(r.ack, T.askAccount);
      }
      // unclear answer: ask once more, then move on
      if (++s.lightTries >= 2) {
        s.stage = "ask_account";
        return say(r.ack, T.askAccount);
      }
      return say(r.ack, T.askLight, { quick: Q.light });

    case "ask_account":
      if (r.intent === "provide_account" && r.account_query) return search(s, r.account_query, r.ack);
      return failAccount(s, r.ack, T.askAccountAgain);

    case "confirm":
      if (r.intent === "confirm_yes") return endorse(s);
      if (r.intent === "confirm_no") return nextCandidate(s, r.ack);
      if (r.intent === "provide_account" && r.account_query) return search(s, r.account_query, r.ack);
      return say(r.ack, T.confirmAsk, { quick: Q.confirm });

    default:
      return say(r.ack, T.askIssue);
  }
}

// =====================================================================
//  THE PUBLIC ROUTE
// =====================================================================
const router = express.Router();

router.post("/chat", async (req, res) => {
  const { sessionId, message } = req.body || {};
  if (!/^[0-9a-f-]{36}$/i.test(String(sessionId))) return res.status(400).json({ error: "Invalid session." });
  const text = String(message || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: "Please type a message." });

  if (!allow(`chat:${req.ip}`, 40, 10 * 60000)) {
    return res.status(429).json({ error: "You're sending messages too fast. Please wait a moment." });
  }
  const s = getSession(sessionId, req.ip);
  if (!s) return res.status(503).json({ error: "We're busy right now. Please try again shortly." });
  if (s.busy) return res.status(429).json({ error: "Please wait for my reply first." });

  s.busy = true;
  try {
    res.json(await step(s, text));
  } catch (err) {
    console.error("[support] error:", err);
    res.status(500).json({ error: "Sorry, something went wrong. Please try again." });
  } finally {
    s.busy = false;
  }
});

console.log("[support] chatbot engine v3 loaded");
module.exports = router;