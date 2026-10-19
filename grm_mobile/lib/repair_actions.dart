import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_state.dart';
import 'materials_dialog.dart';
import 'models.dart';
import 'repair_service.dart';
import 'theme.dart';
import 'util.dart';
import 'widgets.dart';

class RepairActions extends StatefulWidget {
  final Repair r;
  final bool compact;
  const RepairActions({super.key, required this.r, this.compact = false});
  @override
  State<RepairActions> createState() => _RepairActionsState();
}

class _RepairActionsState extends State<RepairActions> {
  bool _busy = false;
  String _error = '';

  Future<void> _go(Future<void> Function() fn,
      {String? title, String? message, String? confirmText, bool danger = false}) async {
    if (title != null &&
        !await confirmDialog(context,
            title: title, message: message ?? '', confirmText: confirmText ?? 'Confirm', danger: danger)) {
      return;
    }
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await fn();
    } catch (e) {
      if (mounted) setState(() => _error = friendly(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthState>().profile!;
    if (me.role != 'technician') return const SizedBox.shrink();

    final r = widget.r;
    final mine = r.takenBy == me.id;
    final inProgress = r.status == 'in_progress';
    final waiting = r.status == 'pending' && r.takenBy == null && r.scheduledLater;
    final unclaimed = r.status == 'pending' && r.takenBy == null && !r.scheduledLater;
    final needsHelp = inProgress && r.helpRequested && r.helperId == null;

    final take = FilledButton(
        onPressed: _busy ? null : () => _go(() => takeRepair(r.id, me)),
        child: Text(widget.compact ? 'Take repair' : 'Take this repair'));
    final help = FilledButton(
        style: FilledButton.styleFrom(backgroundColor: kBlue),
        onPressed: _busy ? null : () => _go(() => takeHelp(r.id, me)),
        child: Text('Help ${r.takenByName ?? ''}'));

    if (widget.compact) {
      if (!unclaimed && !(needsHelp && !mine)) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(spacing: 8, children: [
            if (unclaimed) take,
            if (needsHelp && !mine) help,
          ]),
          ErrorText(_error),
        ]),
      );
    }

    Widget note(String t) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(t, style: const TextStyle(color: kMuted, fontSize: 13)));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (waiting) note('Scheduled for ${fmtDate(r.scheduledFor)}. It can be taken from that day.'),
        if (unclaimed) take,
        if (inProgress && mine) ...[
          Row(children: [
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: kOk),
                onPressed: _busy
                    ? null
                    : () => showDialog<void>(
                          context: context,
                          barrierDismissible: false,
                          builder: (_) => MaterialsDialog(
                            repair: r,
                            onSubmit: (m) => finishRepair(r.id, me, true, m),
                          ),
                        ),
                child: const Text('Mark successful'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: kBad),
                onPressed: _busy
                    ? null
                    : () => _go(() => finishRepair(r.id, me, false),
                        title: 'Mark as failed?',
                        message: 'It goes back to pending and is rescheduled for tomorrow. This attempt will be logged.',
                        confirmText: 'Mark failed',
                        danger: true),
                child: const Text('Mark failed'),
              ),
            ),
          ]),
          const SizedBox(height: 8),
          if (!r.helpRequested)
            OutlinedButton(
                onPressed: _busy ? null : () => _go(() => askHelp(r.id, me)),
                child: const Text('Ask for help')),
          if (needsHelp) ...[
            note('Waiting for another technician to help…'),
            OutlinedButton(
                onPressed: _busy ? null : () => _go(() => cancelHelp(r.id, me)),
                child: const Text('Cancel help request')),
          ],
          if (r.helperId != null) note('${r.helperName} is helping you.'),
          if (r.helperId == null)
            TextButton(
              onPressed: _busy
                  ? null
                  : () => _go(() => releaseRepair(r.id, me),
                      title: 'Release this task?',
                      message: 'Another technician will be able to take it.',
                      confirmText: 'Release'),
              child: const Text('Release task'),
            ),
        ],
        if (inProgress && !mine) ...[
          note('Taken by ${r.takenByName}. Only they can mark it done.'),
          if (needsHelp) help,
          if (r.helperId == me.id) note("You're helping ${r.takenByName} with this one."),
          if (r.helperId != null && r.helperId != me.id) note('${r.helperName} is already helping.'),
        ],
        ErrorText(_error),
      ],
    );
  }
}

class DeleteRepairButton extends StatefulWidget {
  final Repair r;
  final bool compact;
  final VoidCallback? onDeleted;
  const DeleteRepairButton({super.key, required this.r, this.compact = false, this.onDeleted});
  @override
  State<DeleteRepairButton> createState() => _DeleteRepairButtonState();
}

class _DeleteRepairButtonState extends State<DeleteRepairButton> {
  bool _busy = false;

  Future<void> _handle() async {
    final ok = await confirmDialog(context,
        title: 'Delete this repair?',
        message:
            'The repair for "${widget.r.name}" will be permanently deleted, along with its comments and attempt history. This can\'t be undone.',
        confirmText: 'Delete',
        danger: true);
    if (!ok) return;
    setState(() => _busy = true);
    try {
      await deleteRepair(widget.r.id);
      widget.onDeleted?.call();
    } catch (e) {
      if (!mounted) return;
      await notifyDialog(context, "Couldn't delete the repair", friendly(e));
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (context.watch<AuthState>().profile!.role == 'technician') return const SizedBox.shrink();
    if (widget.compact) {
      return IconButton(
        visualDensity: VisualDensity.compact,
        onPressed: _busy ? null : _handle,
        icon: const Icon(Icons.delete_outline, color: kBad, size: 22),
        tooltip: 'Delete repair',
      );
    }
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(foregroundColor: kBad, side: const BorderSide(color: kBad)),
      onPressed: _busy ? null : _handle,
      icon: const Icon(Icons.delete_outline, size: 18),
      label: const Text('Delete repair'),
    );
  }
}
