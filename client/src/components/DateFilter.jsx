import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { fromInputDate, toInputDate } from "../utils/format";

// Pick one specific day. value is "YYYY-MM-DD" or "" (no date filter).
// Pass max={toInputDate(new Date())} to block future dates (Dashboard).
export default function DateFilter({ value, onChange, max }) {
  const today = toInputDate(new Date());

  function shift(n) {
    const d = fromInputDate(value || today);
    d.setDate(d.getDate() + n);
    const next = toInputDate(d);
    onChange(max && next > max ? max : next);
  }

  return (
    <div className={`date-filter ${value ? "on" : ""}`}>
      <CalendarDays size={16} />
      <button type="button" className="date-nav" title="Previous day" onClick={() => shift(-1)}>
        <ChevronLeft size={16} />
      </button>
      <input type="date" value={value} max={max} aria-label="Filter by date"
        onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="date-nav" title="Next day"
        disabled={!value || (max && value >= max)} onClick={() => shift(1)}>
        <ChevronRight size={16} />
      </button>
      {value && (
        <button type="button" className="date-clear" onClick={() => onChange("")}>Clear</button>
      )}
    </div>
  );
}

// ---- save this part as src/utils/dateFilter.js ----
// import { isSameDay } from "./format";
// export const isOnDate = (r, day) =>
//   isSameDay(r.createdAt, day) || isSameDay(r.scheduledFor, day) ||
//   isSameDay(r.takenAt, day) || isSameDay(r.completedAt, day);
