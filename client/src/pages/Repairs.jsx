import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Plus, Search, Phone, MapPin, Hash, CalendarClock, Package } from "lucide-react";
import { db } from "../firebase";
import {
  STATUS, formatDate, formatDateTime, fromInputDate, isRescheduled, isTodayRepair,
} from "../utils/format";
import RepairForm from "../components/RepairForm";
import RepairDrawer from "../components/RepairDrawer";
import Assignees from "../components/Assignees";
import RepairActions from "../components/RepairActions";
import DeleteRepairButton from "../components/DeleteRepairButton";
import DateFilter from "../components/DateFilter";
import { formatMaterials } from "../utils/materials";
import { isOnDate } from "../utils/dateFilter";
import { useAuth } from "../context/AuthContext";

const FILTERS = [
  ["all", "All"],
  ["pending", "Pending"],
  ["rescheduled", "Rescheduled"],
  ["in_progress", "In progress"],
  ["help", "Needs help"],
  ["successful", "Successful"],
];

const toDate = (t) => t?.toDate?.() ?? null;
const needsHelp = (r) => r.status === "in_progress" && r.helpRequested && !r.helperId;

export default function Repairs() {
  const { profile } = useAuth();
  const canCreate = profile?.role !== "technician";
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("all"); // "today" or "all"
  const [date, setDate] = useState(""); // "YYYY-MM-DD" or "" (no date filter)
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // keeps "Today" and scheduled buttons correct when midnight passes
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "repairs"), orderBy("createdAt", "desc"), limit(300));
    return onSnapshot(
      q,
      (snap) => {
        setRepairs(
          snap.docs.map((d) => {
            const x = d.data({ serverTimestamps: "estimate" });
            return {
              id: d.id,
              ...x,
              createdAt: toDate(x.createdAt),
              takenAt: toDate(x.takenAt),
              completedAt: toDate(x.completedAt),
              scheduledFor: toDate(x.scheduledFor),
            };
          })
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
  }, []);

  // a picked date wins over Today / Overall
  const scoped = useMemo(() => {
    if (date) return repairs.filter((r) => isOnDate(r, fromInputDate(date)));
    return scope === "today" ? repairs.filter((r) => isTodayRepair(r, now)) : repairs;
  }, [repairs, scope, now, date]);

  const counts = useMemo(() => {
    const c = { all: scoped.length, pending: 0, rescheduled: 0, in_progress: 0, help: 0, successful: 0 };
    scoped.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status]++;
      if (isRescheduled(r)) c.rescheduled++;
      if (needsHelp(r)) c.help++;
    });
    return c;
  }, [scoped]);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return scoped.filter((r) => {
      if (filter === "help") {
        if (!needsHelp(r)) return false;
      } else if (filter === "rescheduled") {
        if (!isRescheduled(r)) return false;
      } else if (filter !== "all" && r.status !== filter) {
        return false;
      }
      if (!s) return true;
      return [r.name, r.accountNumber, r.phone, r.address, r.concern, r.takenByName, r.helperName]
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [scoped, filter, search]);

  const openRepair = repairs.find((r) => r.id === openId);

  return (
    <div>
      <div className="toolbar">
        <h2 className="page-title">Repairs</h2>
        {canCreate && (
          <button className="btn btn-primary btn-icon" onClick={() => setShowForm(true)}>
            <Plus size={18} /> New repair
          </button>
        )}
      </div>

      <div className="scope-row">
        <div className="scope">
          <button className={`scope-btn ${!date && scope === "today" ? "active" : ""}`}
            onClick={() => { setScope("today"); setDate(""); }}>
            Today
          </button>
          <button className={`scope-btn ${!date && scope === "all" ? "active" : ""}`}
            onClick={() => { setScope("all"); setDate(""); }}>
            Overall
          </button>
        </div>
        <DateFilter value={date} onChange={setDate} />
        {!date && scope === "today" && (
          <span className="muted small">
            {now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
          </span>
        )}
      </div>

      <div className="search">
        <Search size={18} />
        <input
          placeholder="Search name, account, phone, address, technician…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="chips">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            className={`chip ${filter === key ? "active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label} <span className="count">{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && visible.length === 0 && (
        <div className="card empty muted">
          {repairs.length === 0
            ? canCreate
              ? "No repairs yet. Click “New repair” to add the first one."
              : "No repairs yet."
            : date && scoped.length === 0
            ? "No repairs were added, scheduled, taken or finished on this date."
            : !date && scope === "today" && scoped.length === 0
            ? "Nothing for today yet. Switch to Overall to see every repair."
            : "No repairs match your search or filter."}
        </div>
      )}

      <div className="repair-grid">
        {visible.map((r) => (
          <div
            key={r.id}
            className="repair-card"
            role="button"
            tabIndex={0}
            onClick={() => setOpenId(r.id)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && e.key === "Enter") setOpenId(r.id);
            }}
          >
            <div className="repair-top">
              <strong>{r.name}</strong>
              <div className="top-right">
                <span className={`badge ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span>
                <DeleteRepairButton r={r} compact />
              </div>
            </div>
            <p className="concern">{r.concern}</p>
            <div className="meta">
              <span><Hash size={14} /> {r.accountNumber || "—"}</span>
              <span><Phone size={14} /> {r.phone || "—"}</span>
              <span><MapPin size={14} /> {r.address || "—"}</span>
            </div>

            {r.status === "pending" && (r.scheduledFor || r.failedAttempts > 0) && (
              <div className="resched">
                <CalendarClock size={14} />
                {r.failedAttempts > 0 && `Failed ${r.failedAttempts}× · `}
                {r.scheduledFor ? `Scheduled ${formatDate(r.scheduledFor)}` : "Rescheduled"}
              </div>
            )}

            <Assignees r={r} />
            {formatMaterials(r.materials) && (
              <div className="materials-line">
                <Package size={14} /> {formatMaterials(r.materials)}
              </div>
            )}
            <RepairActions r={r} compact />

            <div className="muted small">
              Added by {r.createdByName} · {formatDateTime(r.createdAt)}
            </div>
          </div>
        ))}
      </div>

      {showForm && canCreate && <RepairForm onClose={() => setShowForm(false)} />}
      {openRepair && <RepairDrawer repair={openRepair} onClose={() => setOpenId(null)} />}
    </div>
  );
}
