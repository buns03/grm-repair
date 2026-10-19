import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_state.dart';
import 'models.dart';
import 'repair_actions.dart';
import 'repair_service.dart';
import 'theme.dart';
import 'util.dart';
import 'widgets.dart';

class RepairDetailScreen extends StatefulWidget {
  final String repairId;
  const RepairDetailScreen({super.key, required this.repairId});
  @override
  State<RepairDetailScreen> createState() => _RepairDetailScreenState();
}

class _Comment {
  final String id, text, authorId, authorName, authorRole;
  final DateTime? at;
  _Comment(this.id, Map<String, dynamic> d)
      : text = (d['text'] ?? '').toString(),
        authorId = (d['authorId'] ?? '').toString(),
        authorName = (d['authorName'] ?? '').toString(),
        authorRole = (d['authorRole'] ?? '').toString(),
        at = d['createdAt'] is Timestamp ? (d['createdAt'] as Timestamp).toDate() : DateTime.now();
}

class _RepairDetailScreenState extends State<RepairDetailScreen> {
  Repair? _repair;
  List<_Comment> _comments = [];
  List<Attempt> _attempts = [];
  final _text = TextEditingController();
  final _scroll = ScrollController();
  bool _touched = false;
  DateTime? _sched;
  String _schedMsg = '';
  String _attemptsError = '';
  final _subs = <StreamSubscription>[];

  @override
  void initState() {
    super.initState();
    final ref = FirebaseFirestore.instance.collection('repairs').doc(widget.repairId);
    _subs.add(ref.snapshots().listen((s) {
      if (!s.exists) {
        if (mounted) Navigator.maybePop(context);
        return;
      }
      setState(() => _repair = Repair.fromDoc(s));
    }));
    _subs.add(ref.collection('comments').orderBy('createdAt').snapshots().listen((s) {
      setState(() => _comments = s.docs.map((d) => _Comment(d.id, d.data())).toList());
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.animateTo(_scroll.position.maxScrollExtent,
              duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
        }
      });
    }));
        _subs.add(ref.collection('attempts').snapshots().listen((s) {
      final list = s.docs.map(Attempt.fromDoc).toList()
        ..sort((a, b) => (a.finishedAt ?? a.takenAt ?? DateTime(2000))
            .compareTo(b.finishedAt ?? b.takenAt ?? DateTime(2000)));
      setState(() {
        _attempts = list;
        _attemptsError = '';
      });
    }, onError: (e) {
      debugPrint('attempts stream: $e');
      if (mounted) {
        setState(() => _attemptsError =
            'Could not load attempt history. Check the Firestore rules for repairs/{id}/attempts.');
      }
    }));
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    super.dispose();
  }

  Future<void> _send() async {
    final t = _text.text.trim();
    if (t.isEmpty) return;
    final me = context.read<AuthState>().profile!;
    _text.clear();
    try {
      await FirebaseFirestore.instance
          .collection('repairs')
          .doc(widget.repairId)
          .collection('comments')
          .add({
        'text': t,
        'authorId': me.id,
        'authorName': me.name,
        'authorRole': me.role,
        'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (_) {
      _text.text = t;
    }
  }

  Future<void> _pickDate(DateTime? current) async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: current ?? now,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 730)),
    );
    if (d != null) setState(() {
      _touched = true;
      _sched = d;
    });
  }

  Future<void> _saveSchedule(DateTime? shown, bool clear) async {
    final remove = clear || shown == null;
    try {
      await setSchedule(widget.repairId, remove ? null : DateTime(shown.year, shown.month, shown.day));
      setState(() {
        _touched = false;
        _schedMsg = remove ? 'Schedule cleared.' : 'Schedule saved.';
      });
    } catch (_) {
      setState(() => _schedMsg = 'Could not update the schedule.');
    }
  }

  Widget _row(String k, String? v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 120, child: Text(k, style: const TextStyle(color: kMuted, fontSize: 13))),
          Expanded(child: Text((v == null || v.isEmpty) ? '—' : v, style: const TextStyle(fontSize: 14))),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final r = _repair;
    final me = context.watch<AuthState>().profile!;
    if (r == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator()));
    }
    final mats = formatMaterials(r.materials);
    final shown = _touched ? _sched : r.scheduledFor;

    return Scaffold(
      appBar: AppBar(title: Text(r.name, overflow: TextOverflow.ellipsis)),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              controller: _scroll,
              padding: const EdgeInsets.all(14),
              children: [
                Align(alignment: Alignment.centerLeft, child: StatusBadge(r.status)),
                const SizedBox(height: 10),
                Panel(
                  child: Column(children: [
                    _row('Account number', r.accountNumber),
                    _row('Phone', r.phone),
                    _row('Address', r.address),
                    _row('Concern', r.concern),
                    _row('Added by', '${r.createdByName} · ${fmtDateTime(r.createdAt)}'),
                    _row('Taken by',
                        r.takenByName != null ? '${r.takenByName} · ${fmtDateTime(r.takenAt)}' : 'Not yet taken'),
                    _row(
                        'Helper',
                        r.helperName ??
                            (r.status == 'in_progress' && r.helpRequested ? 'Help requested, nobody yet' : '—')),
                    if (r.status == 'pending' && r.scheduledFor != null)
                      _row('Scheduled for', fmtDate(r.scheduledFor)),
                    if (r.failedAttempts > 0) _row('Failed attempts', '${r.failedAttempts}'),
                    if (r.completedAt != null) _row('Finished', fmtDateTime(r.completedAt)),
                    if (mats.isNotEmpty) _row('Materials used', mats),
                  ]),
                ),
                const SizedBox(height: 12),
                RepairActions(r: r),
                if (me.role != 'technician') ...[
                  const SizedBox(height: 10),
                  DeleteRepairButton(r: r, onDeleted: () => Navigator.pop(context)),
                ],
                if (me.role != 'technician' && r.status == 'pending')
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(
                        '${r.scheduledFor != null ? 'Scheduled for ${fmtDate(r.scheduledFor)}. ' : ''}Waiting for a technician to take this repair.',
                        style: const TextStyle(color: kMuted, fontSize: 13)),
                  ),
                if (me.role == 'admin' && r.status == 'pending') ...[
                  const SizedBox(height: 12),
                  Panel(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Schedule', style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      Row(children: [
                        OutlinedButton.icon(
                          onPressed: () => _pickDate(shown),
                          icon: const Icon(Icons.event, size: 18),
                          label: Text(shown == null ? 'Pick a date' : fmtDate(shown)),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                            onPressed: () => _saveSchedule(shown, false), child: const Text('Save')),
                        const SizedBox(width: 6),
                        TextButton(onPressed: () => _saveSchedule(shown, true), child: const Text('Clear')),
                      ]),
                      const SizedBox(height: 6),
                      const Text(
                          "Technicians can't take this repair before the scheduled date. Clear it to make it available right away.",
                          style: TextStyle(color: kMuted, fontSize: 12.5)),
                      if (_schedMsg.isNotEmpty) Text(_schedMsg, style: const TextStyle(fontSize: 13)),
                    ]),
                  ),
                ],
                const SizedBox(height: 18),
                const Text('Attempt history', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                const SizedBox(height: 8),
                if (_attemptsError.isNotEmpty)
                  Text(_attemptsError, style: const TextStyle(color: kBad, fontSize: 13))
                else if (_attempts.isEmpty)
                  const Text('No attempts yet.', style: TextStyle(color: kMuted, fontSize: 13))
                else
                  for (var i = 0; i < _attempts.length; i++) _attemptTile(i, _attempts[i]),
                const SizedBox(height: 18),
                const Text('Discussion', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                const SizedBox(height: 8),
                if (_comments.isEmpty)
                  const Text('No comments yet. Start the conversation below.',
                      style: TextStyle(color: kMuted, fontSize: 13)),
                for (final c in _comments) _bubble(c, c.authorId == me.id),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
              child: Row(children: [
                Expanded(
                  child: TextField(
                    controller: _text,
                    maxLength: 1000,
                    buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (_) => _send(),
                    decoration: const InputDecoration(hintText: 'Write a comment…'),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _text.text.trim().isEmpty ? null : _send,
                  icon: const Icon(Icons.send, size: 18),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _attemptTile(int i, Attempt a) {
    final ok = a.result == 'successful';
    final c = ok ? kOk : kBad;
    final mats = formatMaterials(a.materials);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kLine),
      ),
      child: IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(width: 4, color: c),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(
                      child: Text('Attempt ${i + 1} · ${ok ? 'Successful' : 'Failed'}',
                          style: const TextStyle(fontWeight: FontWeight.w800, color: kInk))),
                  if (a.takenAt != null && a.finishedAt != null)
                    Text(fmtDuration(a.finishedAt!.difference(a.takenAt!).inMilliseconds),
                        style: const TextStyle(color: kMuted, fontSize: 12)),
                ]),
                Text('Technician: ${a.techName ?? 'Unknown'}${a.helperName != null ? ' (helped by ${a.helperName})' : ''}',
                    style: const TextStyle(fontSize: 13, color: kInk)),
                Text('Taken: ${fmtDateTime(a.takenAt)}',
                    style: const TextStyle(color: kMuted, fontSize: 12.5)),
                Text('Finished: ${fmtDateTime(a.finishedAt)}',
                    style: const TextStyle(color: kMuted, fontSize: 12.5)),
                if (mats.isNotEmpty)
                  Text('Materials: $mats', style: const TextStyle(fontSize: 13, color: kInk)),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _bubble(_Comment c, bool mine) {
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        child: Column(
          crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text('${mine ? 'You' : c.authorName} · ${c.authorRole} · ${fmtDateTime(c.at)}',
                style: const TextStyle(color: kMuted, fontSize: 11.5)),
            const SizedBox(height: 2),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: mine ? kOrange : Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: mine ? null : Border.all(color: kLine),
              ),
              child: Text(c.text, style: TextStyle(color: mine ? Colors.white : kInk)),
            ),
          ],
        ),
      ),
    );
  }
}
