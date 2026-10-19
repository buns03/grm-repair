import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useDialog } from "./Dialog";
import MaterialsDialog from "./MaterialsDialog";
import { formatDate, isScheduledLater } from "../utils/format";
import {
  askHelp, cancelHelp, finishRepair, releaseRepair, takeHelp, takeRepair,
} from "../utils/repairActions";

const CONFIRM_FAILED = {
  title: "Mark as failed?",
  message: "It goes back to pending and is rescheduled for tomorrow. This attempt will be logged.",
  confirmText: "Mark failed",
  tone: "danger",
};
const CONFIRM_RELEASE = {
  title: "Release this task?",
  message: "Another technician will be able to take it.",
  confirmText: "Release",
  tone: "warning",
};

const friendly = (err) =>
  err.code === "permission-denied"
    ? "Someone just changed this task. Please check it again."
    : err.message;

export default function RepairActions({ r, compact = false }) {
  const { profile } = useAuth();
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [askMaterials, setAskMaterials] = useState(false);
  const [matError, setMatError] = useState("");

  if (profile.role !== "technician") return null;

  const mine = r.takenBy === profile.id;
  const inProgress = r.status === "in_progress";
  const waiting = r.status === "pending" && !r.takenBy && isScheduledLater(r);
  const unclaimed = r.status === "pending" && !r.takenBy && !isScheduledLater(r);
  const needsHelp = inProgress && r.helpRequested && !r.helperId;

  const go = (fn, confirmOpts) => async (e) => {
    e.stopPropagation();
    if (confirmOpts && !(await confirm(confirmOpts))) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  // Called by the materials popup
async function submitSuccess(materials) {
  setBusy(true);
  setMatError("");
  try {
    await finishRepair(r.id, profile, true, materials);
    setAskMaterials(false);
  } catch (err) {
    console.error(err);
    setMatError(
      err.code === "permission-denied"
        ? "Blocked by the database rules. Make sure the latest Firestore rules are published."
        : friendly(err)
    );
  } finally {
    setBusy(false);
  }
}

  // Quick buttons shown on the list cards
  if (compact) {
    if (!unclaimed && !(needsHelp && !mine)) return null;
    return (
      <div className="actions card-actions">
        {unclaimed && (
          <button className="btn btn-primary btn-sm" disabled={busy}
            onClick={go(() => takeRepair(r.id, profile))}>
            Take repair
          </button>
        )}
        {needsHelp && !mine && (
          <button className="btn btn-help btn-sm" disabled={busy}
            onClick={go(() => takeHelp(r.id, profile))}>
            Help {r.takenByName}
          </button>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  // Full set shown in the details panel
  return (
    <div className="actions">
      {waiting && (
        <p className="note">
          Scheduled for {formatDate(r.scheduledFor)}. It can be taken from that day.
        </p>
      )}

      {unclaimed && (
        <button className="btn btn-primary" disabled={busy}
          onClick={go(() => takeRepair(r.id, profile))}>
          Take this repair
        </button>
      )}

      {inProgress && mine && (
        <>
          <div className="actions-row">
            <button className="btn btn-success" disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                setMatError("");
                setAskMaterials(true);
              }}>
              Mark successful
            </button>
            <button className="btn btn-danger" disabled={busy}
              onClick={go(() => finishRepair(r.id, profile, false), CONFIRM_FAILED)}>
              Mark failed
            </button>
          </div>

          {!r.helpRequested && (
            <button className="btn" disabled={busy}
              onClick={go(() => askHelp(r.id, profile))}>
              Ask for help
            </button>
          )}

          {needsHelp && (
            <>
              <p className="note help-ask">Waiting for another technician to help…</p>
              <button className="btn" disabled={busy}
                onClick={go(() => cancelHelp(r.id, profile))}>
                Cancel help request
              </button>
            </>
          )}

          {r.helperId && <p className="note">{r.helperName} is helping you.</p>}

          {!r.helperId && (
            <button className="link-btn" disabled={busy}
              onClick={go(() => releaseRepair(r.id, profile), CONFIRM_RELEASE)}>
              Release task
            </button>
          )}
        </>
      )}

      {inProgress && !mine && (
        <>
          <p className="note">
            Taken by <strong>{r.takenByName}</strong>. Only they can mark it done.
          </p>
          {needsHelp && (
            <button className="btn btn-help" disabled={busy}
              onClick={go(() => takeHelp(r.id, profile))}>
              Help {r.takenByName}
            </button>
          )}
          {r.helperId === profile.id && (
            <p className="note">You're helping {r.takenByName} with this one.</p>
          )}
          {r.helperId && r.helperId !== profile.id && (
            <p className="note">{r.helperName} is already helping.</p>
          )}
        </>
      )}

      {error && <div className="error">{error}</div>}

      {askMaterials && (
        <MaterialsDialog
          repair={r}
          busy={busy}
          error={matError}
          onCancel={() => !busy && setAskMaterials(false)}
          onSubmit={submitSuccess}
        />
      )}
    </div>
  );
}