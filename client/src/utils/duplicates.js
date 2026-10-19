import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase";

// 09171234567, 639171234567 and +639171234567 are the same number
function phoneVariants(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return [];
  const core = digits.startsWith("63")
    ? digits.slice(2)
    : digits.startsWith("0")
    ? digits.slice(1)
    : digits;
  if (core.length !== 10) return [raw.trim()];
  return [`0${core}`, `63${core}`, `+63${core}`];
}

// Finds existing repairs with the same account number or phone number
export async function findDuplicates({ accountNumber, phone }) {
  const found = new Map();

  const add = (snap, reason) => {
    snap.forEach((d) => {
      const prev = found.get(d.id);
      if (prev) {
        prev.reasons.add(reason);
        return;
      }
      const x = d.data();
      found.set(d.id, {
        id: d.id,
        name: x.name,
        status: x.status,
        concern: x.concern,
        createdAt: x.createdAt?.toDate?.() ?? null,
        reasons: new Set([reason]),
      });
    });
  };

  const acct = (accountNumber || "").trim();
  if (acct) {
    add(
      await getDocs(
        query(collection(db, "repairs"), where("accountNumber", "==", acct), limit(10))
      ),
      "account number"
    );
  }

  const phones = phoneVariants(phone);
  if (phones.length) {
    add(
      await getDocs(
        query(collection(db, "repairs"), where("phone", "in", phones), limit(10))
      ),
      "phone number"
    );
  }

  return [...found.values()]
    .map((m) => ({ ...m, reasons: [...m.reasons] }))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}