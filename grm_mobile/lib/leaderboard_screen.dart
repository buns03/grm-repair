import 'package:flutter/material.dart';
import 'analytics.dart';
import 'report_data.dart';
import 'theme.dart';
import 'util.dart';
import 'widgets.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});
  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  String _period = 'month';

  @override
  Widget build(BuildContext context) {
    return ReportBuilder(builder: (context, repairs, attempts) {
      final now = DateTime.now();
      final done = attempts.where((a) => inPeriod(a.finishedAt, _period, now)).toList();
      final stats = techStats(done);
      final maxOk = stats.fold<int>(1, (m, t) => t.ok > m ? t.ok : m);
      const medals = [Color(0xFFF5B301), Color(0xFF9CA3AF), Color(0xFFB4713B)];

      return ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          PeriodTabs(value: _period, onChanged: (v) => setState(() => _period = v), items: periods),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Text('${periodLabel(_period, now)} · ranked by successful repairs',
                style: const TextStyle(color: kMuted, fontSize: 13)),
          ),
          if (stats.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: Text('No finished repairs in this period.', style: TextStyle(color: kMuted))),
            ),
          for (var i = 0; i < stats.length; i++)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Panel(
                child: Row(children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: i < 3 ? medals[i] : const Color(0xFFECECEA),
                    child: Text('${i + 1}',
                        style: TextStyle(fontWeight: FontWeight.w900, color: i < 3 ? Colors.white : kInk)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(stats[i].name, style: const TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: LinearProgressIndicator(
                            value: stats[i].ok / maxOk,
                            minHeight: 7,
                            color: kOrange,
                            backgroundColor: const Color(0xFFECECEA)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${stats[i].failed} failed · helped ${stats[i].helped} · ${stats[i].rate}% success · avg ${fmtDuration(stats[i].avgMs)}',
                        style: const TextStyle(color: kMuted, fontSize: 12),
                      ),
                    ]),
                  ),
                  const SizedBox(width: 10),
                  Column(children: [
                    Text('${stats[i].ok}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20)),
                    const Text('repaired', style: TextStyle(color: kMuted, fontSize: 11)),
                  ]),
                ]),
              ),
            ),
        ],
      );
    });
  }
}
