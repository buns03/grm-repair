import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'theme.dart';

class AppError implements Exception {
  final String message;
  AppError(this.message);
  @override
  String toString() => message;
}

String friendly(Object e) {
  if (e is FirebaseException) {
    return e.code == 'permission-denied'
        ? 'Someone just changed this task, or the database rules block this action. Please check it again.'
        : (e.message ?? e.code);
  }
  return e is AppError ? e.message : e.toString().replaceFirst('Exception: ', '');
}

String fmtDate(DateTime? d) => d == null ? '' : DateFormat.yMMMd().format(d);
String fmtDateTime(DateTime? d) =>
    d == null ? '' : DateFormat.yMMMd().add_jm().format(d);

String fmtDuration(num? ms) {
  if (ms == null || ms.isNaN || ms < 0) return '—';
  final mins = (ms / 60000).round();
  if (mins < 1) return '<1 min';
  final d = mins ~/ 1440, h = (mins % 1440) ~/ 60, m = mins % 60;
  return [if (d > 0) '${d}d', if (h > 0) '${h}h', if (m > 0) '${m}m'].join(' ');
}

DateTime tomorrowStart() {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day + 1);
}

bool sameDay(DateTime? a, DateTime b) =>
    a != null && a.year == b.year && a.month == b.month && a.day == b.day;

const statusLabels = {
  'pending': 'Pending',
  'in_progress': 'In progress',
  'successful': 'Successful',
  'failed': 'Failed',
};

Color statusColor(String s) {
  switch (s) {
    case 'pending':
      return const Color(0xFFB45309);
    case 'in_progress':
      return kBlue;
    case 'successful':
      return kOk;
    default:
      return kBad;
  }
}

// ---------- concerns ----------
const concerns = [
  'RED LOS',
  'NO INTERNET CONNECTION',
  'CHANGE/FORGOT PASSWORD',
  'SLOW BROWSE',
  'OTHERS',
];

const _aliases = {
  'RED LOS': ['RED LOS', 'LOS', 'LOS RED'],
  'NO INTERNET CONNECTION': ['NO INTERNET CONNECTION', 'NO INTERNET', 'NO CONNECTION', 'SLOW BROWSE'],
  'CHANGE/FORGOT PASSWORD': ['CHANGE/FORGOT PASSWORD', 'CHANGE PASSWORD', 'FORGOT PASSWORD', 'CHANGE/FORGOT PW'],
};

({String choice, String other}) matchConcern(String? text) {
  final raw = (text ?? '').trim();
  if (raw.isEmpty) return (choice: '', other: '');
  final t = raw.toUpperCase().replaceAll(RegExp(r'\s+'), ' ');
  for (final e in _aliases.entries) {
    if (e.value.contains(t)) return (choice: e.key, other: '');
  }
  return (choice: 'OTHERS', other: raw);
}

// ---------- materials ----------
class MaterialItem {
  final String key, label, unit;
  const MaterialItem(this.key, this.label, this.unit);
}

const materialItems = [
  MaterialItem('fic_blue', 'FIC Blue', 'pcs'),
  MaterialItem('fic_green', 'FIC Green', 'pcs'),
  MaterialItem('foc', 'FOC', 'm'),
  MaterialItem('modem', 'MODEM', 'pcs'),
  MaterialItem('adapter', 'ADAPTER', 'pcs'),
];

String formatMaterials(Map<String, dynamic>? m) {
  if (m == null) return '';
  return materialItems
      .where((x) => ((m[x.key] as num?) ?? 0) > 0)
      .map((x) => x.key == 'foc' ? '${x.label} ${m[x.key]} m' : '${x.label} × ${m[x.key]}')
      .join(' · ');
}

// ---------- pasted text (Manual mode) ----------
Map<String, String> parseRepairText(String raw) {
  final text = raw.replaceAll('\r', '').trim();
  final match = RegExp(r'^\s*concern\s*:?', multiLine: true, caseSensitive: false).firstMatch(text);
  final head = match != null ? text.substring(0, match.start) : text;
  final concern = match != null ? text.substring(match.end).trim() : '';
  final lines = head.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty);

  var name = '', phone = '', account = '';
  final address = <String>[];
  for (final line in lines) {
    final compact = line.replaceAll(RegExp(r'[\s-]'), '');
    final isNumber = RegExp(r'^\+?\d+$').hasMatch(compact);
    if (isNumber && phone.isEmpty && RegExp(r'^(\+?63|0)9\d{9}$').hasMatch(compact)) {
      phone = compact;
    } else if (isNumber && account.isEmpty) {
      account = compact;
    } else if (name.isEmpty) {
      name = line;
    } else {
      address.add(line);
    }
  }
  return {
    'name': name,
    'accountNumber': account,
    'phone': phone,
    'address': address.join(', '),
    'concern': concern,
  };
}

// ---------- duplicates ----------
List<String> phoneVariants(String raw) {
  final digits = raw.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return [];
  final core = digits.startsWith('63')
      ? digits.substring(2)
      : digits.startsWith('0')
          ? digits.substring(1)
          : digits;
  if (core.length != 10) return [raw.trim()];
  return ['0$core', '63$core', '+63$core'];
}

class Dupe {
  final String id, name, status, concern;
  final DateTime? createdAt;
  final Set<String> reasons;
  Dupe(this.id, this.name, this.status, this.concern, this.createdAt, this.reasons);
}

Future<List<Dupe>> findDuplicates(String account, String phone) async {
  final db = FirebaseFirestore.instance;
  final found = <String, Dupe>{};

  void add(QuerySnapshot<Map<String, dynamic>> snap, String reason) {
    for (final d in snap.docs) {
      final prev = found[d.id];
      if (prev != null) {
        prev.reasons.add(reason);
        continue;
      }
      final x = d.data();
      found[d.id] = Dupe(
        d.id,
        (x['name'] ?? '').toString(),
        (x['status'] ?? '').toString(),
        (x['concern'] ?? '').toString(),
        x['createdAt'] is Timestamp ? (x['createdAt'] as Timestamp).toDate() : null,
        {reason},
      );
    }
  }

  final acct = account.trim();
  if (acct.isNotEmpty) {
    add(await db.collection('repairs').where('accountNumber', isEqualTo: acct).limit(10).get(),
        'account number');
  }
  final phones = phoneVariants(phone);
  if (phones.isNotEmpty) {
    add(await db.collection('repairs').where('phone', whereIn: phones).limit(10).get(),
        'phone number');
  }

  final list = found.values.toList()
    ..sort((a, b) => (b.createdAt?.millisecondsSinceEpoch ?? 0)
        .compareTo(a.createdAt?.millisecondsSinceEpoch ?? 0));
  return list;
}
