import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MATERIALS } from "../utils/materials";

const EMPTY = Object.fromEntries(MATERIALS.map((m) => [m.key, ""]));

export default function MaterialsDialog({ repair, busy, error, onCancel, onSubmit }) {
  const [vals, setVals] = useState(EMPTY);
  const [localError, setLocalError] = useState("");

  function submit(e) {
    e.preventDefault();
    e.stopPropagation();
    const out = {};
    for (const m of MATERIALS) {
      const raw = String(vals[m.key]).trim();
      if (!raw) {
        if (m.required) {
          setLocalError(`Enter the ${m.label} quantity (type 0 if none was used).`);
          return;
        }
        out[m.key] = 0; // FOC is optional
        continue;
      }
      const n = Number(raw);
      const wholeOnly = m.unit === "pcs";
      if (!Number.isFinite(n) || n < 0 || (wholeOnly && !Number.isInteger(n))) {
        setLocalError(`${m.label} must be ${wholeOnly ? "a whole number" : "a number"}, 0 or more.`);
        return;
      }
      out[m.key] = n;
    }
    setLocalError("");
    onSubmit(out);
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>Materials used</h3>
          <button type="button" className="icon-btn dark" onClick={onCancel}><X size={20} /></button>
        </div>

        <p className="muted small">
          Enter what was used for <strong>{repair.name}</strong>. This repair will be closed as
          successful and can't be undone.
        </p>

        <div className="two-col">
          {MATERIALS.map((m) => (
            <div key={m.key}>
              <label>
                {m.label} ({m.unit === "m" ? "meters" : "qty"})
                {!m.required && <span className="muted"> · optional</span>}
              </label>
              <input
                type="number"
                min="0"
                step={m.unit === "m" ? "0.1" : "1"}
                inputMode={m.unit === "m" ? "decimal" : "numeric"}
                placeholder="0"
                value={vals[m.key]}
                onChange={(e) => setVals({ ...vals, [m.key]: e.target.value })}
              />
            </div>
          ))}
        </div>

        {(localError || error) && <div className="error">{localError || error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-success" disabled={busy}>
            {busy ? "Saving…" : "Mark successful"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}