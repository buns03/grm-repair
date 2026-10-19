require("dotenv").config();
const { BASE, getSession } = require("./portal");

const mask = (s) => String(s).replace(/[A-Za-z]/g, "x").replace(/\d/g, "9");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function tableParams(term) {
  const p = { draw: "1", start: "0", length: "10", "search[value]": term, "search[regex]": "false" };
  for (let i = 0; i < 13; i++) {
    p[`columns[${i}][data]`] = String(i);
    p[`columns[${i}][name]`] = "";
    p[`columns[${i}][searchable]`] = "true";
    p[`columns[${i}][orderable]`] = "false";
    p[`columns[${i}][search][value]`] = "";
    p[`columns[${i}][search][regex]`] = "false";
  }
  return p;
}

async function attempt(session, method, term) {
  const url = `${BASE}/customer/getcustomermultiservices`;
  const qs = new URLSearchParams(tableParams(term)).toString();
  const headers = {
    "User-Agent": UA,
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    Referer: `${BASE}/customer/multiservices`,
    Cookie: [...session.jar].map(([k, v]) => `${k}=${v}`).join("; "),
  };
  let res;
  if (method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    headers.Origin = BASE;
    res = await fetch(url, { method, headers, body: qs, redirect: "manual" });
  } else {
    res = await fetch(`${url}?${qs}`, { method, headers, redirect: "manual" });
  }
  const text = await res.text();

  console.log(`\n=== ${method}  search="${mask(term)}" ===`);
  console.log(`Status ${res.status} · ${res.headers.get("content-type")} · ${text.length} chars`);
  if (res.status >= 300 && res.status < 400) {
    console.log("Redirected to:", (res.headers.get("location") || "").replace(/\?.*$/, ""));
    return;
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.log("Not JSON. First 200 chars (masked):", mask(text.slice(0, 200)));
    return;
  }

  console.log("Top-level keys:", Object.keys(json).join(", "));
  for (const k of ["draw", "recordsTotal", "recordsFiltered", "iTotalRecords", "iTotalDisplayRecords"]) {
    if (k in json) console.log(`  ${k}:`, json[k]);
  }
  const rows = json.data || json.aaData || (Array.isArray(json) ? json : null);
  if (!rows) return;
  console.log("Rows returned:", rows.length);
  if (rows[0]) {
    console.log("First row (masked):");
    if (Array.isArray(rows[0])) {
      rows[0].forEach((v, i) => console.log(`  [${i}] ${mask(v).slice(0, 80)}`));
    } else {
      Object.entries(rows[0]).forEach(([k, v]) => console.log(`  ${k}: ${mask(v).slice(0, 80)}`));
    }
  }
}

async function main() {
  const [key, term = ""] = process.argv.slice(2);
  if (!["sjdm", "borland"].includes(key)) {
    console.log("Usage: node portalProbe.js sjdm|borland [search text]");
    return;
  }
  const session = await getSession(key, true);
  await attempt(session, "POST", term);
  await attempt(session, "GET", term);
}

main().catch((err) => console.error("\nFAILED:", err.message));