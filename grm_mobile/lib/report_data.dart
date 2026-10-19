import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'models.dart';
import 'theme.dart';
import 'widgets.dart';

typedef ReportBuilderFn = Widget Function(
    BuildContext context, List<Repair> repairs, List<Attempt> attempts);

// Live repairs + attempt history, shared by the dashboard and leaderboard
class ReportBuilder extends StatefulWidget {
  final ReportBuilderFn builder;
  const ReportBuilder({super.key, required this.builder});
  @override
  State<ReportBuilder> createState() => _ReportBuilderState();
}

class _ReportBuilderState extends State<ReportBuilder> {
  List<Repair> _repairs = [];
  List<Attempt> _attempts = [];
  bool _gotR = false, _gotA = false;
  String _error = '';
  final _subs = <StreamSubscription>[];

  @override
  void initState() {
    super.initState();
    final db = FirebaseFirestore.instance;
    _subs.add(db
        .collection('repairs')
        .orderBy('createdAt', descending: true)
        .limit(2000)
        .snapshots()
        .listen((s) {
      setState(() {
        _repairs = s.docs.map(Repair.fromDoc).toList();
        _gotR = true;
      });
    }, onError: (e) {
      setState(() {
        _error = 'Could not load repairs.';
        _gotR = true;
      });
    }));
    _subs.add(db.collectionGroup('attempts').limit(5000).snapshots().listen((s) {
      setState(() {
        _attempts = s.docs.map(Attempt.fromDoc).toList();
        _gotA = true;
      });
    }, onError: (e) {
      setState(() {
        _error = 'Could not load the attempt history. Check the Firestore rules for the attempts collection group.';
        _gotA = true;
      });
    }));
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!(_gotR && _gotA)) return const Center(child: CircularProgressIndicator());
    return Column(children: [
      if (_error.isNotEmpty)
        Padding(
          padding: const EdgeInsets.all(12),
          child: Text(_error, style: const TextStyle(color: kBad)),
        ),
      Expanded(child: widget.builder(context, _repairs, _attempts)),
    ]);
  }
}

class PeriodTabs extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final List<(String, String)> items;
  final Widget? trailing;
  const PeriodTabs(
      {super.key, required this.value, required this.onChanged, required this.items, this.trailing});

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 50,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          children: [
            for (final p in items)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: PillChip(label: p.$2, selected: value == p.$1, onTap: () => onChanged(p.$1)),
              ),
            if (trailing != null) trailing!,
          ],
        ),
      );
}