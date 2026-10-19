import { PERIODS } from "../utils/analytics";

export const BLUE = "#2563eb";
export const OK_COLOR = "#12a36b"; // green
export const BAD_COLOR = "#f5b00a"; // yellow
const GRID = "#e2e9f5";
const MUTE = "#6b7a99";

const scale = (max) => {
  const ticks = Math.min(max, 4);
  const step = Math.ceil(max / ticks);
  return { ticks, step, top: step * ticks };
};

// Segmented control: Today / This week / ...
export function PeriodTabs({ value, onChange }) {
  return (
    <div className="period-tabs" role="tablist">
      {PERIODS.map(([key, label]) => (
        <button type="button" role="tab" aria-selected={value === key} key={key}
          className={`period-tab ${value === key ? "active" : ""}`}
          onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="chart-legend">
      {items.map(([label, color, value]) => (
        <span className="legend-chip" key={label}>
          <i className="legend-dot" style={{ background: color }} />
          {label} {value !== undefined && <strong>{value}</strong>}
        </span>
      ))}
    </div>
  );
}

function Axes({ W, H, L, R, T, ph, ticks, step, top }) {
  const y = (v) => T + ph - (v / top) * ph;
  return Array.from({ length: ticks + 1 }, (_, i) => i * step).map((v) => (
    <g key={v}>
      <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} />
      <text x={L - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fill={MUTE}>{v}</text>
    </g>
  ));
}

// AREA + LINE: repairs reported vs finished, over time (a flow)
export function AreaTrend({ data }) {
  const W = 720, H = 280, L = 34, R = 12, T = 16, B = 28;
  const pw = W - L - R, ph = H - T - B;
  const max = Math.max(1, ...data.flatMap((b) => [b.reported, b.finished]));
  const { ticks, step, top } = scale(max);
  const y = (v) => T + ph - (v / top) * ph;
  const x = (i) => (data.length === 1 ? L + pw / 2 : L + (pw * i) / (data.length - 1));
  const line = (k) => data.map((b, i) => `${i ? "L" : "M"}${x(i)},${y(b[k])}`).join(" ");
  const area = `${line("reported")} L${x(data.length - 1)},${T + ph} L${x(0)},${T + ph} Z`;
  const every = Math.ceil(data.length / 12);

  return (
    <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Repairs reported and finished over time">
      <defs>
        <linearGradient id="gReported" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.28" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <Axes {...{ W, H, L, R, T, ph, ticks, step, top }} />
      <path d={area} fill="url(#gReported)" />
      <path d={line("reported")} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinejoin="round" />
      <path d={line("finished")} fill="none" stroke={OK_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="6 4" />
      {data.map((b, i) => (
        <g key={i}>
          {data.length <= 24 && (
            <>
              <circle cx={x(i)} cy={y(b.reported)} r="3.5" fill="#fff" stroke={BLUE} strokeWidth="2" />
              <circle cx={x(i)} cy={y(b.finished)} r="3.5" fill="#fff" stroke={OK_COLOR} strokeWidth="2" />
            </>
          )}
          <rect x={x(i) - pw / data.length / 2} y={T} width={pw / data.length} height={ph} fill="transparent">
            <title>{`${b.label}: ${b.reported} reported, ${b.finished} finished`}</title>
          </rect>
          {i % every === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={MUTE}>{b.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// STACKED COLUMNS: successful + failed make up the total finished per slot
export function StackedColumns({ data }) {
  const W = 720, H = 280, L = 34, R = 8, T = 18, B = 28;
  const pw = W - L - R, ph = H - T - B;
  const max = Math.max(1, ...data.map((b) => b.ok + b.failed));
  const { ticks, step, top } = scale(max);
  const y = (v) => T + ph - (v / top) * ph;
  const slot = pw / data.length;
  const bw = Math.min(28, slot * 0.6);
  const every = Math.ceil(data.length / 12);

  return (
    <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Successful and failed repairs per time slot">
      <Axes {...{ W, H, L, R, T, ph, ticks, step, top }} />
      {data.map((b, i) => {
        const cx = L + slot * i + slot / 2;
        const total = b.ok + b.failed;
        return (
          <g key={i}>
            <rect x={L + slot * i} y={T} width={slot} height={ph} fill="transparent">
              <title>{`${b.label}: ${b.ok} successful, ${b.failed} failed`}</title>
            </rect>
            <g pointerEvents="none">
              {b.ok > 0 && <rect x={cx - bw / 2} y={y(b.ok)} width={bw} height={T + ph - y(b.ok)} fill={OK_COLOR} />}
              {b.failed > 0 && (
                <rect x={cx - bw / 2} y={y(total)} width={bw} height={y(b.ok) - y(total)} rx="3" fill={BAD_COLOR} />
              )}
              {total > 0 && (
                <text x={cx} y={y(total) - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f1b36">{total}</text>
              )}
            </g>
            {i % every === 0 && <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill={MUTE}>{b.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// DONUT: share of one whole (successful vs failed)
export function Donut({ parts, centerValue, centerLabel }) {
  const R = 54, C = 2 * Math.PI * R;
  const total = parts.reduce((s, p) => s + p.value, 0);
  const offsets = parts.map((_, i) => parts.slice(0, i).reduce((s, p) => s + (p.value / (total || 1)) * C, 0));

  return (
    <div className="donut-wrap">
      <svg className="donut-svg" viewBox="0 0 140 140" role="img" aria-label="Share of successful and failed repairs">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#e9eff9" strokeWidth="16" />
        {total > 0 && parts.map((p, i) => {
          const len = (p.value / total) * C;
          return p.value > 0 && (
            <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offsets[i]}
              transform="rotate(-90 70 70)" />
          );
        })}
        <text x="70" y="70" textAnchor="middle" fontSize="26" fontWeight="800" fill="#0f1b36">{centerValue}</text>
        <text x="70" y="88" textAnchor="middle" fontSize="10" fill={MUTE}>{centerLabel}</text>
      </svg>
      <div className="donut-legend">
        {parts.map((p) => (
          <div className="donut-item" key={p.label}>
            <i className="legend-dot" style={{ background: p.color }} />
            <span>{p.label}<br /><em>{total ? Math.round((p.value / total) * 100) : 0}% of finished</em></span>
            <strong>{p.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// HORIZONTAL BARS: ranking of categories (concerns)
export function BarList({ items, color }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <div className="hbar-list">
      {items.map((i) => (
        <div className="hbar-row" key={i.label}>
          <div className="hbar-meta">
            <div className="hbar-label">{i.label}</div>
            {i.sub && <div className="hbar-sub">{i.sub}</div>}
          </div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(i.value / max) * 100}%`, minWidth: i.value > 0 ? 4 : 0, ...(color ? { background: color } : {}) }} />
          </div>
          <div className="hbar-value">
            <strong>{i.value}</strong>
            <span>{total ? Math.round((i.value / total) * 100) : 0}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// VERTICAL COLUMNS: quantities of different items (materials)
export function ColumnChart({ items, colors = [BLUE, OK_COLOR, BAD_COLOR] }) {
  const W = 420, H = 260, L = 30, R = 8, T = 22, B = 34;
  const pw = W - L - R, ph = H - T - B;
  const max = Math.max(1, ...items.map((i) => i.value));
  const { ticks, step, top } = scale(max);
  const y = (v) => T + ph - (v / top) * ph;
  const slot = pw / items.length;
  const bw = Math.min(44, slot * 0.6);

  return (
    <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Materials used">
      <Axes {...{ W, H, L, R, T, ph, ticks, step, top }} />
      {items.map((it, i) => {
        const cx = L + slot * i + slot / 2;
        return (
          <g key={it.label}>
            <rect x={cx - bw / 2} y={y(it.value)} width={bw} height={T + ph - y(it.value)} rx="5" fill={colors[i % colors.length]} />
            <text x={cx} y={y(it.value) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f1b36">{it.value}</text>
            <text x={cx} y={H - 12} textAnchor="middle" fontSize="10" fill={MUTE}>{it.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
