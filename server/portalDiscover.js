require("dotenv").config();
const cheerio = require("cheerio");
const { BASE, getSession, request } = require("./portal");

const mask = (s) => String(s).replace(/[A-Za-z]/g, "x").replace(/\d/g, "9");

function shape(v, depth = 0) {
  if (Array.isArray(v)) return depth > 3 ? "[…]" : [`${v.length} items`, shape(v[0], depth + 1)];
  if (v && typeof v === "object") {
    if (depth > 3) return "{…}";
    return Object.fromEntries(
      Object.entries(v).slice(0, 25).map(([k, x]) => [k, shape(x, depth + 1)])
    );
  }
  if (typeof v === "string") return mask(v).slice(0, 60);
  return typeof v;
}

function printMenu(html, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  console.log("Menu / links on the first page after login:\n");
  $("a[href]").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const href = $(el).attr("href");
    if (!text || !href || href.startsWith("javascript") || href === "#") return;
    let path;
    try {
      path = new URL(href, baseUrl).pathname;
    } catch {
      return;
    }
    const line = `${text}  ->  ${path}`;
    if (!seen.has(line)) {
      seen.add(line);
      console.log("  " + line);
    }
  });
}

function inspectPage(page) {
  console.log(`Status ${page.status} · ${page.url.replace(/\?.*$/, "")}\n`);

  let json = null;
  try {
    json = page.json();
  } catch {
    /* not JSON */
  }
  if (json) {
    console.log("JSON response shape (values masked):");
    console.log(JSON.stringify(shape(json), null, 2));
    return;
  }

  const $ = cheerio.load(page.text);
  console.log("Title:", $("title").text().trim());

  $("form").each((i, el) => {
    const f = $(el);
    const fields = f
      .find("input, select, textarea")
      .map((_, x) => `${$(x).attr("name") || "(no name)"}[${$(x).attr("type") || x.tagName}]`)
      .get();
    console.log(
      `\nForm ${i + 1}: method=${f.attr("method") || "get"} action=${(f.attr("action") || "").replace(/\?.*$/, "")}`
    );
    console.log("  fields:", fields.join(", "));
  });

  $("table").each((i, el) => {
    const t = $(el);
    const heads = t
      .find("thead th")
      .map((_, x) => $(x).text().replace(/\s+/g, " ").trim())
      .get();
    const rows = t.find("tbody tr");
    console.log(`\nTable ${i + 1} (id=${t.attr("id") || "-"}): ${rows.length} rows`);
    console.log("  headers:", heads.join(" | "));
    const first = rows
      .first()
      .find("td")
      .map((_, x) => mask($(x).text().replace(/\s+/g, " ").trim()).slice(0, 40))
      .get();
    if (first.length) console.log("  first row (masked):", first.join(" | "));
  });

  const hints = new Set();
  $("script").each((_, el) => {
    const code = $(el).html() || "";
    const re = /["'`]([^"'`\s]*(?:ajax|json|datatable|list|search|customer|subscriber|client|user)[^"'`\s]*)["'`]/gi;
    for (const m of code.matchAll(re)) {
      const s = m[1];
      if (/^(\/|https?:)/.test(s) && !/\.(js|css|png|jpg|svg|woff2?)(\?|$)/i.test(s)) {
        hints.add(s.replace(/\?.*$/, ""));
      }
    }
  });
  if (hints.size) {
    console.log("\nPossible data endpoints found in the page scripts:");
    [...hints].slice(0, 30).forEach((h) => console.log("  " + h));
  }
}

async function main() {
  const [key, path] = process.argv.slice(2);
  if (!["sjdm", "borland"].includes(key)) {
    console.log("Usage: node portalDiscover.js sjdm|borland [/page-path]");
    return;
  }

  const session = await getSession(key, true);
  console.log(`\nLogged in to ${key}. Landed on: ${session.homeUrl.replace(/\?.*$/, "")}\n`);

  if (!path) {
    printMenu(session.homeHtml, session.homeUrl);
    return;
  }
  const page = await request(session, new URL(path, BASE).toString(), { referer: session.homeUrl });
  inspectPage(page);
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
});