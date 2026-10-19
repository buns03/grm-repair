import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDialog } from "./Dialog";
import { deleteRepair } from "../utils/repairActions";

export default function DeleteRepairButton({ r, compact = false, onDeleted }) {
  const { profile } = useAuth();
  const { confirm, notify } = useDialog();
  const [busy, setBusy] = useState(false);

  if (profile.role === "technician") return null;

  async function handle(e) {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete this repair?",
      message: `The repair for "${r.name}" will be permanently deleted, along with its comments and attempt history. This can't be undone.`,
      confirmText: "Delete",
      tone: "danger",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await deleteRepair(r.id);
      onDeleted?.();
    } catch (err) {
      console.error(err);
      await notify({
        title: "Couldn't delete the repair",
        message:
          err.code === "permission-denied"
            ? "You don't have permission to delete this repair."
            : err.message || "Something went wrong. Please try again.",
        tone: "error",
      });
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <button className="icon-btn dark danger-icon" title="Delete repair"
        disabled={busy} onClick={handle}>
        <Trash2 size={17} />
      </button>
    );
  }

  return (
    <button className="btn btn-danger btn-icon" disabled={busy} onClick={handle}>
      <Trash2 size={16} /> Delete repair
    </button>
  );
}