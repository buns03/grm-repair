import 'package:flutter/material.dart';
import 'analytics.dart';
import 'charts.dart';
import 'date_filter.dart';
import 'report_data.dart';
import 'theme.dart';
import 'widgets.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String _period = 'month';
  DateTime? _date; // null = use the period tabs

  Widget _stat(String label, String value, String help, IconData icon, Color color, double w) {
    return SizedBox(
      width: w,
      child: Panel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(height: 12),
          Text(value,
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: kInk, height: 1.05)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: kInk)),
          Text(help, style: const TextStyle(color: kMuted, fontSize: 11.5)),
        ]),
      ),
    );
  }

  Widget _card(String title, String sub, Widget body, {Widget? legend, String? note}) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
        child: Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: kInk)),
            const SizedBox(height: 2),
            Text(sub, style: const TextStyle(color: kMuted, fontSize: 12.5)),
            if (legend != null) ...[const SizedBox(height: 12), legend],
            const SizedBox(height: 14),
            body,
            if (note != null) ...[
              const SizedBox(height: 10),
              Text(note, style: const TextStyle(color: kMuted, fontSize: 11.5)),
            ],
          ]),
        ),
      );

  Widget _empty(String t) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 28),
        child: Center(child: Text(t, style: const TextStyle(color: kMuted))),
      );

  @override
  Widget build(BuildContext context) {
    return ReportBuilder(builder: (context, repairs, attempts) {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final ref = _date ?? now; // a picked date behaves like "that day"
      final eff = _date != null ? 'day' : _period;

      final created = repairs.where((r) => inPeriod(r.createdAt, eff, ref)).toList();
      final done = attempts.where((a) => inPeriod(a.finishedAt, eff, ref)).toList();
      final ok = done.where((a) => a.result == 'successful').length;
      final failed = done.where((a) => a.result == 'failed').length;
      final finished = ok + failed;
      final byId = {for (final r in repairs) r.id: r};
      final open = repairs.where((r) => r.status == 'pending' || r.status == 'in_progress').length;
      final rate = finished > 0 ? '${(ok / finished * 100).round()}%' : '—';
      final flow = flowTrend(created, done, eff, ref);
      final tr = trend(done, eff, ref);
      final cs = concernStats(created, done, byId);
      final mats = materialStats(done).where((m) => m.total > 0).toList();
      final pieces = mats.where((m) => m.item.unit == 'pcs').toList();
      final w = (MediaQuery.of(context).size.width - 32 - 12) / 2;

      return ListView(
        padding: const EdgeInsets.only(bottom: 28),
        children: [
          PeriodTabs(
            value: _date != null ? '' : _period,
            onChanged: (v) => setState(() {
              _period = v;
              _date = null;
            }),
            items: periods,
            trailing: DatePill(value: _date, lastDate: today, onChanged: (d) => setState(() => _date = d)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: Text(periodLabel(eff, ref), style: const TextStyle(color: kMuted, fontWeight: FontWeight.w600)),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(spacing: 12, runSpacing: 12, children: [
              _stat('Repairs reported', '${created.length}', 'New repairs added', Icons.assignment_outlined, kBlue, w),
              _stat('Successful', '$ok', 'Fixed and closed', Icons.check_circle_outline, kOk, w),
              _stat('Failed attempts', '$failed', 'Sent back to pending', Icons.replay, kYellow, w),
              _stat('Success rate', rate, 'Out of all finished', Icons.percent, kNavy, w),
              _stat('Open right now', '$open', 'Pending or in progress', Icons.schedule, kBlue, w),
            ]),
          ),
          _card(
            'Reported vs finished',
            'New repairs coming in against repairs attempted.',
            created.isEmpty && finished == 0
                ? _empty('Nothing was reported or finished in this period.')
                : AreaTrendChart(data: flow),
            legend: Legend([(kBlue, 'Reported ${created.length}'), (kOk, 'Finished $finished')]),
          ),
          _card(
            'Outcome of finished repairs',
            'Successful against failed attempts.',
            finished == 0
                ? _empty('No repairs were finished in this period.')
                : DonutChart(
                    centerValue: rate,
                    centerLabel: 'success rate',
                    parts: [(kOk, 'Successful', ok), (kYellow, 'Failed', failed)],
                  ),
            note: 'A failed repair returns to pending for the next day, so one repair can fail more than once.',
          ),
          _card(
            'Results per time slot',
            'Each column is the total finished, split into successful and failed.',
            finished == 0
                ? _empty('No repairs were finished in this period.')
                : StackedColumns(data: tr),
            legend: const Legend([(kOk, 'Successful'), (kYellow, 'Failed')]),
          ),
          _card(
            'Repairs by concern',
            'What customers reported most. Percent is the share of all repairs reported.',
            BarList(items: [for (final c in cs) BarItem(c.label, c.value, '${c.ok} successful · ${c.failed} failed')]),
          ),
          _card(
            'Materials used',
            "Totals from successful repairs. FOC is in meters, so it's shown separately.",
            mats.isEmpty
                ? _empty('No materials were recorded in this period.')
                : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (pieces.isNotEmpty)
                      ColumnChart(items: [for (final m in pieces) BarItem(m.item.label, m.total)]),
                    const SizedBox(height: 8),
                    Wrap(spacing: 12, runSpacing: 12, children: [
                      for (final m in mats)
                        _stat(m.item.label, '${m.total}${m.item.unit == 'm' ? ' m' : ''}',
                            'Used in ${m.jobs} repair${m.jobs == 1 ? '' : 's'}', Icons.inventory_2_outlined,
                            m.item.unit == 'm' ? kYellow : kBlue, w - 16),
                    ]),
                  ]),
          ),
        ],
      );
    });
  }
}