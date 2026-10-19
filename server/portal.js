const cheerio = require("cheerio");

const BASE = (process.env.PORTAL_BASE || "https://glercimor.com").replace(/\/$/, "");

const ACCOUNTS = {
  sjdm: { label: "SJDM", user: process.env.SJDM_USER, pass: process.env.SJDM_PASS },
  borland: { label: "Borland", user: process.env.BORLAND_USER, pass: process.env.BORLAND_PASS },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---------- tiny HTTP client that remembers cookies ----------
function saveCookies(jar, res) {
  const lines = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const line of lines) {
    const pair = line.split(";")[0];
    const i = pair.indexOf("=");
    if (i < 1) continue;
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (!value || value === "deleted") jar.delete(name);
    else jar.set(name, value);
  }
}

async function request(session, url, { method = "GET", form, referer } = {}) {
  let current = url;
  let verb = method;
  let body = form ? new URLSearchParams(form).toString() : undefined;

  for (let hop = 0; hop < 8; hop++) {
    const headers = {
      "User-Agent": UA,
      Accept: "text/html,application/json,*/*",
    };
    if (session.jar.size) {
      headers.Cookie = [...session.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    if (body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers.Origin = BASE;
    }
    if (referer) headers.Referer = referer;

    const res = await fetch(current, { method: verb, redirect: "manual", headers, body });
    saveCookies(session.jar, res);

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      if (res.status !== 307 && res.status !== 308) {
        verb = "GET";
        body = undefined;
      }
      continue;
    }

    const text = await res.text();
    return { status: res.status, url: current, text, json: () => JSON.parse(text) };
  }
  throw new Error("Too many redirects");
}

// ---------- login (detects the form fields on its own) ----------
async function login(key) {
  const acct = ACCOUNTS[key];
  if (!acct || !acct.user || !acct.pass) {
    throw Object.assign(new Error(`Missing ${key} credentials in server/.env`), {
      status: 500,
      publicMessage: "Portal credentials are not set up on the server.",
    });
  }

  const session = { jar: new Map() };
  const page = await request(session, `${BASE}/auth`);
  const $ = cheerio.load(page.text);

  const pass = $("input[type=password]").first();
  const form = pass.closest("form");
  if (!form.length) throw new Error(`[${key}] Could not find the login form on ${BASE}/auth`);

  const actionAttr = form.attr("action") || "";
  if (/^javascript/i.test(actionAttr)) {
    throw new Error(`[${key}] The login form is submitted by JavaScript, so it needs a different approach`);
  }

  // copy every field (this includes hidden security tokens)
  const fields = {};
  form.find("input, select, textarea").each((_, el) => {
    const name = $(el).attr("name");
    const type = ($(el).attr("type") || "text").toLowerCase();
    if (!name || ["submit", "button", "image", "file", "reset"].includes(type)) return;
    if ((type === "checkbox" || type === "radio") && !$(el).is(":checked")) return;
    fields[name] = $(el).attr("value") ?? "";
  });

  const idInput = form
    .find("input")
    .filter((_, el) => ["text", "email", "tel"].includes(($(el).attr("type") || "text").toLowerCase()))
    .first();

  if (!idInput.attr("name") || !pass.attr("name")) {
    throw new Error(`[${key}] The login fields have no name attribute`);
  }
  fields[idInput.attr("name")] = acct.user;
  fields[pass.attr("name")] = acct.pass;

  const action = new URL(actionAttr, page.url).toString();
  const res = await request(session, action, { method: "POST", form: fields, referer: page.url });

  const $after = cheerio.load(res.text);
  if ($after("input[type=password]").length) {
    const msg = $after(".alert, .text-danger, .invalid-feedback, .error")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    throw Object.assign(new Error(`[${key}] Login failed${msg ? `: ${msg}` : ""}`), {
      status: 502,
      publicMessage: "Could not sign in to the customer portal.",
    });
  }

  session.homeUrl = res.url;
  session.homeHtml = res.text;
  return session;
}

// ---------- session cache (one login per account, reused) ----------
const sessions = new Map(); // key -> { session, at, pending }
const MAX_AGE = 20 * 60 * 1000;

async function getSession(key, force = false) {
  const entry = sessions.get(key);
  if (!force && entry && entry.session && Date.now() - entry.at < MAX_AGE) return entry.session;
  if (entry && entry.pending) return entry.pending;

  const pending = login(key)
    .then((session) => {
      sessions.set(key, { session, at: Date.now() });
      return session;
    })
    .catch((err) => {
      sessions.delete(key);
      throw err;
    });
  sessions.set(key, { pending });
  return pending;
}

async function withSession(key, fn) {
  let session = await getSession(key);
  try {
    return await fn(session);
  } catch (err) {
    if (err.code !== "SESSION_EXPIRED") throw err;
    session = await getSession(key, true);
    return fn(session);
  }
}

// ---------- the search itself ----------
// The portal's own table calls this endpoint (DataTables format).
// It must be a POST: a GET ignores the search and returns every customer.
function clean(v) {
  return String(v ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchAccount(key, session, q) {
  const params = {
    draw: "1",
    start: "0",
    length: "10",
    "search[value]": q,
    "search[regex]": "false",
  };
  for (let i = 0; i < 13; i++) {
    params[`columns[${i}][data]`] = String(i);
    params[`columns[${i}][name]`] = "";
    params[`columns[${i}][searchable]`] = "true";
    params[`columns[${i}][orderable]`] = "false";
    params[`columns[${i}][search][value]`] = "";
    params[`columns[${i}][search][regex]`] = "false";
  }

  const res = await fetch(`${BASE}/customer/getcustomermultiservices`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: BASE,
      Referer: `${BASE}/customer/multiservices`,
      Cookie: [...session.jar].map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: new URLSearchParams(params).toString(),
  });
  saveCookies(session.jar, res);

  const expired = () =>
    Object.assign(new Error(`[${key}] Portal session expired`), { code: "SESSION_EXPIRED" });

  // a redirect or a non-JSON answer means we were sent back to the login page
  if (res.status >= 300 && res.status < 400) throw expired();
  let json;
  try {
    json = JSON.parse(await res.text());
  } catch {
    throw expired();
  }

  const rows = Array.isArray(json.data) ? json.data : [];
  return rows
    .map((x) => ({
      name: clean(x.name),
      accountNumber: clean(x.no_services),
      phone: clean(x.phone),
      address: clean(x.address),
    }))
    .filter((c) => c.name || c.accountNumber);
}

// Searches both portal accounts and merges the results
async function lookupCustomers(q) {
  const keys = Object.keys(ACCOUNTS);
  const settled = await Promise.allSettled(
    keys.map((key) => withSession(key, (session) => searchAccount(key, session, q)))
  );

  const results = [];
  const errors = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      r.value.forEach((c) => results.push({ ...c, source: ACCOUNTS[keys[i]].label }));
    } else {
      console.error(`[portal:${keys[i]}]`, r.reason.message);
      errors.push(r.reason);
    }
  });

  if (!results.length && errors.length === keys.length) throw errors[0];
  return results.slice(0, 15);
}

module.exports = { BASE, ACCOUNTS, request, getSession, withSession, lookupCustomers };