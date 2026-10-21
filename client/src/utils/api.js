import { auth } from "../firebase";

// const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const BASE = import.meta.env.VITE_API_URL ?? "";

async function send(path, method, body, forceRefresh) {
  const headers = { "Content-Type": "application/json" };
  if (auth.currentUser) {
    headers.Authorization = `Bearer ${await auth.currentUser.getIdToken(forceRefresh)}`;
  }
  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await send(path, method, body, false);
    if (res.status === 401 && auth.currentUser) {
      res = await send(path, method, body, true); // retry once with a fresh token
      if (res.status === 401) await auth.signOut(); // really invalid: back to login
    }
  } catch {
    throw new Error("Cannot reach the server. Is it running?");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}