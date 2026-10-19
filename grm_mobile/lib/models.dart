import 'package:cloud_firestore/cloud_firestore.dart';
import 'util.dart';

DateTime? _ts(Map<String, dynamic> d, String k) {
  final v = d[k];
  return v is Timestamp ? v.toDate() : null;
}

class Profile {
  final String id;
  final Map<String, dynamic> d;
  Profile(this.id, this.d);
  String get name => (d['name'] ?? '').toString();
  String get email => (d['email'] ?? '').toString();
  String get role => (d['role'] ?? 'user').toString();
  bool get active => d['active'] != false;
}

class Repair {
  final String id;
  final Map<String, dynamic> d;
  Repair(this.id, this.d);

  factory Repair.fromDoc(DocumentSnapshot<Map<String, dynamic>> s) =>
      Repair(s.id, s.data() ?? {});

  String _s(String k) => (d[k] ?? '').toString();
  String get name => _s('name');
  String get accountNumber => _s('accountNumber');
  String get phone => _s('phone');
  String get address => _s('address');
  String get concern => _s('concern');
  String get status => _s('status');
  String get createdByName => _s('createdByName');
  String? get takenBy => d['takenBy'] as String?;
  String? get takenByName => d['takenByName'] as String?;
  String? get helperId => d['helperId'] as String?;
  String? get helperName => d['helperName'] as String?;
  bool get helpRequested => d['helpRequested'] == true;
  int get failedAttempts => (d['failedAttempts'] as num?)?.toInt() ?? 0;
  Map<String, dynamic>? get materials =>
      (d['materials'] as Map?)?.cast<String, dynamic>();

  // a just-created repair has no server time yet, so treat it as "now"
  DateTime? get createdAt =>
      _ts(d, 'createdAt') ?? (d.containsKey('createdAt') ? DateTime.now() : null);
  DateTime? get takenAt => _ts(d, 'takenAt');
  DateTime? get completedAt => _ts(d, 'completedAt');
  DateTime? get scheduledFor => _ts(d, 'scheduledFor');

  bool get scheduledLater => scheduledFor != null && scheduledFor!.isAfter(DateTime.now());
  bool get rescheduled => status == 'pending' && failedAttempts > 0;
  bool get needsHelp => status == 'in_progress' && helpRequested && helperId == null;

  bool isToday(DateTime now) =>
      status == 'in_progress' ||
      sameDay(createdAt, now) ||
      sameDay(scheduledFor, now) ||
      sameDay(takenAt, now) ||
      sameDay(completedAt, now);
}

class Attempt {
  final String id;
  final String? repairId;
  final Map<String, dynamic> d;
  Attempt(this.id, this.repairId, this.d);

  factory Attempt.fromDoc(QueryDocumentSnapshot<Map<String, dynamic>> s) =>
      Attempt(s.id, s.reference.parent.parent?.id, s.data());

  String get result => (d['result'] ?? '').toString();
  String? get techId => d['techId'] as String?;
  String? get techName => d['techName'] as String?;
  String? get helperId => d['helperId'] as String?;
  String? get helperName => d['helperName'] as String?;
  DateTime? get takenAt => _ts(d, 'takenAt');
  DateTime? get finishedAt =>
      _ts(d, 'finishedAt') ?? (d.containsKey('finishedAt') ? DateTime.now() : null);
  Map<String, dynamic>? get materials =>
      (d['materials'] as Map?)?.cast<String, dynamic>();
}
