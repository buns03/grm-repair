import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'api.dart';
import 'auth_state.dart';
import 'theme.dart';
import 'util.dart';
import 'widgets.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  late final _name = TextEditingController(text: context.read<AuthState>().profile!.name);
  final _pass = TextEditingController();
  final _confirm = TextEditingController();
  String _msg = '';
  bool _ok = false, _busy = false;

  Future<void> _save() async {
    setState(() => _msg = '');
    if (_pass.text.isNotEmpty && _pass.text != _confirm.text) {
      return setState(() {
        _ok = false;
        _msg = "Passwords don't match.";
      });
    }
    if (_name.text.trim().isEmpty) {
      return setState(() {
        _ok = false;
        _msg = 'Name is required.';
      });
    }
    setState(() => _busy = true);
    final auth = context.read<AuthState>();
    try {
      await api('/api/me', method: 'PATCH', body: {
        'name': _name.text,
        if (_pass.text.isNotEmpty) 'password': _pass.text,
      });
      if (_pass.text.isNotEmpty) {
        await auth.logout(); // sign in again with the new password
        return;
      }
      if (mounted) setState(() {
        _ok = true;
        _msg = 'Saved.';
      });
    } catch (e) {
      if (mounted) setState(() {
        _ok = false;
        _msg = friendly(e);
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<AuthState>().profile!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('My Account', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 14),
            TextField(
                controller: TextEditingController(text: p.email),
                enabled: false,
                decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: Chip(label: Text(p.role), backgroundColor: kBlue.withOpacity(0.12)),
            ),
            const SizedBox(height: 12),
            TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: 12),
            TextField(
              controller: _pass,
              obscureText: true,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'New password (leave blank to keep current)'),
            ),
            if (_pass.text.isNotEmpty) ...[
              const SizedBox(height: 12),
              TextField(
                  controller: _confirm,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Confirm new password')),
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text("You'll be signed out after changing your password.",
                    style: TextStyle(color: kMuted, fontSize: 12.5)),
              ),
            ],
            if (_msg.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(_msg, style: TextStyle(color: _ok ? kOk : kBad)),
              ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save changes')),
            ),
          ]),
        ),
      ],
    );
  }
}
