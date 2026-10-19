import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'date_filter.dart';
import 'models.dart';
import 'repair_actions.dart';
import 'repair_detail.dart';
import 'repair_form.dart';
import 'theme.dart';
import 'util.dart';
import 'widgets.dart';
import 'package:provider/provider.dart';
import 'auth_state.dart';

const _filters = [
  ('all', 'All'),
  ('pending', 'Pending'),
  ('rescheduled', 'Rescheduled'),
  ('in_progress', 'In progress'),
  ('help', 'Needs help'),
  ('successful', 'Successful'),
];

// added, scheduled, taken or finished on that day
bool _onDate(Repair r, DateTime d) =>
    sameDay(r.createdAt, d) || sameDay(r.scheduledFor, d) || sameDay(r.takenAt, d) || sameDay(r.completedAt, d);

class RepairsScreen extends StatefulWidget {
  const RepairsScreen({super.key});
  @override
  State<RepairsScreen> createState() => _RepairsScreenState();
}

class _RepairsScreenState extends State<RepairsScreen> {
  List<Repair> _repairs = [];
  bool _loading = true;
  String _scope = 'all', _filter = 'all', _search = '';
  DateTime? _date; // specific date; wins over Today / Overall
  DateTime _now = DateTime.now();
  StreamSubscription? _sub;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(minutes: 1), (_) => setState(() => _now = DateTime.now()));
    _sub = FirebaseFirestore.instance
        .collection('repairs')
        .orderBy('createdAt', descending: true)
        .limit(300)
        .snapshots()
        .listen((snap) {
      setState(() {
        _repairs = snap.docs.map(Repair.fromDoc).toList();
        _loading = false;
      });
    }, onError: (e) {
      debugPrint('repairs stream: $e');
      setState(() => _loading = false);
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final canCreate = context.watch<AuthState>().profile?.role != 'technician';
    final scoped = _date != null
        ? _repairs.where((r) => _onDate(r, _date!)).toList()
        : _scope == 'today'
            ? _repairs.where((r) => r.isToday(_now)).toList()
            : _repairs;

    final counts = {for (final f in _filters) f.$1: 0};
    counts['all'] = scoped.length;
    for (final r in scoped) {
      if (counts.containsKey(r.status)) counts[r.status] = counts[r.status]! + 1;
      if (r.rescheduled) counts['rescheduled'] = counts['rescheduled']! + 1;
      if (r.needsHelp) counts['help'] = counts['help']! + 1;
    }

    final s = _search.trim().toLowerCase();
    final visible = scoped.where((r) {
      if (_filter == 'help') {
        if (!r.needsHelp) return false;
      } else if (_filter == 'rescheduled') {
        if (!r.rescheduled) return false;
      } else if (_filter != 'all' && r.status != _filter) {
        return false;
      }
      if (s.isEmpty) return true;
      return [r.name, r.accountNumber, r.phone, r.address, r.concern, r.takenByName, r.helperName]
          .join(' ')
          .toLowerCase()
          .contains(s);
    }).toList();

    String emptyText() {
      if (_repairs.isEmpty) {
        return canCreate ? 'No repairs yet. Tap "New repair" to add the first one.' : 'No repairs yet.';
      }
      if (_date != null && scoped.isEmpty) return 'No repairs were added, scheduled, taken or finished on this date.';
      if (_date == null && _scope == 'today' && scoped.isEmpty) {
        return 'Nothing for today yet. Switch to Overall to see every repair.';
      }
      return 'No repairs match your search or filter.';
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: () => Navigator.push(context,
                  MaterialPageRoute(fullscreenDialog: true, builder: (_) => const RepairForm())),
              icon: const Icon(Icons.add),
              label: const Text('New repair', style: TextStyle(fontWeight: FontWeight.w700)),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              decoration: const InputDecoration(
                hintText: 'Search name, account, phone…',
                prefixIcon: Icon(Icons.search, size: 22, color: kMuted),
              ),
            ),
          ),
          SizedBox(
            height: 46,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
              children: [
                PillChip(
                    label: 'Today',
                    selected: _date == null && _scope == 'today',
                    onTap: () => setState(() {
                          _scope = 'today';
                          _date = null;
                        })),
                const SizedBox(width: 8),
                PillChip(
                    label: 'Overall',
                    selected: _date == null && _scope == 'all',
                    onTap: () => setState(() {
                          _scope = 'all';
                          _date = null;
                        })),
                const SizedBox(width: 8),
                DatePill(value: _date, onChanged: (d) => setState(() => _date = d)),
              ],
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 46,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
              children: [
                for (final f in _filters)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: PillChip(
                      label: f.$2,
                      count: counts[f.$1],
                      selected: _filter == f.$1,
                      onTap: () => setState(() => _filter = f.$1),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : visible.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(color: kBlueSoft, borderRadius: BorderRadius.circular(20)),
                              child: const Icon(Icons.inbox_outlined, color: kBlue, size: 30),
                            ),
                            const SizedBox(height: 14),
                            Text(emptyText(), textAlign: TextAlign.center, style: const TextStyle(color: kMuted)),
                          ]),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                        itemCount: visible.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) => RepairCard(r: visible[i]),
                      ),
          ),
        ],
      ),
    );
  }
}

class RepairCard extends StatelessWidget {
  final Repair r;
  const RepairCard({super.key, required this.r});

  Widget _meta(IconData icon, String t) => Padding(
        padding: const EdgeInsets.only(top: 5),
        child: Row(children: [
          Icon(icon, size: 15, color: kBlue),
          const SizedBox(width: 8),
          Expanded(child: Text(t.isEmpty ? '—' : t, style: const TextStyle(fontSize: 13, color: kInk))),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final mats = formatMaterials(r.materials);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kLine.withOpacity(0.7)),
        boxShadow: softShadow,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => Navigator.push(
              context, MaterialPageRoute(builder: (_) => RepairDetailScreen(repairId: r.id))),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(
                      child: Text(r.name,
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: kInk))),
                  StatusBadge(r.status),
                  DeleteRepairButton(r: r, compact: true),
                ]),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(color: kBlueSoft, borderRadius: BorderRadius.circular(10)),
                  child: Text(r.concern,
                      style: const TextStyle(color: kBlueDark, fontWeight: FontWeight.w700, fontSize: 12.5)),
                ),
                const SizedBox(height: 6),
                _meta(Icons.tag, r.accountNumber),
                _meta(Icons.phone_outlined, r.phone),
                _meta(Icons.place_outlined, r.address),
                if (r.status == 'pending' && (r.scheduledFor != null || r.failedAttempts > 0))
                  Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: kYellowSoft, borderRadius: BorderRadius.circular(10)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.event, size: 15, color: Color(0xFF8A5E00)),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          '${r.failedAttempts > 0 ? 'Failed ${r.failedAttempts}× · ' : ''}'
                          '${r.scheduledFor != null ? 'Scheduled ${fmtDate(r.scheduledFor)}' : 'Rescheduled'}',
                          style: const TextStyle(
                              color: Color(0xFF8A5E00), fontSize: 12.5, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ]),
                  ),
                const SizedBox(height: 10),
                Assignees(r: r),
                if (mats.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFFEBF9F2), borderRadius: BorderRadius.circular(10)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.inventory_2_outlined, size: 15, color: kOk),
                      const SizedBox(width: 6),
                      Flexible(
                          child: Text(mats,
                              style: const TextStyle(fontSize: 12.5, color: kOk, fontWeight: FontWeight.w600))),
                    ]),
                  ),
                RepairActions(r: r, compact: true),
                const SizedBox(height: 10),
                Text('Added by ${r.createdByName} · ${fmtDateTime(r.createdAt)}',
                    style: const TextStyle(color: kMuted, fontSize: 12)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class Assignees extends StatelessWidget {
  final Repair r;
  const Assignees({super.key, required this.r});

  Widget _w(IconData i, String t, {Color? c}) => Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Row(children: [
          Icon(i, size: 15, color: c ?? kMuted),
          const SizedBox(width: 8),
          Expanded(child: Text(t, style: TextStyle(fontSize: 13, color: c ?? kInk))),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    if (r.takenBy == null) {
      return const Text('Waiting for a technician', style: TextStyle(color: kMuted, fontSize: 13));
    }
    final inProgress = r.status == 'in_progress';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _w(Icons.how_to_reg_outlined, '${inProgress ? 'Taken by' : 'Handled by'} ${r.takenByName}'),
      if (r.takenAt != null) _w(Icons.schedule, 'Taken ${fmtDateTime(r.takenAt)}'),
      if (r.completedAt != null) _w(Icons.schedule, 'Finished ${fmtDateTime(r.completedAt)}'),
      if (r.helperId != null)
        _w(Icons.support, 'Helped by ${r.helperName}')
      else if (inProgress && r.helpRequested)
        _w(Icons.support, 'Needs help', c: kBlue),
    ]);
  }
}