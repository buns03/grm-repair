import { isSameDay } from "./format";

// True when a repair was added, scheduled, taken or completed on that day
export const isOnDate = (r, day) =>
  isSameDay(r.createdAt, day) ||
  isSameDay(r.scheduledFor, day) ||
  isSameDay(r.takenAt, day) ||
  isSameDay(r.completedAt, day);