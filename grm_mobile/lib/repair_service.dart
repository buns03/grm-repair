import 'package:cloud_firestore/cloud_firestore.dart';
import 'models.dart';
import 'util.dart';

final _db = FirebaseFirestore.instance;

// Re-reads the live repair right before writing, so two technicians
// can never take the same task or the same help request.
Future<void> _run(String id, String? Function(Map<String, dynamic>) check,
    Map<String, dynamic> Function(Map<String, dynamic>) build) async {
  final ref = _db.collection('repairs').doc(id);
  await _db.runTransaction((tx) async {
    final snap = await tx.get(ref);
    if (!snap.exists) throw AppError('This repair no longer exists.');
    final r = snap.data()!;
    final problem = check(r);
    if (problem != null) throw AppError(problem);
    tx.update(ref, build(r));
  });
}

Future<void> takeRepair(String id, Profile me) => _run(
      id,
      (r) {
        if (r['status'] != 'pending' || r['takenBy'] != null) {
          return 'Already taken by ${r['takenByName'] ?? 'another technician'}.';
        }
        final s = r['scheduledFor'];
        if (s is Timestamp && s.toDate().isAfter(DateTime.now())) {
          return 'This repair is scheduled for a later date.';
        }
        return null;
      },
      (_) => {
        'status': 'in_progress',
        'takenBy': me.id,
        'takenByName': me.name,
        'takenAt': FieldValue.serverTimestamp(),
      },
    );

Future<void> askHelp(String id, Profile me) => _run(
      id,
      (r) => r['takenBy'] != me.id || r['status'] != 'in_progress'
          ? 'You can only ask for help on your own task.'
          : r['helpRequested'] == true
              ? 'Help was already requested.'
              : null,
      (_) => {'helpRequested': true, 'helpRequestedAt': FieldValue.serverTimestamp()},
    );

Future<void> cancelHelp(String id, Profile me) => _run(
      id,
      (r) => r['takenBy'] != me.id
          ? "This isn't your task."
          : r['helperId'] != null
              ? '${r['helperName']} already joined.'
              : null,
      (_) => {'helpRequested': false, 'helpRequestedAt': null},
    );

Future<void> takeHelp(String id, Profile me) => _run(
      id,
      (r) => r['helpRequested'] != true || r['status'] != 'in_progress'
          ? 'Help is no longer needed.'
          : r['helperId'] != null
              ? '${r['helperName']} already took this.'
              : r['takenBy'] == me.id
                  ? "You can't help on your own task."
                  : null,
      (_) => {
        'helperId': me.id,
        'helperName': me.name,
        'helpTakenAt': FieldValue.serverTimestamp(),
      },
    );

Map<String, dynamic> _resetFields() => {
      'status': 'pending',
      'takenBy': null,
      'takenByName': null,
      'takenAt': null,
      'helpRequested': false,
      'helpRequestedAt': null,
      'helperId': null,
      'helperName': null,
      'helpTakenAt': null,
    };

Future<void> releaseRepair(String id, Profile me) => _run(
      id,
      (r) => r['takenBy'] != me.id || r['status'] != 'in_progress'
          ? "This isn't your task."
          : r['helperId'] != null
              ? 'A helper already joined. Mark it successful or failed instead.'
              : null,
      (_) => _resetFields(),
    );

// Success or failure: always logs an attempt. A failure sends the repair
// back to pending, scheduled for tomorrow.
Future<void> finishRepair(String id, Profile me, bool success,
    [Map<String, num> materials = const {}]) async {
  final used = Map<String, num>.fromEntries(materials.entries.where((e) => e.value > 0));
  final hasMaterials = success && used.isNotEmpty;

  final ref = _db.collection('repairs').doc(id);
  await _db.runTransaction((tx) async {
    final snap = await tx.get(ref);
    if (!snap.exists) throw AppError('This repair no longer exists.');
    final r = snap.data()!;
    if (r['takenBy'] != me.id || r['status'] != 'in_progress') {
      throw AppError('Only the technician who took this can finish it.');
    }

    tx.set(ref.collection('attempts').doc(), {
      'techId': me.id,
      'techName': me.name,
      'helperId': r['helperId'],
      'helperName': r['helperName'],
      'result': success ? 'successful' : 'failed',
      if (hasMaterials) 'materials': used,
      'takenAt': r['takenAt'],
      'finishedAt': FieldValue.serverTimestamp(),
    });

    if (success) {
      tx.update(ref, {
        'status': 'successful',
        'completedAt': FieldValue.serverTimestamp(),
        if (hasMaterials) 'materials': used,
      });
    } else {
      tx.update(ref, {
        ..._resetFields(),
        'scheduledFor': Timestamp.fromDate(tomorrowStart()),
        'failedAttempts': ((r['failedAttempts'] as num?) ?? 0) + 1,
      });
    }
  });
}

Future<void> setSchedule(String id, DateTime? date) =>
    _db.collection('repairs').doc(id).update({
      'scheduledFor': date == null ? null : Timestamp.fromDate(date),
    });

Future<void> deleteRepair(String id) async {
  final ref = _db.collection('repairs').doc(id);
  final comments = await ref.collection('comments').get();
  final attempts = await ref.collection('attempts').get();
  final children = [...comments.docs, ...attempts.docs];
  if (children.length > 450) {
    throw AppError('This repair has too many comments to delete at once.');
  }
  final batch = _db.batch();
  for (final d in children) {
    batch.delete(d.reference);
  }
  batch.delete(ref);
  await batch.commit();
}
