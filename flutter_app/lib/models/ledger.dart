import 'package:cloud_firestore/cloud_firestore.dart';

enum LedgerEntryType { lana, lahom } // لنا / لهم

class LedgerPerson {
  final String? id;
  final String name;
  final String? uid;
  final Timestamp? createdAt;

  const LedgerPerson({this.id, required this.name, this.uid, this.createdAt});

  factory LedgerPerson.fromDoc(String id, Map<String, dynamic> d) => LedgerPerson(
        id: id,
        name: d['name'] ?? '',
        uid: d['uid'],
        createdAt: d['createdAt'],
      );

  Map<String, dynamic> toMap() => {'name': name};
}

class LedgerEntry {
  final String? id;
  final String personId;
  final LedgerEntryType type;
  final double amount;
  final String reason;
  final DateTime date;
  final String? uid;
  final Timestamp? createdAt;

  const LedgerEntry({
    this.id,
    required this.personId,
    required this.type,
    required this.amount,
    required this.reason,
    required this.date,
    this.uid,
    this.createdAt,
  });

  factory LedgerEntry.fromDoc(String id, Map<String, dynamic> d) {
    final rawDate = d['date'];
    DateTime date;
    if (rawDate is Timestamp) {
      date = rawDate.toDate();
    } else if (rawDate is String) {
      date = DateTime.tryParse(rawDate) ?? DateTime.now();
    } else {
      date = DateTime.now();
    }
    return LedgerEntry(
      id: id,
      personId: d['personId'] ?? '',
      type: (d['type'] ?? 'lana') == 'lahom' ? LedgerEntryType.lahom : LedgerEntryType.lana,
      amount: (d['amount'] as num?)?.toDouble() ?? 0,
      reason: d['reason'] ?? '',
      date: date,
      uid: d['uid'],
      createdAt: d['createdAt'],
    );
  }

  Map<String, dynamic> toMap() => {
        'personId': personId,
        'type': type == LedgerEntryType.lahom ? 'lahom' : 'lana',
        'amount': amount,
        'reason': reason,
        'date': Timestamp.fromDate(date),
      };
}
