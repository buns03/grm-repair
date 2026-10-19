export function parseRepairText(raw) {
  const text = raw.replace(/\r/g, "").trim();
  const match = /^\s*concern\s*:?/im.exec(text);

  const head = match ? text.slice(0, match.index) : text;
  const concern = match
    ? text.slice(match.index + match[0].length).trim()
    : "";

  const lines = head.split("\n").map((l) => l.trim()).filter(Boolean);

  let name = "";
  let phone = "";
  let accountNumber = "";
  const addressParts = [];

  for (const line of lines) {
    const compact = line.replace(/[\s-]/g, "");
    const isNumber = /^\+?\d+$/.test(compact);

    if (isNumber && !phone && /^(\+?63|0)9\d{9}$/.test(compact)) {
      phone = compact;
    } else if (isNumber && !accountNumber) {
      accountNumber = compact;
    } else if (!name) {
      name = line;
    } else {
      addressParts.push(line);
    }
  }

  return { name, accountNumber, phone, address: addressParts.join(", "), concern };
}