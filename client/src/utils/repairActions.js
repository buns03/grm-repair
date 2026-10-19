import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { tomorrowStart } from "./format";

// Re-reads the live repair right before writing, so two technicians
// can never both take the same task or the same help request.
async function run(id, check, buildUpdate) {
  const ref = doc(db, "repairs", id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("This repair no longer exists.");
    const r = snap.data();
    const problem = check(r);
    if (problem) throw new Error(problem);
    tx.update(ref, buildUpdate(r));
  });
}

export const takeRepair = (id, me) =>
  run(
    id,
    (r) =>
      r.status !== "pending" || r.takenBy
        ? `Already taken by ${r.takenByName || "another technician"}.`
        : r.scheduledFor && r.scheduledFor.toMillis() > Date.now()
        ? "This repair is scheduled for a later date."
        : null,
    () => ({
      status: "in_progress",
      takenBy: me.id,
      takenByName: me.name,
      takenAt: serverTimestamp(),
    })
  );

export const askHelp = (id, me) =>
  run(
    id,
    (r) =>
      r.takenBy !== me.id || r.status !== "in_progress"
        ? "You can only ask for help on your own task."
        : r.helpRequested
        ? "Help was already requested."
        : null,
    () => ({ helpRequested: true, helpRequestedAt: serverTimestamp() })
  );

export const cancelHelp = (id, me) =>
  run(
    id,
    (r) =>
      r.takenBy !== me.id
        ? "This isn't your task."
        : r.helperId
        ? `${r.helperName} already joined.`
        : null,
    () => ({ helpRequested: false, helpRequestedAt: null })
  );

export const takeHelp = (id, me) =>
  run(
    id,
    (r) =>
      !r.helpRequested || r.status !== "in_progress"
        ? "Help is no longer needed."
        : r.helperId
        ? `${r.helperName} already took this.`
        : r.takenBy === me.id
        ? "You can't help on your own task."
        : null,
    () => ({
      helperId: me.id,
      helperName: me.name,
      helpTakenAt: serverTimestamp(),
    })
  );

export const releaseRepair = (id, me) =>
  run(
    id,
    (r) =>
      r.takenBy !== me.id || r.status !== "in_progress"
        ? "This isn't your task."
        : r.helperId
        ? "A helper already joined. Mark it successful or failed instead."
        : null,
    () => ({
      status: "pending",
      takenBy: null,
      takenByName: null,
      takenAt: null,
      helpRequested: false,
      helpRequestedAt: null,
      helperId: null,
      helperName: null,
      helpTakenAt: null,
    })
  );

// Success or failure: always logs an attempt with taken + finished times.
// A failure sends the repair back to pending, scheduled for tomorrow.
export async function finishRepair(id, me, success, materials = {}) {
  // keep only the materials that were actually used (> 0)
  const used = Object.fromEntries(
    Object.entries(materials || {}).filter(([, v]) => Number(v) > 0)
  );
  const hasMaterials = success && Object.keys(used).length > 0;

  const ref = doc(db, "repairs", id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("This repair no longer exists.");
    const r = snap.data();
    if (r.takenBy !== me.id || r.status !== "in_progress") {
      throw new Error("Only the technician who took this can finish it.");
    }

    tx.set(doc(collection(ref, "attempts")), {
      techId: me.id,
      techName: me.name,
      helperId: r.helperId ?? null,
      helperName: r.helperName ?? null,
      result: success ? "successful" : "failed",
      ...(hasMaterials ? { materials: used } : {}),
      takenAt: r.takenAt,
      finishedAt: serverTimestamp(),
    });

    if (success) {
      tx.update(ref, {
        status: "successful",
        completedAt: serverTimestamp(),
        ...(hasMaterials ? { materials: used } : {}),
      });
    } else {
      tx.update(ref, {
        status: "pending",
        takenBy: null,
        takenByName: null,
        takenAt: null,
        helpRequested: false,
        helpRequestedAt: null,
        helperId: null,
        helperName: null,
        helpTakenAt: null,
        scheduledFor: Timestamp.fromDate(tomorrowStart()),
        failedAttempts: (r.failedAttempts || 0) + 1,
      });
    }
  });
}

// Admin: set or clear (null) the schedule of a pending repair
export const setSchedule = (id, date) =>
  updateDoc(doc(db, "repairs", id), {
    scheduledFor: date ? Timestamp.fromDate(date) : null,
  });

// Deletes a repair together with its comments and attempt history
export async function deleteRepair(id) {
  const ref = doc(db, "repairs", id);
  const [comments, attempts] = await Promise.all([
    getDocs(collection(ref, "comments")),
    getDocs(collection(ref, "attempts")),
  ]);

  const children = [...comments.docs, ...attempts.docs];
  if (children.length > 450) {
    throw new Error("This repair has too many comments to delete at once.");
  }

  // One batch, so the repair and its history disappear together
  const batch = writeBatch(db);
  children.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();
}