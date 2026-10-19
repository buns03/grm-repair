export const CONCERNS = [
  "RED LOS",
  "NO INTERNET CONNECTION",
  "INTERMITTENT CONNECTION",
  "CHANGE/FORGOT PASSWORD",
  "SLOW BROWSE",
  "OTHERS",
];

const ALIASES = {
  "RED LOS": ["RED LOS", "LOS", "LOS RED"],
  "NO INTERNET CONNECTION": ["NO INTERNET CONNECTION", "NO INTERNET", "NO CONNECTION"],
  "INTERMITTENT CONNECTION": [
    "INTERMITTENT CONNECTION", "INTERMITTENT", "INTERMITTENT INTERNET", "ON AND OFF",
  ],
  "CHANGE/FORGOT PASSWORD": [
    "CHANGE/FORGOT PASSWORD", "CHANGE PASSWORD", "FORGOT PASSWORD", "CHANGE/FORGOT PW",
  ],
  "SLOW BROWSE": ["SLOW BROWSE", "SLOW BROWSING", "SLOW INTERNET", "SLOW CONNECTION"],
};

// Turns pasted concern text into one of the fixed options
// Anything that isn't an exact match becomes OTHERS with the original text
export function matchConcern(text) {
  const raw = (text || "").trim();
  if (!raw) return { choice: "", other: "" };
  const t = raw.toUpperCase().replace(/\s+/g, " ");
  for (const [label, names] of Object.entries(ALIASES)) {
    if (names.includes(t)) return { choice: label, other: "" };
  }
  return { choice: "OTHERS", other: raw };
}