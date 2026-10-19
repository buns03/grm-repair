import { useMemo, useState } from "react";
import {
  CheckCircle2, ClipboardList, Clock, Download, Package, Percent, XCircle,
} from "lucide-react";
import { useReportData } from "../hooks/useReportData";
import {
  PERIODS, concernStats, flowTrend, inPeriod, materialStats, periodLabel, trend,
} from "../utils/analytics";
import {
  AreaTrend, BarList, ColumnChart, Donut, Legend, PeriodTabs, StackedColumns,
  BLUE, OK_COLOR, BAD_COLOR,
} from "../components/Charts";
import DateFilter from "../components/DateFilter";
import { fromInputDate, toInputDate } from "../utils/format";
import { exportDashboardPdf } from "../utils/pdfReport";

export default function Dashboard() {
  const { repairs, attempts, loading, error } = useReportData();
  const [period, setPeriod] = useState("month");
  const [date, setDate] = useState(""); // "" = use the period tabs
  const today = toInputDate(new Date());

  const view = useMemo(() => {
    const now = new Date();
    const ref = date ? fromInputDate(date) : now; // a picked date behaves like "that day"
    const eff = date ? "day" : period;
    const created = repairs.filter((r) => inPeriod(r.createdAt, eff, ref));
    const done = attempts.filter((a) => inPeriod(a.finishedAt, eff, ref));
    const ok = done.filter((a) => a.result === "successful").length;
    const failed = done.filter((a) => a.result === "failed").length;
    const byId = new Map(repairs.map((r) => [r.id, r]));
    const open = repairs.filter((r) => r.status === "pending" || r.status === "in_progress").length;

    return {
      periodName: date ? "Specific date" : PERIODS.find((p) => p[0] === period)[1],
      range: periodLabel(eff, ref),
      created: created.length,
      ok,
      failed,
      open,
      rate: ok + failed ? `${Math.round((ok / (ok + failed)) * 100)}%` : "—",
      flow: flowTrend(created, done, eff, ref),
      trend: trend(done, eff, ref),
      concerns: concernStats(created, done, byId),
      materials: materialStats(done).filter((m) => m.total > 0),
    };
  }, [repairs, attempts, period, date]);

  const pieces = view.materials.filter((m) => m.unit === "pcs");
  const meters = view.materials.filter((m) => m.unit === "m");
  const finished = view.ok + view.failed;
  const exportKey = date ? `date-${date}` : period;

  // [label, value, tone, help text, icon]  (the PDF uses the first three)
  const cards = [
    ["Repairs reported", view.created, "info", "New repairs added", ClipboardList],
    ["Successful", view.ok, "ok", "Fixed and closed", CheckCircle2],
    ["Failed attempts", view.failed, "bad", "Sent back to pending", XCircle],
    ["Success rate", view.rate, "brand", "Successful out of all finished", Percent],
    ["Open right now", view.open, "info", "Pending or in progress today", Clock],
  ];

  return (
    <div className="page">
      <div className="report-head">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-sub">{view.range}</p>
        </div>
        <button className="btn btn-primary btn-icon" disabled={loading}
          onClick={() =>
            exportDashboardPdf({
              period: exportKey,
              periodName: view.periodName,
              range: view.range,
              cards,
              trend: view.trend,
              concerns: view.concerns,
              materials: view.materials,
            })
          }>
          <Download size={16} /> Export PDF
        </button>
      </div>

      <div className="filter-bar">
        <PeriodTabs value={date ? "" : period} onChange={(p) => { setPeriod(p); setDate(""); }} />
        <DateFilter value={date} onChange={setDate} max={today} />
      </div>

      {error && <div className="error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && (
        <>
          <div className="stat-grid">
            {cards.map(([label, value, tone, help, Icon]) => (
              <div key={label} className={`stat-card ${tone}`}>
                <span className="stat-icon"><Icon size={20} /></span>
                <div className="stat-body">
                  <div className="num">{value}</div>
                  <div className="stat-label">{label}</div>
                  <div className="stat-help">{help}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="dash-grid">
            <section className="chart-card">
              <div className="chart-head">
                <div>
                  <h4>Reported vs finished</h4>
                  <p className="chart-sub">How the workload flows: new repairs coming in against repairs closed or attempted.</p>
                </div>
                <Legend items={[["Reported", BLUE, view.created], ["Finished", OK_COLOR, finished]]} />
              </div>
              {view.created + finished === 0
                ? <div className="chart-empty">Nothing was reported or finished in this period.</div>
                : <AreaTrend data={view.flow} />}
            </section>

            <section className="chart-card">
              <div className="chart-head">
                <div>
                  <h4>Outcome of finished repairs</h4>
                  <p className="chart-sub">Successful against failed attempts.</p>
                </div>
              </div>
              {finished === 0
                ? <div className="chart-empty">No repairs were finished in this period.</div>
                : <Donut centerValue={view.rate} centerLabel="success rate"
                    parts={[
                      { label: "Successful", value: view.ok, color: OK_COLOR },
                      { label: "Failed", value: view.failed, color: BAD_COLOR },
                    ]} />}
              <p className="chart-note">A failed repair returns to pending for the next day, so one repair can fail more than once.</p>
            </section>
          </div>

          <div className="dash-grid">
            <section className="chart-card">
              <div className="chart-head">
                <div>
                  <h4>Results per time slot</h4>
                  <p className="chart-sub">Each column is the total finished, split into successful and failed.</p>
                </div>
                <Legend items={[["Successful", OK_COLOR], ["Failed", BAD_COLOR]]} />
              </div>
              {finished === 0
                ? <div className="chart-empty">No repairs were finished in this period.</div>
                : <StackedColumns data={view.trend} />}
            </section>

            <section className="chart-card">
              <div className="chart-head">
                <div>
                  <h4>Repairs by concern</h4>
                  <p className="chart-sub">What customers reported most. Percent is the share of all repairs reported.</p>
                </div>
              </div>
              <BarList items={view.concerns} />
            </section>
          </div>

          <section className="chart-card">
            <div className="chart-head">
              <div>
                <h4>Materials used</h4>
                <p className="chart-sub">
                  Totals from successful repairs. Pieces are charted together; FOC is in meters, so it is shown separately.
                </p>
              </div>
            </div>

            {view.materials.length === 0 ? (
              <div className="chart-empty">No materials were recorded in this period.</div>
            ) : (
              <>
                <div className="mat-grid">
                  {view.materials.map((m) => (
                    <div key={m.key} className="stat-card info">
                      <span className="stat-icon"><Package size={20} /></span>
                      <div className="stat-body">
                        <div className="num">{m.total}{m.unit === "m" ? " m" : ""}</div>
                        <div className="stat-label">{m.label}</div>
                        <div className="stat-help">Used in {m.jobs} repair{m.jobs === 1 ? "" : "s"}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {pieces.length > 0 && (
                  <div className="mat-split">
                    <ColumnChart items={pieces.map((m) => ({ label: m.label, value: m.total }))} />
                    <BarList color={BLUE}
                      items={pieces.map((m) => ({
                        label: m.label, value: m.total, sub: `${m.jobs} repair${m.jobs === 1 ? "" : "s"}`,
                      }))} />
                  </div>
                )}
                {pieces.length === 0 && meters.length > 0 && (
                  <p className="muted small">Only FOC was used in this period.</p>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
