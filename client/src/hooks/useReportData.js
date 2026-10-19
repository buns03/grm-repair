import { useEffect, useState } from "react";
import { collection, collectionGroup, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

const toDate = (t) => t?.toDate?.() ?? null;

// Live repairs and attempt history, shared by the dashboard and leaderboard
export function useReportData() {
  const [repairs, setRepairs] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let gotRepairs = false;
    let gotAttempts = false;
    const check = () => {
      if (gotRepairs && gotAttempts) setLoading(false);
    };

    const offRepairs = onSnapshot(
      query(collection(db, "repairs"), orderBy("createdAt", "desc"), limit(2000)),
      (snap) => {
        setRepairs(
          snap.docs.map((d) => {
            const x = d.data({ serverTimestamps: "estimate" });
            return {
              id: d.id,
              ...x,
              createdAt: toDate(x.createdAt),
              takenAt: toDate(x.takenAt),
              completedAt: toDate(x.completedAt),
              scheduledFor: toDate(x.scheduledFor),
            };
          })
        );
        gotRepairs = true;
        check();
      },
      (err) => {
        console.error(err);
        setError("Could not load repairs.");
        gotRepairs = true;
        check();
      }
    );

    const offAttempts = onSnapshot(
      query(collectionGroup(db, "attempts"), limit(5000)),
      (snap) => {
        setAttempts(
          snap.docs.map((d) => {
            const x = d.data({ serverTimestamps: "estimate" });
            return {
              id: d.id,
              repairId: d.ref.parent.parent?.id ?? null,
              ...x,
              takenAt: toDate(x.takenAt),
              finishedAt: toDate(x.finishedAt),
            };
          })
        );
        gotAttempts = true;
        check();
      },
      (err) => {
        console.error(err);
        setError("Could not load the attempt history. Publish the Firestore rule from step 2 of the setup.");
        gotAttempts = true;
        check();
      }
    );

    return () => {
      offRepairs();
      offAttempts();
    };
  }, []);

  return { repairs, attempts, loading, error };
}