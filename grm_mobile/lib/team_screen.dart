import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'api.dart';
import 'auth_state.dart';
import 'models.dart';
import 'theme.dart';
import 'util.dart';
import 'widgets.dart';

const _roles = ['user', 'technician', 'admin'];

class TeamScreen extends StatelessWidget {
  const TeamScreen({super.key});

  void _open(BuildContext context, {Profile? member}) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: _AccountSheet(member: member, isSelf: member?.id == context.read<AuthState>().profile!.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final meId = context.watch<AuthState>().profile!.id;
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _open(context),
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Add account'),
      ),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance.collection('users').snapshots(),
        builder: (context, snap) {
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final list = snap.data!.docs.map((d) => Profile(d.id, d.data())).toList()
            ..sort((a, b) => a.name.compareTo(b.name));
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final m = list[i];
              return Panel(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(children: [
                  CircleAvatar(
                      backgroundColor: kOrange,
                      child: Text(m.name.isEmpty ? '?' : m.name[0].toUpperCase(),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${m.name}${m.id == meId ? ' (you)' : ''}',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(m.email, style: const TextStyle(color: kMuted, fontSize: 12.5)),
                      const SizedBox(height: 4),
                      Wrap(spacing: 6, children: [
                        _pill(m.role, kBlue),
                        _pill(m.active ? 'Active' : 'Disabled', m.active ? kOk : kBad),
                      ]),
                    ]),
                  ),
                  IconButton(onPressed: () => _open(context, member: m), icon: const Icon(Icons.edit_outlined)),
                ]),
              );
            },
          );
        },
      ),
    );
  }

  Widget _pill(String t, Color c) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: c.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
        child: Text(t, style: TextStyle(color: c, fontSize: 11.5, fontWeight: FontWeight.w700)),
      );
}

class _AccountSheet extends StatefulWidget {
  final Profile? member;
  final bool isSelf;
  const _AccountSheet({this.member, required this.isSelf});
  @override
  State<_AccountSheet> createState() => _AccountSheetState();
}

class _AccountSheetState extends State<_AccountSheet> {
  late final _name = TextEditingController(text: widget.member?.name ?? '');
  late final _email = TextEditingController(text: widget.member?.email ?? '');
  final _pass = TextEditingController();
  late String _role = widget.member?.role ?? 'technician';
  late bool _active = widget.member?.active ?? true;
  String _error = '';
  bool _busy = false;

  bool get _editing => widget.member != null;

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty || _email.text.trim().isEmpty) {
      return setState(() => _error = 'Name and email are required.');
    }
    if (!_editing && _pass.text.isEmpty) return setState(() => _error = 'Password is required.');
    if (_pass.text.isNotEmpty && _pass.text.length < 6) {
      return setState(() => _error = 'Password must be at least 6 characters.');
    }
    setState(() {
      _error = '';
      _busy = true;
    });
    try {
      if (_editing) {
        await api('/api/users/${widget.member!.id}', method: 'PATCH', body: {
          'name': _name.text,
          'email': _email.text,
          'role': _role,
          'active': _active,
          if (_pass.text.isNotEmpty) 'password': _pass.text,
        });
      } else {
        await api('/api/users', method: 'POST', body: {
          'name': _name.text,
          'email': _email.text,
          'password': _pass.text,
          'role': _role,
        });
      }
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => _error = friendly(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_editing ? 'Edit account' : 'Add account',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 14),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name')),
        const SizedBox(height: 12),
        TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email')),
        const SizedBox(height: 12),
        TextField(
          controller: _pass,
          obscureText: true,
          decoration: InputDecoration(labelText: _editing ? 'New password (leave blank to keep)' : 'Password'),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: _role,
          decoration: const InputDecoration(labelText: 'Role'),
          items: [for (final r in _roles) DropdownMenuItem(value: r, child: Text(r))],
          onChanged: widget.isSelf ? null : (v) => setState(() => _role = v!),
        ),
        if (_editing)
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Account is active'),
            value: _active,
            onChanged: widget.isSelf ? null : (v) => setState(() => _active = v),
          ),
        if (widget.isSelf)
          const Text("You can't change your own role or disable yourself.",
              style: TextStyle(color: kMuted, fontSize: 12.5)),
        ErrorText(_error),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          height: 46,
          child: FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(_busy ? 'Saving…' : _editing ? 'Save' : 'Create'),
          ),
        ),
      ]),
    );
  }
}
