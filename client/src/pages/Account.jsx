import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";

export default function Account() {
  const { profile, logout } = useAuth();
  const [name, setName] = useState(profile.name || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setMsg(null);
    if (password && password !== confirm) {
      setMsg({ type: "error", text: "Passwords don't match." });
      return;
    }
    setBusy(true);
    try {
      await api("/api/me", {
        method: "PATCH",
        body: { name, password: password || undefined },
      });
      if (password) {
        await logout(); // sign in again with the new password
        return;
      }
      setMsg({ type: "ok", text: "Saved." });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">My Account</h2>
      <form className="card form-card" onSubmit={save}>
        <label>Email</label>
        <input value={profile.email} disabled />

        <label>Role</label>
        <div><span className={`badge role-${profile.role}`}>{profile.role}</span></div>

        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />

        <label>New password <span className="muted">(leave blank to keep current)</span></label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />

        {password && (
          <>
            <label>Confirm new password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            <p className="muted small">You'll be signed out after changing your password.</p>
          </>
        )}

        {msg && <div className={msg.type === "ok" ? "success" : "error"}>{msg.text}</div>}

        <button className="btn btn-primary" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}