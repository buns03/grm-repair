export const MATERIALS = [
  { key: "fic_blue", label: "FIC Blue", unit: "pcs", required: false },
  { key: "fic_green", label: "FIC Green", unit: "pcs", required: false },
  { key: "foc", label: "FOC", unit: "m", required: false },
  { key: "modem", label: "MODEM", unit: "pcs", required: false },
  { key: "adapter", label: "ADAPTER", unit: "pcs", required: false },
];

export function formatMaterials(m) {
  if (!m) return "";
  return MATERIALS.filter((x) => (Number(m[x.key]) || 0) > 0)
    .map((x) => (x.key === "foc" ? `${x.label} ${m[x.key]} m` : `${x.label} × ${m[x.key]}`))
    .join(" · ");
}