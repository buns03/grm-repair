import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Trash2, XCircle } from "lucide-react";

const Ctx = createContext(null);

// const { confirm, notify } = useDialog();
// if (await confirm({ title, message, confirmText, tone })) { ... }
// await notify({ title, message, tone })
export function useDialog() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDialog must be used inside <DialogProvider>");
  return c;
}

const TONES = {
  danger: { icon: Trash2, cls: "tone-danger" },
  warning: { icon: AlertTriangle, cls: "tone-warning" },
  success: { icon: CheckCircle2, cls: "tone-success" },
  error: { icon: XCircle, cls: "tone-danger" },
  info: { icon: Info, cls: "tone-info" },
};

export function DialogProvider({ children }) {
  const [dlg, setDlg] = useState(null);
  const resolver = useRef(null);

  const open = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setDlg(opts);
      }),
    []
  );

  const finish = useCallback((value) => {
    resolver.current?.(value);
    resolver.current = null;
    setDlg(null);
  }, []);

  useEffect(() => {
    if (!dlg) return;
    const onKey = (e) => {
      if (e.key === "Escape") finish(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dlg, finish]);

  const api = useMemo(
    () => ({
      confirm: (o) => open({ kind: "confirm", tone: "warning", ...o }),
      notify: (o) => open({ kind: "alert", tone: "info", ...o }),
    }),
    [open]
  );

  const tone = dlg ? TONES[dlg.tone] || TONES.info : null;
  const Icon = tone?.icon;
  const confirmCls =
    dlg?.tone === "danger" ? "btn btn-solid-danger" : dlg?.tone === "success" ? "btn btn-success" : "btn btn-primary";

  return (
    <Ctx.Provider value={api}>
      {children}

      {dlg && (
        <div className="dialog-backdrop" onClick={() => finish(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title"
            onClick={(e) => e.stopPropagation()}>
            <div className={`dialog-icon ${tone.cls}`}><Icon size={26} /></div>
            <h3 id="dlg-title">{dlg.title}</h3>
            {dlg.message && <p className="dialog-msg">{dlg.message}</p>}

            <div className="dialog-actions">
              {dlg.kind === "confirm" ? (
                <>
                  <button type="button" className="btn" onClick={() => finish(false)}>
                    {dlg.cancelText || "Cancel"}
                  </button>
                  <button type="button" className={confirmCls} autoFocus onClick={() => finish(true)}>
                    {dlg.confirmText || "Confirm"}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" autoFocus onClick={() => finish(true)}>
                  {dlg.okText || "OK"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}