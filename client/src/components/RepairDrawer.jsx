import { useEffect, useRef, useState } from "react";
import {
  addDoc, collection, onSnapshot, orderBy, query, serverTimestamp,
} from "firebase/firestore";
import { X, Send } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  STATUS, formatDate, formatDateTime, formatDuration, fromInputDate, toInputDate,
} from "../utils/format";
import { setSchedule } from "../utils/repairActions";
import RepairActions from "./RepairActions";
import DeleteRepairButton from "./DeleteRepairButton"; // NEW
import { formatMaterials } from "../utils/materials";

const toDate = (t) => t?.toDate?.() ?? null;

export default function RepairDrawer({ repair, onClose }) {
  const { profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [text, setText] = useState("");
  const [sched, setSched] = useState(toInputDate(repair.scheduledFor));
  const [schedMsg, setSchedMsg] = useState("");
  const endRef = useRef(null);

  const schedKey = repair.scheduledFor ? repair.scheduledFor.getTime() : null;
  useEffect(() => {
    setSched(toInputDate(repair.scheduledFor));
  }, [schedKey]); // eslint-disable-line

  useEffect(() => {
    const q = query(
      collection(db, "repairs", repair.id, "comments"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setComments(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: "estimate" });
          return { id: d.id, ...x, createdAt: toDate(x.createdAt) };
        })
      );
    });
  }, [repair.id]);

  useEffect(() => {
    const q = query(
      collection(db, "repairs", repair.id, "attempts"),
      orderBy("finishedAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setAttempts(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: "estimate" });
          return {
            id: d.id,
            ...x,
            takenAt: toDate(x.takenAt),
            finishedAt: toDate(x.finishedAt),
          };
        })
      );
    });
  }, [repair.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      await addDoc(collection(db, "repairs", repair.id, "comments"), {
        text: t,
        authorId: profile.id,
        authorName: profile.name,
        authorRole: profile.role,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setText(t);
    }
  }

  async function saveSchedule(clear) {
    setSchedMsg("");
    const remove = clear || !sched;
    try {
      await setSchedule(repair.id, remove ? null : fromInputDate(sched));
      setSchedMsg(remove ? "Schedule cleared." : "Schedule saved.");
    } catch (err) {
      console.error(err);
      setSchedMsg("Could not update the schedule.");
    }
  }

  const st = STATUS[repair.status];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h3>{repair.name}</h3>
            <span className={`badge ${st?.cls}`} style={{ marginTop: 6 }}>{st?.label}</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={22} /></button>
        </div>

        <div className="drawer-body">
          <div className="card detail-grid">
            <Row k="Account number" v={repair.accountNumber} />
            <Row k="Phone" v={repair.phone} />
            <Row k="Address" v={repair.address} />
            <Row k="Concern" v={repair.concern} />
            <Row k="Added by" v={`${repair.createdByName} · ${formatDateTime(repair.createdAt)}`} />
            <Row
              k="Taken by"
              v={repair.takenByName ? `${repair.takenByName} · ${formatDateTime(repair.takenAt)}` : "Not yet taken"}
            />
            <Row
              k="Helper"
              v={
                repair.helperName ||
                (repair.status === "in_progress" && repair.helpRequested
                  ? "Help requested, nobody yet"
                  : "—")
              }
            />
            {repair.status === "pending" && repair.scheduledFor && (
              <Row k="Scheduled for" v={formatDate(repair.scheduledFor)} />
            )}
            {repair.failedAttempts > 0 && (
              <Row k="Failed attempts" v={String(repair.failedAttempts)} />
            )}
            {repair.completedAt && <Row k="Finished" v={formatDateTime(repair.completedAt)} />}
            {formatMaterials(repair.materials) && (
  <Row k="Materials used" v={formatMaterials(repair.materials)} />
)}
          </div>

          <RepairActions r={repair} />
          <DeleteRepairButton r={repair} onDeleted={onClose} /> {/* NEW */}

          {profile.role !== "technician" && repair.status === "pending" && (
            <p className="muted small">
              {repair.scheduledFor ? `Scheduled for ${formatDate(repair.scheduledFor)}. ` : ""}
              Waiting for a technician to take this repair.
            </p>
          )}

          {profile.role === "admin" && repair.status === "pending" && (
            <div className="card">
              <label style={{ marginTop: 0 }}>Schedule</label>
              <div className="schedule-row">
                <input type="date" value={sched} onChange={(e) => setSched(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={() => saveSchedule(false)}>
                  Save
                </button>
                <button className="btn btn-sm" onClick={() => saveSchedule(true)}>
                  Clear
                </button>
              </div>
              <p className="muted small" style={{ marginBottom: 0 }}>
                Technicians can't take this repair before the scheduled date.
                Clear it to make it available right away.
              </p>
              {schedMsg && <p className="small" style={{ marginBottom: 0 }}>{schedMsg}</p>}
            </div>
          )}

          {attempts.length > 0 && (
            <>
              <h4 className="thread-title">Attempt history</h4>
              {attempts.map((a, i) => (
                <div key={a.id} className={`attempt ${a.result}`}>
                  <div className="attempt-top">
                    <strong>
                      Attempt {i + 1} · {a.result === "successful" ? "Successful" : "Failed"}
                    </strong>
                    <span className="muted small">
                      {a.takenAt && a.finishedAt ? formatDuration(a.finishedAt - a.takenAt) : ""}
                    </span>
                  </div>
                  <div className="small">
                    Technician: {a.techName}
                    {a.helperName ? ` (helped by ${a.helperName})` : ""}
                  </div>
                  <div className="small muted">Taken: {formatDateTime(a.takenAt)}</div>
                  <div className="small muted">Finished: {formatDateTime(a.finishedAt)}</div>
                  {formatMaterials(a.materials) && (
  <div className="small">Materials: {formatMaterials(a.materials)}</div>
)}
                </div>
              ))}
            </>
          )}

          <h4 className="thread-title">Discussion</h4>

          {comments.length === 0 && (
            <p className="muted small">No comments yet. Start the conversation below.</p>
          )}

          {comments.map((c) => {
            const mine = c.authorId === profile.id;
            return (
              <div key={c.id} className={`bubble-row ${mine ? "mine" : ""}`}>
                <div className="bubble-meta">
                  {mine ? "You" : c.authorName} · {c.authorRole} · {formatDateTime(c.createdAt)}
                </div>
                <div className="bubble">{c.text}</div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form className="chat-input" onSubmit={send}>
          <input
            placeholder="Write a comment…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
          />
          <button className="btn btn-primary btn-icon" disabled={!text.trim()}>
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="detail-row">
      <span className="k">{k}</span>
      <span>{v || "—"}</span>
    </div>
  );
}