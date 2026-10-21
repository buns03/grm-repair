import { useEffect, useRef, useState } from "react";
import { Hash, MapPin, Phone, Send, User } from "lucide-react";
import Logo from "../components/Logo";

// const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const BASE = import.meta.env.VITE_API_URL ?? "";
const GREETING =
  "Hello and welcome to Glercimor Network OPC Support! I'm here to help with your internet connection. What issue are you experiencing today?";

function AccountCard({ c }) {
  return (
    <div className="sp-card">
      <div className="sp-card-name"><User size={16} /> {c.name || "—"}</div>
      <div className="meta">
        <span><Hash size={14} /> {c.accountNumber || "—"}</span>
        <span><Phone size={14} /> {c.phone || "—"}</span>
        <span><MapPin size={14} /> {c.address || "—"}</span>
      </div>
    </div>
  );
}

export default function Support() {
  const [sid] = useState(() => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
});
  const [msgs, setMsgs] = useState([{ from: "bot", text: GREETING }]);
  const [quick, setQuick] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  async function send(raw) {
    const t = raw.trim();
    if (!t || busy || done) return;
    setMsgs((m) => [...m, { from: "me", text: t }]);
    setText("");
    setQuick([]);
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/api/support/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, message: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMsgs((m) => [...m, ...data.replies.map((r) => ({ from: "bot", ...r }))]);
      setQuick(data.quick || []);
      setDone(!!data.done);
    } catch (err) {
      const msg = err instanceof TypeError ? "Sorry, I couldn't connect. Please try again." : err.message;
      setMsgs((m) => [...m, { from: "bot", text: msg }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sp-page">
      <div className="sp-chat">
        <header className="sp-head">
          <Logo size={42} />
          <div>
            <h1>Glercimor Network OPC</h1>
            <p>Customer Support</p>
          </div>
        </header>

        <div className="sp-body">
          {msgs.map((m, i) => (
            <div key={i} className={`sp-row ${m.from === "me" ? "me" : ""}`}>
              {m.card ? <AccountCard c={m.card} /> : <div className="sp-bubble">{m.text}</div>}
            </div>
          ))}
          {busy && (
            <div className="sp-row"><div className="sp-bubble typing">Typing…</div></div>
          )}
          <div ref={endRef} />
        </div>

        {quick.length > 0 && !busy && (
          <div className="sp-quick">
            {quick.map((q) => (
              <button key={q} type="button" className="chip" onClick={() => send(q)}>{q}</button>
            ))}
          </div>
        )}

        {done ? (
          <div className="sp-foot">
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => window.location.reload()}>
              Start a new chat
            </button>
          </div>
        ) : (
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input
              placeholder="Type your message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              autoFocus
              disabled={busy}
            />
            <button className="btn btn-primary btn-icon" disabled={busy || !text.trim()}>
              <Send size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}