import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'api.dart';
import 'auth_state.dart';
import 'theme.dart';
import 'util.dart';
import 'widgets.dart';

class RepairForm extends StatefulWidget {
  const RepairForm({super.key});
  @override
  State<RepairForm> createState() => _RepairFormState();
}

class _RepairFormState extends State<RepairForm> {
  String _mode = 'auto';
  final _raw = TextEditingController();
  final _name = TextEditingController();
  final _acct = TextEditingController();
  final _phone = TextEditingController();
  final _addr = TextEditingController();
  final _other = TextEditingController();
  String _choice = '', _source = '', _lookupMsg = '', _error = '';
  List<Map<String, dynamic>> _results = [];
  bool _searching = false, _busy = false;
  List<Dupe>? _dupes;
  Timer? _timer;
  int _reqId = 0;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String get _concern => _choice == 'OTHERS' ? _other.text.trim() : _choice;

  // ---------- AUTO ----------
  void _pick(Map<String, dynamic> c) {
    setState(() {
      _name.text = (c['name'] ?? '').toString();
      _acct.text = (c['accountNumber'] ?? '').toString();
      _phone.text = (c['phone'] ?? '').toString();
      _addr.text = (c['address'] ?? '').toString();
      _source = (c['source'] ?? '').toString();
      _results = [];
      _lookupMsg = '';
      _dupes = null;
    });
    FocusScope.of(context).unfocus();
  }

  Future<void> _runLookup(String q) async {
    final id = ++_reqId;
    setState(() {
      _searching = true;
      _lookupMsg = '';
    });
    try {
      final data = await api('/api/lookup?q=${Uri.encodeQueryComponent(q)}');
      if (id != _reqId) return;
      final found = (data['results'] as List).cast<Map<String, dynamic>>();
      if (found.length == 1 && RegExp(r'^\d+$').hasMatch(q)) {
        _pick(found.first);
      } else {
        setState(() {
          _results = found;
          if (found.isEmpty) _lookupMsg = 'No customer found. Check the details or switch to Manual.';
        });
      }
    } catch (e) {
      if (id == _reqId) {
        setState(() {
          _results = [];
          _lookupMsg = '${friendly(e)} You can still add the repair using Manual.';
        });
      }
    } finally {
      if (id == _reqId && mounted) setState(() => _searching = false);
    }
  }

  void _onSearchInput(bool isAccount, String value) {
    setState(() {
      _source = '';
      _dupes = null;
    });
    _timer?.cancel();
    final q = value.trim();
    if (q.length < (isAccount ? 6 : 3)) {
      _reqId++;
      setState(() {
        _results = [];
        _lookupMsg = '';
        _searching = false;
      });
      return;
    }
    _timer = Timer(const Duration(milliseconds: 600), () => _runLookup(q));
  }

  // ---------- MANUAL ----------
  void _onPaste(String value) {
    setState(() => _dupes = null);
    if (value.trim().isEmpty) {
      _name.clear();
      _acct.clear();
      _phone.clear();
      _addr.clear();
      setState(() {
        _choice = '';
        _other.clear();
      });
      return;
    }
    final p = parseRepairText(value);
    _name.text = p['name']!;
    _acct.text = p['accountNumber']!;
    _phone.text = p['phone']!;
    _addr.text = p['address']!;
    final m = matchConcern(p['concern']);
    setState(() {
      _choice = m.choice;
      _other.text = m.other;
    });
  }

  // ---------- SAVE ----------
  Future<void> _save(bool force) async {
    setState(() => _error = '');
    if (_name.text.trim().isEmpty) return setState(() => _error = 'Name is required.');
    if (_choice.isEmpty) return setState(() => _error = 'Choose a concern.');
    if (_choice == 'OTHERS' && _other.text.trim().isEmpty) {
      return setState(() => _error = 'Type the concern.');
    }

    setState(() => _busy = true);
    try {
      if (!force) {
        final found = await findDuplicates(_acct.text, _phone.text);
        if (found.isNotEmpty) {
          setState(() {
            _dupes = found;
            _busy = false;
          });
          return;
        }
      }
      final me = context.read<AuthState>().profile!;
      await FirebaseFirestore.instance.collection('repairs').add({
        'name': _name.text.trim(),
        'accountNumber': _acct.text.trim(),
        'phone': _phone.text.trim(),
        'address': _addr.text.trim(),
        'concern': _concern,
        'status': 'pending',
        'createdBy': me.id,
        'createdByName': me.name,
        'createdAt': FieldValue.serverTimestamp(),
        'takenBy': null,
        'takenByName': null,
        'takenAt': null,
        'helpRequested': false,
        'helperId': null,
        'helperName': null,
        'completedAt': null,
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      debugPrint('save repair: $e');
      if (mounted) {
        setState(() {
          _error = 'Could not save. Check your connection and try again.';
          _busy = false;
        });
      }
    }
  }

  Widget _field(String label, TextEditingController c,
      {TextInputType? type, ValueChanged<String>? onChanged, bool autofocus = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: c,
        keyboardType: type,
        autofocus: autofocus,
        onChanged: (v) {
          setState(() => _dupes = null);
          onChanged?.call(v);
        },
        decoration: InputDecoration(labelText: label),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasOpen = _dupes?.any((d) => d.status == 'pending' || d.status == 'in_progress') ?? false;

    return Scaffold(
      appBar: AppBar(title: const Text('New repair')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SegmentedButton<String>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: 'auto', label: Text('Auto')),
              ButtonSegment(value: 'manual', label: Text('Manual')),
            ],
            selected: {_mode},
            onSelectionChanged: (v) => setState(() {
              _mode = v.first;
              _results = [];
              _lookupMsg = '';
              _dupes = null;
            }),
          ),
          const SizedBox(height: 14),
          if (_mode == 'auto') ...[
            const Text('Type an account number or an account name. The rest fills in from the customer portal.',
                style: TextStyle(color: kMuted, fontSize: 13)),
            const SizedBox(height: 12),
            _field('Account number', _acct,
                type: TextInputType.number, autofocus: true, onChanged: (v) => _onSearchInput(true, v)),
            _field('Account name', _name, onChanged: (v) => _onSearchInput(false, v)),
            if (_searching) const Text('Searching the portal…', style: TextStyle(color: kMuted)),
            if (_lookupMsg.isNotEmpty)
              Panel(child: Text(_lookupMsg, style: const TextStyle(color: Color(0xFFB45309)))),
            for (final c in _results)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => _pick(c),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12), border: Border.all(color: kLine)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${c['name']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                        Text('${c['accountNumber']} · ${c['source']}',
                            style: const TextStyle(color: kMuted, fontSize: 12.5)),
                        Text('${c['address']}', style: const TextStyle(color: kMuted, fontSize: 12.5)),
                      ]),
                    ),
                  ),
                ),
              ),
            if (_source.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text('Filled from $_source',
                    style: const TextStyle(color: kOk, fontWeight: FontWeight.w700, fontSize: 13)),
              ),
            _field('Phone number', _phone, type: TextInputType.phone),
            _field('Address', _addr),
          ] else ...[
            TextField(
              controller: _raw,
              minLines: 5,
              maxLines: 8,
              onChanged: _onPaste,
              decoration: const InputDecoration(
                  labelText: 'Paste customer details',
                  hintText: 'Account Name\nPhone Number\nAccount Number\nAddress',
                  alignLabelWithHint: true),
            ),
            const SizedBox(height: 6),
            const Text('The fields below fill in automatically. Check them before saving.',
                style: TextStyle(color: kMuted, fontSize: 13)),
            const SizedBox(height: 12),
            _field('Name', _name),
            _field('Account number', _acct, type: TextInputType.number),
            _field('Phone number', _phone, type: TextInputType.phone),
            _field('Address', _addr),
          ],
          const Text('Concern', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 4, children: [
            for (final c in concerns)
              ChoiceChip(
                label: Text(c),
                selected: _choice == c,
                selectedColor: kOrange.withOpacity(0.25),
                onSelected: (_) => setState(() {
                  _choice = c;
                  _dupes = null;
                }),
              ),
          ]),
          if (_choice == 'OTHERS')
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: TextField(
                controller: _other,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(hintText: 'Type the concern'),
              ),
            ),
          ErrorText(_error),
          if (_dupes != null) ...[
            const SizedBox(height: 14),
            Panel(
              border: kOrange,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Row(children: [
                  Icon(Icons.warning_amber_rounded, color: kOrange),
                  SizedBox(width: 8),
                  Expanded(
                      child: Text('This customer may already have a repair',
                          style: TextStyle(fontWeight: FontWeight.w800))),
                ]),
                const SizedBox(height: 6),
                Text(hasOpen
                    ? 'A repair with the same details is still open.'
                    : 'Repairs with the same details were added before.'),
                const SizedBox(height: 6),
                for (final d in _dupes!.take(5))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Flexible(child: Text(d.name, style: const TextStyle(fontWeight: FontWeight.w700))),
                        const SizedBox(width: 8),
                        StatusBadge(d.status),
                      ]),
                      Text('Same ${d.reasons.join(' and ')} · ${fmtDate(d.createdAt)} · ${d.concern}',
                          style: const TextStyle(color: kMuted, fontSize: 12.5)),
                    ]),
                  ),
                const SizedBox(height: 6),
                const Text('Do you still want to add this as a new repair?'),
              ]),
            ),
          ],
          const SizedBox(height: 18),
          if (_dupes != null)
            Row(children: [
              Expanded(
                  child: OutlinedButton(
                      onPressed: () => setState(() => _dupes = null),
                      child: const Text('Go back and edit'))),
              const SizedBox(width: 10),
              Expanded(
                  child: FilledButton(
                      onPressed: _busy ? null : () => _save(true),
                      child: Text(_busy ? 'Saving…' : 'Add anyway'))),
            ])
          else
            SizedBox(
              height: 48,
              child: FilledButton(
                  onPressed: _busy ? null : () => _save(false),
                  child: Text(_busy ? 'Checking…' : 'Add repair')),
            ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }
}
