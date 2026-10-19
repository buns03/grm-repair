export const STATUS = {
  pending: { label: "Pending", cls: "st-pending" },
  in_progress: { label: "In progress", cls: "st-progress" },
  successful: { label: "Successful", cls: "st-success" },
  failed: { label: "Failed", cls: "st-failed" }, // legacy only
};

export function formatDateTime(d) {
  if (!d) return "";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(d) {
  if (!d) return "";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1 min";
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ");
}

const pad = (n) => String(n).padStart(2, "0");

// Date -> "YYYY-MM-DD" for <input type="date">
export const toInputDate = (d) =>
  d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";

// "YYYY-MM-DD" -> Date at 12:00 AM local time
export function fromInputDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function tomorrowStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const isScheduledLater = (r) =>
  !!r.scheduledFor && r.scheduledFor.getTime() > Date.now();

export const isRescheduled = (r) =>
  r.status === "pending" && (r.failedAttempts || 0) > 0;

export function isSameDay(a, b = new Date()) {
  return (
    !!a &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// "Today" = added today, scheduled for today, taken or finished today,
// or being worked on right now
export function isTodayRepair(r, now = new Date()) {
  return (
    r.status === "in_progress" ||
    isSameDay(r.createdAt, now) ||
    isSameDay(r.scheduledFor, now) ||
    isSameDay(r.takenAt, now) ||
    isSameDay(r.completedAt, now)
  );
}