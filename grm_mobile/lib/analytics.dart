import 'package:intl/intl.dart';
import 'models.dart';
import 'util.dart';

const periods = [
  ('day', 'Today'),
  ('week', 'This week'),
  ('month', 'This month'),
  ('year', 'This year'),
  ('all', 'All time'),
];

DateTime? periodStart(String p, DateTime now) {
  final today = DateTime(now.year, now.month, now.day);
  switch (p) {
    case 'day':
      return today;
    case 'week': // weeks start on Monday
      return DateTime(today.year, today.month, today.day - (today.weekday - 1));
    case 'month':
      return DateTime(now.year, now.month, 1);
    case 'year':
      return DateTime(now.year, 1, 1);
    default:
      return null;
  }
}

String periodLabel(String p, DateTime now) {
  switch (p) {
    case 'day':
      return DateFormat('EEEE, MMMM d, y').format(now);
    case 'week':
      return '${DateFormat('MMM d').format(periodStart('week', now)!)} to ${DateFormat('MMM d, y').format(now)}';
    case 'month':
      return DateFormat('MMMM y').format(now);
    case 'year':
      return '${now.year}';
    default:
      return 'All time';
  }
}

bool inPeriod(DateTime? d, String p, DateTime now) {
  if (d == null) return false;
  final s = periodStart(p, now);
  if (p == 'day') {
    return !d.isBefore(s!) && d.isBefore(DateTime(s.year, s.month, s.day + 1));
  }
  return s == null || !d.isBefore(s);
}

class Bucket {
  final DateTime start, end;
  final String label;
  int ok = 0, failed = 0, reported = 0, finished = 0;
  Bucket(this.start, this.end, this.label);
}

List<Bucket> _buildBuckets(String p, DateTime? firstDate, DateTime now) {
  final out = <Bucket>[];
  final y = now.year, m = now.month, d = now.day;
  if (p == 'day') {
    for (var h = 0; h < 24; h++) {
      final label = h == 0 ? '12a' : h < 12 ? '${h}a' : h == 12 ? '12p' : '${h - 12}p';
      out.add(Bucket(DateTime(y, m, d, h), DateTime(y, m, d, h + 1), label));
    }
  } else if (p == 'week') {
    final s = periodStart('week', now)!;
    for (var i = 0; i < 7; i++) {
      final a = DateTime(s.year, s.month, s.day + i);
      out.add(Bucket(a, DateTime(s.year, s.month, s.day + i + 1), '${DateFormat.E().format(a)} ${a.day}'));
    }
  } else if (p == 'month') {
    final days = DateTime(y, m + 1, 0).day;
    for (var i = 1; i <= days; i++) {
      out.add(Bucket(DateTime(y, m, i), DateTime(y, m, i + 1), '$i'));
    }
  } else if (p == 'year') {
    for (var i = 1; i <= 12; i++) {
      out.add(Bucket(DateTime(y, i, 1), DateTime(y, i + 1, 1), DateFormat.MMM().format(DateTime(y, i, 1))));
    }
  } else {
    final first = firstDate ?? now;
    if (y - first.year >= 3) {
      for (var yr = first.year; yr <= y; yr++) {
        out.add(Bucket(DateTime(yr, 1, 1), DateTime(yr + 1, 1, 1), '$yr'));
      }
    } else {
      var cur = DateTime(first.year, first.month, 1);
      while (!cur.isAfter(now)) {
        final next = DateTime(cur.year, cur.month + 1, 1);
        out.add(Bucket(cur, next, DateFormat('MMM yy').format(cur)));
        cur = next;
      }
    }
  }
  return out;
}

List<Bucket> trend(List<Attempt> attempts, String p, DateTime now) {
  DateTime? first;
  for (final a in attempts) {
    final f = a.finishedAt;
    if (f != null && (first == null || f.isBefore(first))) first = f;
  }
  final buckets = _buildBuckets(p, first, now);
  for (final a in attempts) {
    final f = a.finishedAt;
    if (f == null) continue;
    for (final b in buckets) {
      if (!f.isBefore(b.start) && f.isBefore(b.end)) {
        if (a.result == 'successful') {
          b.ok++;
        } else if (a.result == 'failed') {
          b.failed++;
        }
        break;
      }
    }
  }
  return buckets;
}

List<Bucket> flowTrend(List<Repair> created, List<Attempt> done, String p, DateTime now) {
  DateTime? first;
  for (final d in [...created.map((r) => r.createdAt), ...done.map((a) => a.finishedAt)]) {
    if (d != null && (first == null || d.isBefore(first))) first = d;
  }
  final buckets = _buildBuckets(p, first, now);
  void put(DateTime? d, bool isReported) {
    if (d == null) return;
    for (final b in buckets) {
      if (!d.isBefore(b.start) && d.isBefore(b.end)) {
        isReported ? b.reported++ : b.finished++;
        break;
      }
    }
  }
  for (final r in created) { put(r.createdAt, true); }
  for (final a in done) { put(a.finishedAt, false); }
  return buckets;
}

class ConcernStat {
  final String label;
  int value = 0, ok = 0, failed = 0;
  ConcernStat(this.label);
}

List<ConcernStat> concernStats(List<Repair> created, List<Attempt> done, Map<String, Repair> byId) {
  final rows = {for (final c in concerns) c: ConcernStat(c)};
  String keyOf(Repair r) {
    final c = matchConcern(r.concern).choice;
    return c.isEmpty ? 'OTHERS' : c;
  }

  for (final r in created) {
    rows[keyOf(r)]!.value++;
  }
  for (final a in done) {
    final r = byId[a.repairId];
    if (r == null) continue;
    final row = rows[keyOf(r)]!;
    if (a.result == 'successful') {
      row.ok++;
    } else if (a.result == 'failed') {
      row.failed++;
    }
  }
  return concerns.map((c) => rows[c]!).toList();
}

class TechStat {
  final String id;
  String name;
  int ok = 0, failed = 0, helped = 0, timed = 0;
  int ms = 0;
  TechStat(this.id, this.name);
  int get rate => ok + failed > 0 ? (ok / (ok + failed) * 100).round() : 0;
  double? get avgMs => timed > 0 ? ms / timed : null;
}

List<TechStat> techStats(List<Attempt> attempts) {
  final map = <String, TechStat>{};
  TechStat get(String id, String? name) {
    final t = map.putIfAbsent(id, () => TechStat(id, name ?? 'Unknown'));
    if (name != null) t.name = name;
    return t;
  }

  for (final a in attempts) {
    if (a.techId == null) continue;
    final t = get(a.techId!, a.techName);
    if (a.result == 'successful') {
      t.ok++;
      if (a.takenAt != null && a.finishedAt != null) {
        t.ms += a.finishedAt!.difference(a.takenAt!).inMilliseconds;
        t.timed++;
      }
      if (a.helperId != null) get(a.helperId!, a.helperName).helped++;
    } else if (a.result == 'failed') {
      t.failed++;
    }
  }

  return map.values.toList()
    ..sort((a, b) {
      var c = b.ok.compareTo(a.ok);
      if (c == 0) c = b.helped.compareTo(a.helped);
      if (c == 0) c = a.failed.compareTo(b.failed);
      if (c == 0) c = a.name.compareTo(b.name);
      return c;
    });
}

class MaterialStat {
  final MaterialItem item;
  num total = 0;
  int jobs = 0;
  MaterialStat(this.item);
}

List<MaterialStat> materialStats(List<Attempt> done) {
  final rows = materialItems.map(MaterialStat.new).toList();
  for (final a in done) {
    if (a.result != 'successful' || a.materials == null) continue;
    for (final row in rows) {
      final q = (a.materials![row.item.key] as num?) ?? 0;
      if (q > 0) {
        row.total += q;
        row.jobs++;
      }
    }
  }
  for (final r in rows) {
    r.total = (r.total * 10).round() / 10;
  }
  return rows;
}
