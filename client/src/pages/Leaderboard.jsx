import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useReportData } from "../hooks/useReportData";
import { PERIODS, inPeriod, periodLabel, techStats } from "../utils/analytics";
import { PeriodTabs } from "../components/Charts";
import { formatDuration } from "../utils/format";
import { exportLeaderboardPdf } from "../utils/pdfReport";

export default function Leaderboard() {
  const { attempts, loading, error } = useReportData();
  const [period, setPeriod] = useState("month");

  const view = useMemo(() => {
    const now = new Date();
    const done = attempts.filter((a) => inPeriod(a.finishedAt, period, now));
    return {
      periodName: PERIODS.find((p) => p[0] === period)[1],
      range: periodLabel(period, now),
      stats: techStats(done),
    };
  }, [attempts, period]);

  const maxOk = Math.max(1, ...view.stats.map((t) => t.ok));

  return (
    <div>
      <div className="report-head">
        <h2 className="page-title" style={{ margin: 0 }}>Leaderboard</h2>
        <button className="btn btn-primary btn-icon" disabled={loading}
          onClick={() => exportLeaderboardPdf({ period, ...view })}>
          <Download size={16} /> Export PDF
        </button>
      </div>
      <p className="muted small">{view.range} · ranked by successful repairs</p>

      <PeriodTabs value={period} onChange={setPeriod} />

      {error && <div className="error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && view.stats.length === 0 && (
        <div className="card empty muted">No finished repairs in this period.</div>
      )}

      <ol className="rank-list">
        {view.stats.map((t, i) => (
          <li key={t.id} className={`rank-item ${i < 3 ? `top-${i + 1}` : ""}`}>
            <span className="rank-no">{i + 1}</span>
            <div>
              <div className="rank-name">{t.name}</div>
              <div className="rank-track">
                <div className="rank-fill" style={{ width: `${(t.ok / maxOk) * 100}%` }} />
              </div>
              <div className="small muted">
                {t.failed} failed · helped {t.helped} · {t.rate}% success · avg {formatDuration(t.avgMs)}
              </div>
            </div>
            <div className="rank-score">
              <strong>{t.ok}</strong>
              <span className="small muted">repaired</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}