import { UserCheck, LifeBuoy, Clock } from "lucide-react";
import { formatDateTime } from "../utils/format";

export default function Assignees({ r }) {
  if (!r.takenBy) {
    return <div className="assign none">Waiting for a technician</div>;
  }

  const inProgress = r.status === "in_progress";

  return (
    <div className="assign">
      <span className="who">
        <UserCheck size={14} /> {inProgress ? "Taken by" : "Handled by"}{" "}
        <strong>{r.takenByName}</strong>
      </span>

      {r.takenAt && (
        <span className="who"><Clock size={14} /> Taken {formatDateTime(r.takenAt)}</span>
      )}
      {r.completedAt && (
        <span className="who"><Clock size={14} /> Finished {formatDateTime(r.completedAt)}</span>
      )}

      {r.helperId ? (
        <span className="who">
          <LifeBuoy size={14} /> Helped by <strong>{r.helperName}</strong>
        </span>
      ) : inProgress && r.helpRequested ? (
        <span className="who help-ask">
          <LifeBuoy size={14} /> Needs help
        </span>
      ) : null}
    </div>
  );
}