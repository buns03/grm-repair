import { useEffect, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { X, AlertTriangle } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import { parseRepairText } from "../utils/parseRepair";
import { findDuplicates } from "../utils/duplicates";
import { CONCERNS, matchConcern } from "../utils/concerns";
import { STATUS, formatDate } from "../utils/format";

const EMPTY = { name: "", accountNumber: "", phone: "", address: "" };
const isDigits = (s) => /^\d+$/.test(s);

export default function RepairForm({ onClose }) {
  const { profile } = useAuth();
  const [mode, setMode] = useState("auto"); // "auto" is the priority mode
  const [raw, setRaw] = useState("");
  const [f, setF] = useState(EMPTY);
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [source, setSource] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dupes, setDupes] = useState(null);
  const timer = useRef(null);
  const reqId = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const concern = choice === "OTHERS" ? other.trim() : choice;

  // ---------- AUTO mode ----------
  function pick(c) {
    setF({
      name: c.name || "",
      accountNumber: c.accountNumber || "",
      phone: c.phone || "",
      address: c.address || "",
    });
    setSource(c.source || "");
    setResults([]);
    setLookupMsg("");
    setDupes(null);
  }

  async function runLookup(q) {
    const id = ++reqId.current;
    setSearching(true);
    setLookupMsg("");
    try {
      const { results: found } = await api(`/api/lookup?q=${encodeURIComponent(q)}`);
      if (id !== reqId.current) return;
      if (found.length === 1 && isDigits(q)) {
        pick(found[0]); // an account number matched exactly one customer
      } else {
        setResults(found);
        if (!found.length) {
          setLookupMsg("No customer found. Check the details or switch to Manual.");
        }
      }
    } catch (err) {
      if (id === reqId.current) {
        setResults([]);
        setLookupMsg(err.message);
      }
    } finally {
      if (id === reqId.current) setSearching(false);
    }
  }

  function onSearchInput(key, value) {
    setF((p) => ({ ...p, [key]: value }));
    setSource("");
    setDupes(null);
    clearTimeout(timer.current);

    const q = value.trim();
    if (q.length < (key === "accountNumber" ? 6 : 3)) {
      reqId.current++; // ignore any search still in flight
      setResults([]);
      setLookupMsg("");
      setSearching(false);
      return;
    }
    timer.current = setTimeout(() => runLookup(q), 600);
  }

  // ---------- MANUAL mode ----------
  function handlePaste(value) {
    setRaw(value);
    setDupes(null);
    if (!value.trim()) {
      setF(EMPTY);
      setChoice("");
      setOther("");
      return;
    }
    const p = parseRepairText(value);
    setF({ name: p.name, accountNumber: p.accountNumber, phone: p.phone, address: p.address });
    const m = matchConcern(p.concern);
    setChoice(m.choice);
    setOther(m.other);
  }

  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.value });
    setDupes(null);
  };

  function switchMode(m) {
    setMode(m);
    setResults([]);
    setLookupMsg("");
    setDupes(null);
  }

  // ---------- saving ----------
  async function save(force) {
    setError("");
    if (profile.role === "technician") {
      setError("Technicians can't create repairs.");
      return;
    }
    if (!f.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!choice) {
      setError("Choose a concern.");
      return;
    }
    if (choice === "OTHERS" && !other.trim()) {
      setError("Type the concern.");
      return;
    }

    setBusy(true);
    try {
      if (!force) {
        const found = await findDuplicates(f);
        if (found.length) {
          setDupes(found);
          setBusy(false);
          return;
        }
      }

      await addDoc(collection(db, "repairs"), {
        name: f.name.trim(),
        accountNumber: f.accountNumber.trim(),
        phone: f.phone.trim(),
        address: f.address.trim(),
        concern,
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
      onClose();
    } catch (err) {
      console.error(err);
      setError("Could not save. Check your connection and try again.");
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    save(false);
  }

  const hasOpen = dupes?.some((d) => d.status === "pending" || d.status === "in_progress");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>New repair</h3>
          <button type="button" className="icon-btn dark" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="scope mode-switch">
          <button type="button" className={`scope-btn ${mode === "auto" ? "active" : ""}`}
            onClick={() => switchMode("auto")}>
            Auto
          </button>
          <button type="button" className={`scope-btn ${mode === "manual" ? "active" : ""}`}
            onClick={() => switchMode("manual")}>
            Manual
          </button>
        </div>

        {mode === "auto" ? (
          <>
            <p className="muted small">
              Type an account number or an account name. The rest fills in from the customer portal.
            </p>

            <div className="two-col">
              <div>
                <label>Account number</label>
                <input value={f.accountNumber} inputMode="numeric" autoFocus
                  onChange={(e) => onSearchInput("accountNumber", e.target.value)} />
              </div>
              <div>
                <label>Account name</label>
                <input value={f.name}
                  onChange={(e) => onSearchInput("name", e.target.value)} />
              </div>
            </div>

            {searching && <p className="muted small">Searching the portal…</p>}
            {lookupMsg && <p className="note help-ask" style={{ marginTop: 10 }}>{lookupMsg}</p>}

            {results.length > 0 && (
              <ul className="lookup-list">
                {results.map((c, i) => (
                  <li key={`${c.source}-${c.accountNumber}-${i}`}>
                    <button type="button" className="lookup-item" onClick={() => pick(c)}>
                      <strong>{c.name}</strong>
                      <span className="small muted">{c.accountNumber} · {c.source}</span>
                      <span className="small muted">{c.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {source && <span className="source-tag">Filled from {source}</span>}

            <div className="two-col">
              <div>
                <label>Phone number</label>
                <input value={f.phone} onChange={set("phone")} inputMode="tel" />
              </div>
              <div>
                <label>Address</label>
                <input value={f.address} onChange={set("address")} />
              </div>
            </div>
          </>
        ) : (
          <>
            <label>Paste customer details</label>
            <textarea
              className="paste-box"
              placeholder={"Account Name\nPhone Number\nAccount Number\nAddress"}
              value={raw}
              onChange={(e) => handlePaste(e.target.value)}
            />
            <p className="muted small">The fields below fill in automatically. Check them before saving.</p>

            <label>Name</label>
            <input value={f.name} onChange={set("name")} />

            <div className="two-col">
              <div>
                <label>Account number</label>
                <input value={f.accountNumber} onChange={set("accountNumber")} inputMode="numeric" />
              </div>
              <div>
                <label>Phone number</label>
                <input value={f.phone} onChange={set("phone")} inputMode="tel" />
              </div>
            </div>

            <label>Address</label>
            <input value={f.address} onChange={set("address")} />
          </>
        )}

        <label>Concern</label>
        <div className="concern-chips">
          {CONCERNS.map((c) => (
            <button type="button" key={c}
              className={`concern-chip ${choice === c ? "active" : ""}`}
              onClick={() => setChoice(c)}>
              {c}
            </button>
          ))}
        </div>
        {choice === "OTHERS" && (
          <textarea rows={2} style={{ marginTop: 10 }} placeholder="Type the concern"
            value={other} onChange={(e) => setOther(e.target.value)} />
        )}

        {error && <div className="error">{error}</div>}

        {dupes && (
          <div className="dupe-warning">
            <div className="dupe-title">
              <AlertTriangle size={18} /> This customer may already have a repair
            </div>
            <p className="small">
              {hasOpen
                ? "A repair with the same details is still open."
                : "Repairs with the same details were added before."}
            </p>
            <ul>
              {dupes.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <strong>{d.name}</strong>{" "}
                  <span className={`badge ${STATUS[d.status]?.cls}`}>{STATUS[d.status]?.label}</span>
                  <div className="small muted clamp">
                    Same {d.reasons.join(" and ")} · {formatDate(d.createdAt)} · {d.concern}
                  </div>
                </li>
              ))}
            </ul>
            <p className="small" style={{ marginBottom: 0 }}>
              Do you still want to add this as a new repair?
            </p>
          </div>
        )}

        <div className="modal-actions">
          {dupes ? (
            <>
              <button type="button" className="btn" onClick={() => setDupes(null)}>
                Go back and edit
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save(true)}>
                {busy ? "Saving…" : "Add anyway"}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Checking…" : "Add repair"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}