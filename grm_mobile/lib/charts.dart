import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'analytics.dart';
import 'theme.dart';
import 'widgets.dart';

// Drawn with CustomPainter, so no new packages are needed.

typedef _Scale = ({int ticks, int step, int top});
_Scale _scale(int max) {
  final ticks = math.min(math.max(max, 1), 4);
  final step = (math.max(max, 1) / ticks).ceil();
  return (ticks: ticks, step: step, top: step * ticks);
}

void _label(Canvas c, String t, Offset o,
    {Color color = kMuted, double size = 10, bool bold = false, TextAlign align = TextAlign.center}) {
  final tp = TextPainter(
    text: TextSpan(
        text: t,
        style: TextStyle(color: color, fontSize: size, fontWeight: bold ? FontWeight.w800 : FontWeight.w500)),
    textDirection: TextDirection.ltr,
  )..layout();
  final dx = align == TextAlign.right ? o.dx - tp.width : align == TextAlign.left ? o.dx : o.dx - tp.width / 2;
  tp.paint(c, Offset(dx, o.dy));
}

void _grid(Canvas c, double right, double l, double t, double ph, _Scale sc) {
  final p = Paint()
    ..color = kLine
    ..strokeWidth = 1;
  for (var i = 0; i <= sc.ticks; i++) {
    final v = i * sc.step;
    final y = t + ph - (v / sc.top) * ph;
    c.drawLine(Offset(l, y), Offset(right, y), p);
    _label(c, '$v', Offset(l - 6, y - 6), align: TextAlign.right);
  }
}

class Legend extends StatelessWidget {
  final List<(Color, String)> items;
  const Legend(this.items, {super.key});
  @override
  Widget build(BuildContext context) => Wrap(spacing: 16, runSpacing: 6, children: [
        for (final i in items)
          Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: i.$1, borderRadius: BorderRadius.circular(3))),
            const SizedBox(width: 6),
            Text(i.$2, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: kInk)),
          ]),
      ]);
}

// ---------- AREA + LINE: reported vs finished over time ----------
class AreaTrendChart extends StatelessWidget {
  final List<Bucket> data;
  const AreaTrendChart({super.key, required this.data});
  @override
  Widget build(BuildContext context) =>
      SizedBox(height: 200, child: CustomPaint(size: Size.infinite, painter: _AreaPainter(data)));
}

class _AreaPainter extends CustomPainter {
  final List<Bucket> d;
  _AreaPainter(this.d);

  @override
  void paint(Canvas c, Size s) {
    const l = 28.0, b = 22.0, t = 10.0;
    final pw = s.width - l - 6, ph = s.height - b - t;
    final maxV = d.fold<int>(1, (m, x) => math.max(m, math.max(x.reported, x.finished)));
    final sc = _scale(maxV);
    _grid(c, s.width, l, t, ph, sc);

    double x(int i) => d.length == 1 ? l + pw / 2 : l + pw * i / (d.length - 1);
    double y(int v) => t + ph - (v / sc.top) * ph;

    Path line(int Function(Bucket) f) {
      final p = Path();
      for (var i = 0; i < d.length; i++) {
        i == 0 ? p.moveTo(x(i), y(f(d[i]))) : p.lineTo(x(i), y(f(d[i])));
      }
      return p;
    }

    final rep = line((b) => b.reported);
    final area = Path.from(rep)
      ..lineTo(x(d.length - 1), t + ph)
      ..lineTo(x(0), t + ph)
      ..close();
    c.drawPath(
      area,
      Paint()
        ..shader = LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [kBlue.withOpacity(0.30), kBlue.withOpacity(0.02)])
            .createShader(Rect.fromLTWH(l, t, pw, ph)),
    );
    Paint stroke(Color col) => Paint()
      ..color = col
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    c.drawPath(rep, stroke(kBlue));
    c.drawPath(line((b) => b.finished), stroke(kOk));

    if (d.length <= 16) {
      for (var i = 0; i < d.length; i++) {
        for (final (v, col) in [(d[i].reported, kBlue), (d[i].finished, kOk)]) {
          c.drawCircle(Offset(x(i), y(v)), 3.6, Paint()..color = Colors.white);
          c.drawCircle(
              Offset(x(i), y(v)),
              3.6,
              Paint()
                ..color = col
                ..style = PaintingStyle.stroke
                ..strokeWidth = 2);
        }
      }
    }
    final every = (d.length / 6).ceil();
    for (var i = 0; i < d.length; i += every) {
      _label(c, d[i].label, Offset(x(i), s.height - 16));
    }
  }

  @override
  bool shouldRepaint(covariant _AreaPainter o) => true;
}

// ---------- STACKED COLUMNS: successful + failed per time slot ----------
class StackedColumns extends StatelessWidget {
  final List<Bucket> data;
  const StackedColumns({super.key, required this.data});
  @override
  Widget build(BuildContext context) =>
      SizedBox(height: 200, child: CustomPaint(size: Size.infinite, painter: _StackedPainter(data)));
}

class _StackedPainter extends CustomPainter {
  final List<Bucket> d;
  _StackedPainter(this.d);

  @override
  void paint(Canvas c, Size s) {
    const l = 28.0, b = 22.0, t = 16.0;
    final pw = s.width - l - 4, ph = s.height - b - t;
    final maxV = d.fold<int>(1, (m, x) => math.max(m, x.ok + x.failed));
    final sc = _scale(maxV);
    _grid(c, s.width, l, t, ph, sc);

    final slot = pw / d.length;
    final bw = math.min(20.0, slot * 0.62);
    final every = (d.length / 6).ceil();
    const r = Radius.circular(5);

    for (var i = 0; i < d.length; i++) {
      final cx = l + slot * i + slot / 2;
      final okH = d[i].ok / sc.top * ph, badH = d[i].failed / sc.top * ph;
      final base = t + ph;
      if (d[i].ok > 0) {
        c.drawRRect(
          RRect.fromRectAndCorners(Rect.fromLTWH(cx - bw / 2, base - okH, bw, okH),
              topLeft: d[i].failed == 0 ? r : Radius.zero, topRight: d[i].failed == 0 ? r : Radius.zero),
          Paint()..color = kOk,
        );
      }
      if (d[i].failed > 0) {
        c.drawRRect(
          RRect.fromRectAndCorners(Rect.fromLTWH(cx - bw / 2, base - okH - badH, bw, badH),
              topLeft: r, topRight: r),
          Paint()..color = kYellow,
        );
      }
      final total = d[i].ok + d[i].failed;
      if (total > 0 && d.length <= 14) {
        _label(c, '$total', Offset(cx, base - okH - badH - 14), color: kInk, bold: true);
      }
      if (i % every == 0) _label(c, d[i].label, Offset(cx, s.height - 16));
    }
  }

  @override
  bool shouldRepaint(covariant _StackedPainter o) => true;
}

// ---------- DONUT: share of one whole ----------
class DonutChart extends StatelessWidget {
  final List<(Color, String, int)> parts;
  final String centerValue, centerLabel;
  const DonutChart({super.key, required this.parts, required this.centerValue, required this.centerLabel});

  @override
  Widget build(BuildContext context) {
    final total = parts.fold<int>(0, (s, p) => s + p.$3);
    return Row(children: [
      SizedBox(
        width: 140,
        height: 140,
        child: Stack(alignment: Alignment.center, children: [
          CustomPaint(size: const Size(140, 140), painter: _DonutPainter(parts)),
          Column(mainAxisSize: MainAxisSize.min, children: [
            Text(centerValue,
                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: kInk)),
            Text(centerLabel, style: const TextStyle(fontSize: 11, color: kMuted)),
          ]),
        ]),
      ),
      const SizedBox(width: 18),
      Expanded(
        child: Column(children: [
          for (final p in parts)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Row(children: [
                Container(width: 10, height: 10, decoration: BoxDecoration(color: p.$1, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(p.$2, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: kInk)),
                    Text('${total > 0 ? (p.$3 / total * 100).round() : 0}% of finished',
                        style: const TextStyle(color: kMuted, fontSize: 11.5)),
                  ]),
                ),
                Text('${p.$3}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: kInk)),
              ]),
            ),
        ]),
      ),
    ]);
  }
}

class _DonutPainter extends CustomPainter {
  final List<(Color, String, int)> parts;
  _DonutPainter(this.parts);

  @override
  void paint(Canvas c, Size s) {
    const sw = 18.0;
    final rect = Rect.fromCircle(center: s.center(Offset.zero), radius: s.shortestSide / 2 - sw / 2);
    Paint ring(Color col) => Paint()
      ..color = col
      ..style = PaintingStyle.stroke
      ..strokeWidth = sw;
    c.drawArc(rect, 0, math.pi * 2, false, ring(const Color(0xFFE9EFF9)));
    final total = parts.fold<int>(0, (a, p) => a + p.$3);
    if (total == 0) return;
    final shown = parts.where((p) => p.$3 > 0).length;
    final gap = shown > 1 ? 0.06 : 0.0;
    var start = -math.pi / 2;
    for (final p in parts) {
      if (p.$3 == 0) continue;
      final sweep = p.$3 / total * math.pi * 2;
      c.drawArc(rect, start + gap / 2, math.max(0.01, sweep - gap), false, ring(p.$1));
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter o) => true;
}

// ---------- VERTICAL COLUMNS: quantities of different items ----------
class ColumnChart extends StatelessWidget {
  final List<BarItem> items;
  const ColumnChart({super.key, required this.items});
  @override
  Widget build(BuildContext context) =>
      SizedBox(height: 190, child: CustomPaint(size: Size.infinite, painter: _ColumnPainter(items)));
}

class _ColumnPainter extends CustomPainter {
  final List<BarItem> items;
  _ColumnPainter(this.items);

  @override
  void paint(Canvas c, Size s) {
    const l = 28.0, b = 24.0, t = 18.0;
    final pw = s.width - l - 4, ph = s.height - b - t;
    final maxV = items.fold<int>(1, (m, i) => math.max(m, i.value.ceil()));
    final sc = _scale(maxV);
    _grid(c, s.width, l, t, ph, sc);
    const colors = [kBlue, kOk, kYellow];
    final slot = pw / items.length;
    final bw = math.min(40.0, slot * 0.6);

    for (var i = 0; i < items.length; i++) {
      final cx = l + slot * i + slot / 2;
      final h = items[i].value / sc.top * ph;
      c.drawRRect(
        RRect.fromRectAndCorners(Rect.fromLTWH(cx - bw / 2, t + ph - h, bw, h),
            topLeft: const Radius.circular(8), topRight: const Radius.circular(8)),
        Paint()..color = colors[i % colors.length],
      );
      _label(c, '${items[i].value}', Offset(cx, t + ph - h - 14), color: kInk, bold: true, size: 11);
      _label(c, items[i].label, Offset(cx, s.height - 16), size: 9.5);
    }
  }

  @override
  bool shouldRepaint(covariant _ColumnPainter o) => true;
}