import { jsPDF } from "jspdf";
import { formatDuration, toInputDate } from "./format";

const GREEN = [18, 163, 107];
const YELLOW = [245, 176, 10]; // failed bars and legend
const YELLOW_TEXT = [168, 112, 0]; // failed numbers (darker so they read on white)
const BLUE = [37, 99, 235];
const INK = [15, 27, 54];
const MUTED = [107, 122, 153];
const LINE = [226, 233, 245];
const TRACK = [233, 239, 249];
const HEAD_BG = [238, 244, 255];
const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 3)}...` : String(s));

function ensure(doc, y, need) {
  if (y + need > 282) {
    doc.addPage();
    return 18;
  }
  return y;
}

function heading(doc, title, periodName, range) {
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, PAGE_W, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(title, MARGIN, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`${periodName}: ${range}`, MARGIN, 25);
  doc.text(`Generated ${new Date().toLocaleString("en-PH")}`, MARGIN, 30);
  doc.setDrawColor(...LINE);
  doc.line(MARGIN, 33, PAGE_W - MARGIN, 33);
  doc.setTextColor(...INK);
  return 42;
}

function sectionTitle(doc, text, y, legend) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(text, MARGIN, y);
  if (legend) {
    let x = PAGE_W - MARGIN;
    [...legend].reverse().forEach(([label, color]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      x -= doc.getTextWidth(label);
      doc.setTextColor(...INK);
      doc.text(label, x, y);
      x -= 5;
      doc.setFillColor(...color);
      doc.rect(x, y - 3, 3.5, 3.5, "F");
      x -= 5;
    });
  }
  return y + 8;
}

function cardsRow(doc, cards, y) {
  const gap = 3;
  const w = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  cards.forEach(([label, value, tone], i) => {
    const x = MARGIN + i * (w + gap);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, w, 20, 2, 2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...(tone === "ok" ? GREEN : tone === "bad" ? YELLOW_TEXT : tone === "brand" ? BLUE : INK));
    doc.text(String(value), x + 3, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 3, y + 16);
  });
  doc.setTextColor(...INK);
  return y + 28;
}

// Stacked columns: successful (green) + failed (yellow) per time slot
function drawTrend(doc, data, x, y, w, h) {
  const left = 10, bottom = 10, top = 6;
  const pw = w - left;
  const ph = h - bottom - top;
  const max = Math.max(1, ...data.map((b) => b.ok + b.failed));
  const ticks = Math.min(max, 4);
  const step = Math.ceil(max / ticks);
  const tmax = step * ticks;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (let i = 0; i <= ticks; i++) {
    const v = i * step;
    const yy = y + top + ph - (v / tmax) * ph;
    doc.line(x + left, yy, x + w, yy);
    doc.setTextColor(...MUTED);
    doc.text(String(v), x + left - 2, yy + 1, { align: "right" });
  }

  const slot = pw / data.length;
  const bw = Math.min(7, slot * 0.6);
  const every = Math.ceil(data.length / 12);
  const base = y + top + ph;

  data.forEach((b, i) => {
    const cx = x + left + slot * i + slot / 2;
    const okH = (b.ok / tmax) * ph;
    const badH = (b.failed / tmax) * ph;
    if (b.ok > 0) {
      doc.setFillColor(...GREEN);
      doc.rect(cx - bw / 2, base - okH, bw, okH, "F");
    }
    if (b.failed > 0) {
      doc.setFillColor(...YELLOW);
      doc.rect(cx - bw / 2, base - okH - badH, bw, badH, "F");
    }
    const total = b.ok + b.failed;
    if (total > 0) {
      doc.setFontSize(data.length > 16 ? 6 : 7);
      doc.setTextColor(...INK);
      doc.text(String(total), cx, base - okH - badH - 1, { align: "center" });
    }
    if (i % every === 0) {
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(b.label, cx, base + 4, { align: "center" });
    }
  });

  doc.setTextColor(...INK);
  return y + h + 4;
}

function drawBars(doc, items, y, color) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const bx = MARGIN + 62;
  const bw = CONTENT_W - 62 - 12;

  items.forEach((it) => {
    y = ensure(doc, y, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(clip(it.label, 30), MARGIN, y + 3);
    if (it.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(clip(it.sub, 40), MARGIN, y + 7);
    }
    doc.setFillColor(...TRACK);
    doc.roundedRect(bx, y, bw, 5, 2, 2, "F");
    if (it.value > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(bx, y, Math.max(2, (it.value / max) * bw), 5, 2, 2, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(String(it.value), PAGE_W - MARGIN, y + 4, { align: "right" });
    y += 12;
  });
  return y;
}

function drawTable(doc, stats, y) {
  const cols = [
    ["#", 10, "left"],
    ["Technician", 56, "left"],
    ["Successful", 24, "right"],
    ["Failed", 18, "right"],
    ["Helped", 18, "right"],
    ["Success rate", 28, "right"],
    ["Avg time", 28, "right"],
  ];

  const row = (cells, yy, bold) => {
    let x = MARGIN;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    cells.forEach((text, i) => {
      const [, w, align] = cols[i];
      if (align === "right") doc.text(String(text), x + w - 2, yy, { align: "right" });
      else doc.text(String(text), x + 2, yy);
      x += w;
    });
  };

  doc.setFillColor(...HEAD_BG);
  doc.rect(MARGIN, y - 5, CONTENT_W, 8, "F");
  doc.setTextColor(...INK);
  row(cols.map((c) => c[0]), y, true);
  y += 8;

  stats.forEach((t, i) => {
    y = ensure(doc, y, 8);
    doc.setTextColor(...INK);
    row([i + 1, clip(t.name, 28), t.ok, t.failed, t.helped, `${t.rate}%`, formatDuration(t.avgMs)], y, false);
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, y + 2.5, PAGE_W - MARGIN, y + 2.5);
    y += 7;
  });
  return y;
}

export function exportDashboardPdf({ period, periodName, range, cards, trend, concerns, materials }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = heading(doc, "GRM Repair Service - Dashboard", periodName, range);

  y = cardsRow(doc, cards, y);

  y = sectionTitle(doc, "Successful vs failed repairs", y, [["Successful", GREEN], ["Failed", YELLOW]]);
  const total = trend.reduce((s, b) => s + b.ok + b.failed, 0);
  if (total === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("No repairs were finished in this period.", MARGIN, y + 4);
    y += 14;
  } else {
    y = drawTrend(doc, trend, MARGIN, y, CONTENT_W, 70);
  }

  y = ensure(doc, y + 6, 70);
  y = sectionTitle(doc, "Concerns reported", y);
  y = drawBars(doc, concerns, y, BLUE);

  // Materials (only the ones that were used)
  const used = (materials || []).filter((m) => m.total > 0);
  y = ensure(doc, y + 6, 70);
  y = sectionTitle(doc, "Materials used (successful repairs)", y);
  if (used.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("No materials were recorded in this period.", MARGIN, y + 4);
  } else {
    y = cardsRow(
      doc,
      used.map((m) => [`${m.label} (${m.unit === "m" ? "meters" : "pcs"})`, m.total, "info"]),
      y
    );
    const pieces = used.filter((m) => m.unit === "pcs");
    if (pieces.length) {
      drawBars(
        doc,
        pieces.map((m) => ({
          label: m.label,
          value: m.total,
          sub: `Used in ${m.jobs} repair${m.jobs === 1 ? "" : "s"}`,
        })),
        y,
        BLUE
      );
    }
  }

  doc.save(`GRM-dashboard-${period}-${toInputDate(new Date())}.pdf`);
}

export function exportLeaderboardPdf({ period, periodName, range, stats }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = heading(doc, "GRM Repair Service - Technician Leaderboard", periodName, range);

  if (!stats.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("No finished repairs in this period.", MARGIN, y);
  } else {
    y = sectionTitle(doc, "Successful repairs per technician", y);
    y = drawBars(
      doc,
      stats.map((t) => ({ label: t.name, value: t.ok, sub: `${t.failed} failed · helped ${t.helped}` })),
      y,
      GREEN
    );
    y = ensure(doc, y + 6, 30);
    y = sectionTitle(doc, "Ranking details", y);
    drawTable(doc, stats, y);
  }

  doc.save(`GRM-leaderboard-${period}-${toInputDate(new Date())}.pdf`);
}
