import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Plus, Pencil, X } from "lucide-react";
import { db } from "../firebase";
import { api } from "../utils/api";
import { useAuth } from "../context/AuthContext";

const ROLES = ["user", "technician", "admin"];

export default function Team() {
  const { profile } = useAuth();
  const [members, setMembers] = useState([]);
  const [modal, setModal] = useState(null); // { mode: "add" } or { mode: "edit", member }

  useEffect(() => {
    return onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setMembers(list);
    });
  }, []);

  return (
    <div>
      <div className="toolbar">
        <h2 className="page-title" style={{ margin: 0 }}>Team</h2>
        <button className="btn btn-primary btn-icon" onClick={() => setModal({ mode: "add" })}>
          <Plus size={18} /> Add account
        </button>
      </div>

      <div className="card list-card">
        {members.map((m) => (
          <div className="member-row" key={m.id}>
            <div className="avatar-sm">{m.name?.[0]?.toUpperCase() || "?"}</div>
            <div className="member-info">
              <strong>{m.name} {m.id === profile.id && <span className="muted">(you)</span>}</strong>
              <span className="muted small">{m.email}</span>
            </div>
            <span className={`badge role-${m.role}`}>{m.role}</span>
            <span className={`badge ${m.active === false ? "off" : "on"}`}>
              {m.active === false ? "Disabled" : "Active"}
            </span>
            <button className="icon-btn dark" onClick={() => setModal({ mode: "edit", member: m })} title="Edit">
              <Pencil size={18} />
            </button>
          </div>
        ))}
        {members.length === 0 && <p className="muted">No accounts yet.</p>}
      </div>

      {modal && (
        <AccountModal
          mode={modal.mode}
          member={modal.member}
          isSelf={modal.member?.id === profile.id}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function AccountModal({ mode, member, isSelf, onClose }) {
  const editing = mode === "edit";
  const [form, setForm] = useState({
    name: member?.name || "",
    email: member?.email || "",
    password: "",
    role: member?.role || "technician",
    active: member?.active !== false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (editing) {
        await api(`/api/users/${member.id}`, {
          method: "PATCH",
          body: {
            name: form.name,
            email: form.email,
            role: form.role,
            active: form.active,
            password: form.password || undefined,
          },
        });
      } else {
        await api("/api/users", {
          method: "POST",
          body: { name: form.name, email: form.email, password: form.password, role: form.role },
        });
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>{editing ? "Edit account" : "Add account"}</h3>
          <button type="button" className="icon-btn dark" onClick={onClose}><X size={20} /></button>
        </div>

        <label>Name</label>
        <input value={form.name} onChange={set("name")} required />

        <label>Email</label>
        <input type="email" value={form.email} onChange={set("email")} required />

        <label>{editing ? "New password (leave blank to keep)" : "Password"}</label>
        <input
          type="password"
          value={form.password}
          onChange={set("password")}
          required={!editing}
          minLength={form.password ? 6 : undefined}
          autoComplete="new-password"
        />

        <label>Role</label>
        <select value={form.role} onChange={set("role")} disabled={isSelf}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {editing && (
          <label className="check">
            <input type="checkbox" checked={form.active} onChange={set("active")} disabled={isSelf} />
            Account is active
          </label>
        )}
        {isSelf && <p className="muted small">You can't change your own role or disable yourself.</p>}

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}