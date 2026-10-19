import { useState } from "react";

// Uses /grm-logo.png (put your file in client/public/) and falls back to a built-in mark
export default function Logo({ size = 40 }) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <span className="logo-box" style={{ width: size, height: size }}>
        <img src="/grm-logo.png" alt="GRM" onError={() => setFailed(true)} />
      </span>
    );
  }

  return (
    <span className="logo-box fallback" style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size * 0.7} height={size * 0.7} aria-label="GRM">
        <text x="24" y="31" textAnchor="middle" fontFamily="Inter, Arial, sans-serif"
          fontWeight="900" fontSize="19" fill="#fff" letterSpacing="-0.5">GRM</text>
      </svg>
    </span>
  );
}