import { CONCERNS, matchConcern } from "./concerns";
import { MATERIALS } from "./materials";

export const PERIODS = [
  ["day", "Today"],
  ["week", "This week"],
  ["month", "This month"],
  ["year", "This year"],
  ["all", "All time"],
];

export function periodStart(period, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "day") return today;
  if (period === "week") {
    const back = (today.getDay() + 6) % 7; // weeks start on Monday
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
  }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

export function periodLabel(period, now = new Date()) {
  const f = (d, o) => d.toLocaleDateString("en-PH", o);
  if (period === "day") return f(now, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (period === "week") {
    return `${f(periodStart("week", now), { month: "short", day: "numeric" })} to ${f(now, {
      month: "short", day: "numeric", year: "numeric",
    })}`;
  }
  if (period === "month") return f(now, { month: "long", year: "numeric" });
  if (period === "year") return String(now.getFullYear());
  return "All time";
}

export function inPeriod(date, period, now = new Date()) {
  if (!date) return false;
  const s = periodStart(period, now);
  if (period === "day")
    return date >= s && date < new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
  return !s || date >= s;
}

export function flowTrend(created, done, period, now = new Date()) {
  let first = null;
  [...created.map((r) => r.createdAt), ...done.map((a) => a.finishedAt)].forEach((d) => {
    if (d && (!first || d < first)) first = d;
  });
  const buckets = buildBuckets(period, first, now).map((b) => ({ ...b, reported: 0, finished: 0 }));
  const put = (d, k) => {
    const b = d && buckets.find((x) => d >= x.start && d < x.end);
    if (b) b[k]++;
  };
  created.forEach((r) => put(r.createdAt, "reported"));
  done.forEach((a) => put(a.finishedAt, "finished"));
  return buckets;
}

function buildBuckets(period, firstDate, now) {
  const out = [];
  const push = (start, end, label) => out.push({ start, end, label });
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  if (period === "day") {
    for (let h = 0; h < 24; h++) {
      const label = h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
      push(new Date(y, m, d, h), new Date(y, m, d, h + 1), label);
    }
  } else if (period === "week") {
    const s = periodStart("week", now);
    for (let i = 0; i < 7; i++) {
      const a = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
      const b = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i + 1);
      push(a, b, `${a.toLocaleDateString("en-PH", { weekday: "short" })} ${a.getDate()}`);
    }
  } else if (period === "month") {
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 1; i <= days; i++) push(new Date(y, m, i), new Date(y, m, i + 1), String(i));
  } else if (period === "year") {
    for (let i = 0; i < 12; i++) {
      push(new Date(y, i, 1), new Date(y, i + 1, 1),
        new Date(y, i, 1).toLocaleDateString("en-PH", { month: "short" }));
    }
  } else {
    const first = firstDate || now;
    if (y - first.getFullYear() >= 3) {
      for (let yr = first.getFullYear(); yr <= y; yr++) {
        push(new Date(yr, 0, 1), new Date(yr + 1, 0, 1), String(yr));
      }
    } else {
      let cur = new Date(first.getFullYear(), first.getMonth(), 1);
      while (cur <= now) {
        const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        push(cur, next, cur.toLocaleDateString("en-PH", { month: "short", year: "2-digit" }));
        cur = next;
      }
    }
  }
  return out;
}

// Successful and failed attempts per time slot
export function trend(attempts, period, now = new Date()) {
  let first = null;
  attempts.forEach((a) => {
    if (a.finishedAt && (!first || a.finishedAt < first)) first = a.finishedAt;
  });
  const buckets = buildBuckets(period, first, now).map((b) => ({ ...b, ok: 0, failed: 0 }));
  attempts.forEach((a) => {
    if (!a.finishedAt) return;
    const b = buckets.find((x) => a.finishedAt >= x.start && a.finishedAt < x.end);
    if (!b) return;
    if (a.result === "successful") b.ok++;
    else if (a.result === "failed") b.failed++;
  });
  return buckets;
}

// Repairs reported per concern, plus how those concerns ended up
export function concernStats(created, done, byId) {
  const rows = Object.fromEntries(CONCERNS.map((c) => [c, { label: c, value: 0, ok: 0, failed: 0 }]));
  const keyOf = (r) => matchConcern(r.concern).choice || "OTHERS";

  created.forEach((r) => {
    rows[keyOf(r)].value++;
  });
  done.forEach((a) => {
    const r = byId.get(a.repairId);
    if (!r) return;
    const row = rows[keyOf(r)];
    if (a.result === "successful") row.ok++;
    else if (a.result === "failed") row.failed++;
  });
  return CONCERNS.map((c) => ({
    ...rows[c],
    sub: `${rows[c].ok} successful · ${rows[c].failed} failed`,
  }));
}

// Ranking: most successful repairs first
export function techStats(attempts) {
  const map = new Map();
  const get = (id, name) => {
    if (!map.has(id)) map.set(id, { id, name: name || "Unknown", ok: 0, failed: 0, helped: 0, ms: 0, timed: 0 });
    const t = map.get(id);
    if (name) t.name = name;
    return t;
  };

  attempts.forEach((a) => {
    if (!a.techId) return;
    const t = get(a.techId, a.techName);
    if (a.result === "successful") {
      t.ok++;
      if (a.takenAt && a.finishedAt) {
        t.ms += a.finishedAt - a.takenAt;
        t.timed++;
      }
      if (a.helperId) get(a.helperId, a.helperName).helped++;
    } else if (a.result === "failed") {
      t.failed++;
    }
  });

  return [...map.values()]
    .map((t) => ({
      ...t,
      rate: t.ok + t.failed ? Math.round((t.ok / (t.ok + t.failed)) * 100) : 0,
      avgMs: t.timed ? t.ms / t.timed : null,
    }))
    .sort((a, b) => b.ok - a.ok || b.helped - a.helped || a.failed - b.failed || a.name.localeCompare(b.name));
}

// Total quantity of each material used by successful repairs in the period
export function materialStats(done) {
  const rows = MATERIALS.map((m) => ({
    key: m.key,
    label: m.label,
    unit: m.unit,
    total: 0,
    jobs: 0,
  }));

  done.forEach((a) => {
    if (a.result !== "successful" || !a.materials) return;
    rows.forEach((row) => {
      const q = Number(a.materials[row.key]) || 0;
      if (q > 0) {
        row.total += q;
        row.jobs++;
      }
    });
  });

  return rows.map((r) => ({ ...r, total: Math.round(r.total * 10) / 10 }));
}