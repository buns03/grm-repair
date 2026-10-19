import { useEffect, useMemo, useState } from "react";
import {
  collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch,
} from "firebase/firestore";
import { ArrowRight, Bot, CheckCircle2, Hash, MapPin, Phone, Search, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useDialog } from "../components/Dialog";
import { formatDateTime } from "../utils/format";

const toDate = (t) => t?.toDate?.() ?? null;

export default function ToVerify() {
  const { profile } = useAuth();
  const { confirm, notify } = useDialog();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("to_verify");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "verifications"), orderBy("createdAt", "desc"), limit(300));
    return onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => {
            const x = d.data({ serverTimestamps: "estimate" });
            return { id: d.id, ...x, createdAt: toDate(x.createdAt), resolvedAt: toDate(x.resolvedAt) };
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

  const counts = useMemo(() => ({
    to_verify: items.filter((t) => t.status === "to_verify").length,
    resolved: items.filter((t) => t.status === "resolved").length,
  }), [items]);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter(
      (t) =>
        t.status === filter &&
        (!s || [t.name, t.accountNumber, t.phone, t.address, t.concern].join(" ").toLowerCase().includes(s))
    );
  }, [items, filter, search]);

  async function run(t, opts, action) {
    if (!(await confirm(opts))) return;
    setBusyId(t.id);
    try {
      await action();
    } catch (err) {
      console.error(err);
      await notify({
        title: "Something went wrong",
        message:
          err.code === "permission-denied"
            ? "Blocked by the database rules. Make sure the latest Firestore rules are published."
            : err.message,
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  const resolve = (t) =>
    run(
      t,
      {
        title: "Mark as resolved?",
        message: `The ticket for "${t.name}" will be marked resolved. It will not be moved to Repairs.`,
        confirmText: "Mark resolved",
        tone: "success",
      },
      () =>
        updateDoc(doc(db, "verifications", t.id), {
          status: "resolved",
          resolvedAt: serverTimestamp(),
          resolvedBy: profile.id,
          resolvedByName: profile.name,
        })
    );

  const remove = (t) =>
    run(
      t,
      {
        title: "Delete this ticket?",
        message: `The ticket for "${t.name}" will be permanently deleted. This can't be undone.`,
        confirmText: "Delete",
        tone: "danger",
      },
      () => deleteDoc(doc(db, "verifications", t.id))
    );

  const moveToRepair = (t) =>
    run(
      t,
      {
        title: "Move to Repairs?",
        message: `The ticket for "${t.name}" will become a pending repair and leave this tab.`,
        confirmText: "Move to Repair",
        tone: "info",
      },
      () => {
        const batch = writeBatch(db);
        batch.set(doc(collection(db, "repairs")), {
          name: t.name,
          accountNumber: t.accountNumber || "",
          phone: t.phone || "",
          address: t.address || "",
          // a known category keeps the dashboard analytics accurate; otherwise use the customer's words
          concern: t.category && t.category !== "OTHERS" ? t.category : t.concern,
          status: "pending",
          createdBy: profile.id,
          createdByName: profile.name,
          createdAt: serverTimestamp(),
          takenBy: null,
          takenByName: null,
          takenAt: null,
          helpRequested: false,
          helperId: null,
          helperName: null,
          completedAt: null,
        });
        batch.delete(doc(db, "verifications", t.id));
        return batch.commit();
      }
    );

  return (
    <div>
      <div className="toolbar">
        <h2 className="page-title">To Be Verified</h2>
      </div>

      <div className="search">
        <Search size={18} />
        <input
          placeholder="Search name, account, phone, address, concern…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="chips">
        {[["to_verify", "To verify"], ["resolved", "Resolved"]].map(([key, label]) => (
          <button key={key} className={`chip ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>
            {label} <span className="count">{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && visible.length === 0 && (
        <div className="card empty muted">
          {filter === "to_verify"
            ? "No tickets waiting. Customers who finish the AI support chat will appear here."
            : "No resolved tickets."}
        </div>
      )}

      <div className="repair-grid">
        {visible.map((t) => (
          <div className="repair-card static" key={t.id}>
            <div className="repair-top">
              <strong>{t.name}</strong>
              <div className="top-right">
                <span className={`badge ${t.status === "resolved" ? "st-success" : "st-pending"}`}>
                  {t.status === "resolved" ? "Resolved" : "To verify"}
                </span>
                <button className="icon-btn dark danger-icon" title="Delete ticket"
                  disabled={busyId === t.id} onClick={() => remove(t)}>
                  <Trash2 size={17} />
                </button>
              </div>
            </div>

            <p className="concern">{t.concern}</p>
            {(t.customerReplies?.length > 0 || t.customerWords) && (
  <div className="said">
    <div className="said-title">What the customer said</div>
    <ol>
      {(t.customerReplies?.length ? t.customerReplies : [t.customerWords]).map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ol>
  </div>
)}

            <div className="meta">
              <span><Hash size={14} /> {t.accountNumber || "—"}</span>
              <span><Phone size={14} /> {t.phone || "—"}</span>
              <span><MapPin size={14} /> {t.address || "—"}</span>
            </div>

            <div className="assign">
              <span className="who"><Bot size={14} /> Endorsed by AI Support</span>
              {t.source && <span className="who">Portal: {t.source}</span>}
            </div>

            {t.status === "to_verify" && (
              <div className="actions-row">
                <button className="btn btn-success btn-sm btn-icon" disabled={busyId === t.id} onClick={() => resolve(t)}>
                  <CheckCircle2 size={15} /> Mark resolved
                </button>
                <button className="btn btn-primary btn-sm btn-icon" disabled={busyId === t.id} onClick={() => moveToRepair(t)}>
                  Move to Repair <ArrowRight size={15} />
                </button>
              </div>
            )}

            {t.status === "resolved" && (
              <div className="muted small">Resolved by {t.resolvedByName} · {formatDateTime(t.resolvedAt)}</div>
            )}
            <div className="muted small">Received {formatDateTime(t.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}