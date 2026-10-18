import 'package:cloud_firestore/cloud_firestore.dart';

class SubPlan {
  final String id;
  final String label;
  final int months;
  final int days;
  final double price;
  const SubPlan({required this.id, required this.label, this.months = 0, this.days = 0, required this.price});
}

const subPlans = [
  SubPlan(id: '7d', label: '7 أيام', days: 7, price: 5),
  SubPlan(id: '1m', label: 'شهر', months: 1, price: 45),
  SubPlan(id: '3m', label: '3 أشهر', months: 3, price: 125),
  SubPlan(id: '6m', label: '6 أشهر', months: 6, price: 250),
  SubPlan(id: '12m', label: '12 شهر', months: 12, price: 475),
];

DateTime addPlanDuration(int months, int days) {
  final now = DateTime.now();
  if (days > 0) return now.add(Duration(days: days));
  return DateTime(now.year, now.month + months, now.day, now.hour, now.minute, now.second);
}

class DeviceEntry {
  final String uid;
  final String email;
  final String lastSeen;
  final String type;
  const DeviceEntry({required this.uid, required this.email, required this.lastSeen, required this.type});

  factory DeviceEntry.fromMap(Map<String, dynamic> m) => DeviceEntry(
        uid: m['uid'] ?? '',
        email: m['email'] ?? '',
        lastSeen: m['lastSeen'] ?? '',
        type: m['type'] ?? '',
      );

  Map<String, dynamic> toMap() => {'uid': uid, 'email': email, 'lastSeen': lastSeen, 'type': type};
}

class Subscription {
  final String id;
  final String code;
  final String plan;
  final String planLabel;
  final int maxClients;
  final Timestamp? expiresAt;
  final String? usedBy;
  final Timestamp? usedAt;
  final String? usedByEmail;
  final String? createdBy;
  final Timestamp? createdAt;
  final String notes;
  final Map<String, DeviceEntry> devices;

  const Subscription({
    required this.id,
    required this.code,
    required this.plan,
    required this.planLabel,
    this.maxClients = 500,
    this.expiresAt,
    this.usedBy,
    this.usedAt,
    this.usedByEmail,
    this.createdBy,
    this.createdAt,
    this.notes = '',
    this.devices = const {},
  });

  int? get daysLeft {
    if (expiresAt == null) return null;
    final exp = expiresAt!.toDate();
    return (exp.difference(DateTime.now()).inHours / 24).ceil();
  }

  factory Subscription.fromDoc(String id, Map<String, dynamic> d) {
    final devicesMap = <String, DeviceEntry>{};
    final rawDevices = d['devices'];
    if (rawDevices is Map) {
      rawDevices.forEach((k, v) {
        if (v is Map) devicesMap[k] = DeviceEntry.fromMap(Map<String, dynamic>.from(v));
      });
    }
    return Subscription(
      id: id,
      code: d['code'] ?? id,
      plan: d['plan'] ?? '',
      planLabel: d['planLabel'] ?? '',
      maxClients: (d['maxClients'] as num?)?.toInt() ?? 500,
      expiresAt: d['expiresAt'],
      usedBy: d['usedBy'],
      usedAt: d['usedAt'],
      usedByEmail: d['usedByEmail'],
      createdBy: d['createdBy'],
      createdAt: d['createdAt'],
      notes: d['notes'] ?? '',
      devices: devicesMap,
    );
  }
}
