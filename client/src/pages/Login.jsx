import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, Zap, Users, BarChart3 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";

export default function Login() {
  const { user, profile, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user && profile) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const wrong = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"];
      setError(wrong.includes(err.code) ? "Wrong email or password." : "Could not sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="auth-brand">
          <Logo size={52} />
          <span>GRM Repair Service</span>
        </div>

        <div className="auth-hero">
          <h2>Every repair, tracked from the first call to the fix.</h2>
          <p>One place for your team to log customer concerns, take jobs and follow up.</p>
          <ul>
            <li><span><Zap size={18} /></span>Customer details fill in automatically</li>
            <li><span><Users size={18} /></span>Technicians take jobs and ask for help live</li>
            <li><span><BarChart3 size={18} /></span>Reports and a leaderboard, exportable to PDF</li>
          </ul>
        </div>

        <p className="auth-foot">© {new Date().getFullYear()} GRM Repair Service</p>
      </aside>

      <main className="auth-main">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-logo-mobile"><Logo size={60} /></div>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to your account to continue.</p>

          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoFocus autoComplete="username" placeholder="you@example.com" />

          <label>Password</label>
          <div className="pw-field">
            <input type={show ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password" placeholder="Your password" />
            <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)}
              title={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}