import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'theme.dart';

// Pick one specific day. value == null means "no date filter".
// Pass lastDate (today) on the Dashboard to block future dates.
class DatePill extends StatelessWidget {
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final DateTime? lastDate;
  const DatePill({super.key, required this.value, required this.onChanged, this.lastDate});

  DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);

  Future<void> _pick(BuildContext context) async {
    final now = _day(DateTime.now());
    var initial = value ?? now;
    if (lastDate != null && initial.isAfter(lastDate!)) initial = lastDate!;
    final d = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 3),
      lastDate: lastDate ?? DateTime(now.year + 2),
    );
    if (d != null) onChanged(_day(d));
  }

  void _shift(int n) {
    var d = _day((value ?? DateTime.now()).add(Duration(days: n)));
    if (lastDate != null && d.isAfter(lastDate!)) d = lastDate!;
    onChanged(d);
  }

  @override
  Widget build(BuildContext context) {
    if (value == null) {
      return Material(
        color: Colors.white,
        shape: const StadiumBorder(side: BorderSide(color: kLine)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: () => _pick(context),
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.calendar_month_outlined, size: 17, color: kBlue),
              SizedBox(width: 8),
              Text('Pick a date', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: kInk)),
            ]),
          ),
        ),
      );
    }

    final atLimit = lastDate != null && !value!.isBefore(lastDate!);
    Widget nav(IconData i, VoidCallback? f) => InkResponse(
          onTap: f,
          radius: 18,
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: Icon(i, size: 20, color: f == null ? kMuted.withOpacity(0.4) : kInk),
          ),
        );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: ShapeDecoration(
        color: kYellowSoft,
        shape: StadiumBorder(side: BorderSide(color: kYellow.withOpacity(0.6))),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        nav(Icons.chevron_left, () => _shift(-1)),
        GestureDetector(
          onTap: () => _pick(context),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            child: Text(DateFormat.yMMMd().format(value!),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: kInk)),
          ),
        ),
        nav(Icons.chevron_right, atLimit ? null : () => _shift(1)),
        InkResponse(
          onTap: () => onChanged(null),
          radius: 18,
          child: Container(
            margin: const EdgeInsets.only(left: 2, right: 4),
            padding: const EdgeInsets.all(4),
            decoration: const BoxDecoration(color: kYellow, shape: BoxShape.circle),
            child: const Icon(Icons.close, size: 14, color: kNavy),
          ),
        ),
      ]),
    );
  }
}