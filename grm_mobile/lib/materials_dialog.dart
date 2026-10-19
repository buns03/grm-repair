import 'package:flutter/material.dart';
import 'models.dart';
import 'util.dart';
import 'widgets.dart';

class MaterialsDialog extends StatefulWidget {
  final Repair repair;
  final Future<void> Function(Map<String, num>) onSubmit;
  const MaterialsDialog({super.key, required this.repair, required this.onSubmit});
  @override
  State<MaterialsDialog> createState() => _MaterialsDialogState();
}

class _MaterialsDialogState extends State<MaterialsDialog> {
  final _c = {for (final m in materialItems) m.key: TextEditingController()};
  bool _busy = false;
  String _error = '';

  Future<void> _submit() async {
    final out = <String, num>{};
    for (final m in materialItems) {
      final raw = _c[m.key]!.text.trim();
      if (raw.isEmpty) {
        out[m.key] = 0;
        continue;
      }
      final n = num.tryParse(raw);
      final whole = m.unit == 'pcs';
      if (n == null || n < 0 || (whole && n != n.truncate())) {
        setState(() => _error = '${m.label} must be ${whole ? 'a whole number' : 'a number'}, 0 or more.');
        return;
      }
      out[m.key] = n;
    }
    setState(() {
      _error = '';
      _busy = true;
    });
    try {
      await widget.onSubmit(out);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => _error = friendly(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Materials used'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Enter what was used for ${widget.repair.name}. This repair will be closed as successful and can\'t be undone.',
                style: const TextStyle(fontSize: 13)),
            const SizedBox(height: 12),
            for (final m in materialItems)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: TextField(
                  controller: _c[m.key],
                  keyboardType: TextInputType.numberWithOptions(decimal: m.unit == 'm'),
                  decoration: InputDecoration(
                    labelText: '${m.label} (${m.unit == 'm' ? 'meters' : 'qty'}) · optional',
                    hintText: '0',
                  ),
                ),
              ),
            ErrorText(_error),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16A34A)),
          onPressed: _busy ? null : _submit,
          child: Text(_busy ? 'Saving…' : 'Mark successful'),
        ),
      ],
    );
  }
}
