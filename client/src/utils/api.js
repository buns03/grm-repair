
import { auth } from "../firebase";

// const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const BASE = import.meta.env.VITE_API_URL ?? "";

export async function api(path, { method = "GET", body } = {}) {
  let token = null;

  // Add Firebase token only when a user is signed in.
  if (auth.currentUser) {
    token = await auth.currentUser.getIdToken();
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;

  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is it running?");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}
