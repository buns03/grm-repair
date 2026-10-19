import 'package:flutter/material.dart';
import 'theme.dart';
import 'util.dart';

class Logo extends StatelessWidget {
  final double size;
  const Logo({super.key, this.size = 40});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.28),
      child: Image.asset(
        'assets/grm-logo.png',
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => Container(
          width: size,
          height: size,
          color: kBlue,
          alignment: Alignment.center,
          child: Text('GRM',
              style: TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w900, fontSize: size * 0.34)),
        ),
      ),
    );
  }
}

// White card with a soft shadow instead of a hard outline
class Panel extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final Color? border;
  const Panel({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.border});

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: padding,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: border ?? kLine.withOpacity(0.7)),
          boxShadow: softShadow,
        ),
        child: child,
      );
}

// Rounded pill used for filters, tabs and scopes
class PillChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;
  const PillChip({super.key, required this.label, required this.selected, required this.onTap, this.count});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? kBlue : Colors.white,
      shape: StadiumBorder(side: BorderSide(color: selected ? kBlue : kLine)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(label,
                style: TextStyle(
                    color: selected ? Colors.white : kInk, fontWeight: FontWeight.w700, fontSize: 13)),
            if (count != null) ...[
              const SizedBox(width: 8),
              Text('$count',
                  style: TextStyle(
                      color: selected ? kYellow : kBlue, fontWeight: FontWeight.w800, fontSize: 13)),
            ],
          ]),
        ),
      ),
    );
  }
}

class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    final c = statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(statusLabels[status] ?? status,
          style: TextStyle(color: c, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}

Future<bool> confirmDialog(BuildContext context,
    {required String title,
    required String message,
    required String confirmText,
    bool danger = false}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      content: Text(message, style: const TextStyle(color: kMuted)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: kBad) : null,
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(confirmText),
        ),
      ],
    ),
  );
  return r == true;
}

Future<void> notifyDialog(BuildContext context, String title, String message) =>
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        content: Text(message, style: const TextStyle(color: kMuted)),
        actions: [FilledButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))],
      ),
    );

class ErrorText extends StatelessWidget {
  final String text;
  const ErrorText(this.text, {super.key});
  @override
  Widget build(BuildContext context) => text.isEmpty
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Text(text, style: const TextStyle(color: kBad, fontSize: 13)),
        );
}

class BarItem {
  final String label;
  final num value;
  final String? sub;
  const BarItem(this.label, this.value, [this.sub]);
}

// Horizontal bars: a ranking of categories
class BarList extends StatelessWidget {
  final List<BarItem> items;
  final Color color;
  const BarList({super.key, required this.items, this.color = kBlue});

  @override
  Widget build(BuildContext context) {
    final max = items.fold<num>(1, (m, i) => i.value > m ? i.value : m);
    final total = items.fold<num>(0, (s, i) => s + i.value);
    return Column(
      children: [
        for (final i in items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(
                      child: Text(i.label,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: kInk))),
                  Text('${i.value}',
                      style: const TextStyle(fontWeight: FontWeight.w800, color: kInk)),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 34,
                    child: Text('${total > 0 ? (i.value / total * 100).round() : 0}%',
                        textAlign: TextAlign.right,
                        style: const TextStyle(color: kMuted, fontSize: 12)),
                  ),
                ]),
                if (i.sub != null)
                  Text(i.sub!, style: const TextStyle(color: kMuted, fontSize: 11.5)),
                const SizedBox(height: 6),
                SizedBox(
                  height: 10,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Stack(children: [
                      Container(color: const Color(0xFFE9EFF9)),
                      FractionallySizedBox(
                        alignment: Alignment.centerLeft,
                        widthFactor: (i.value / max).clamp(0.0, 1.0).toDouble(),
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(colors: [color, color.withOpacity(0.65)]),
                          ),
                        ),
                      ),
                    ]),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}