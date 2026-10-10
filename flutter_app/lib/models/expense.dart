import 'package:cloud_firestore/cloud_firestore.dart';

enum ExpenseKind { expense, income }

const expenseCategories = [
  'إيجار',
  'مطعم',
  'تسوق',
  'فواتير',
  'شراء بطاقة',
  'صديق',
  'ادخار',
  'أخرى',
];

class Expense {
  final String? id;
  final ExpenseKind kind;
  final double amount;
  final String category;
  final String person;
  final String note;
  final DateTime date;
  final String? uid;
  final Timestamp? createdAt;

  const Expense({
    this.id,
    required this.kind,
    required this.amount,
    required this.category,
    this.person = '',
    this.note = '',
    required this.date,
    this.uid,
    this.createdAt,
  });

  factory Expense.fromDoc(String id, Map<String, dynamic> d) {
    final rawDate = d['date'];
    DateTime date;
    if (rawDate is Timestamp) {
      date = rawDate.toDate();
    } else if (rawDate is String) {
      date = DateTime.tryParse(rawDate) ?? DateTime.now();
    } else {
      date = DateTime.now();
    }
    return Expense(
      id: id,
      kind: (d['kind'] ?? 'expense') == 'income' ? ExpenseKind.income : ExpenseKind.expense,
      amount: (d['amount'] as num?)?.toDouble() ?? 0,
      category: d['category'] ?? 'أخرى',
      person: d['person'] ?? '',
      note: d['note'] ?? '',
      date: date,
      uid: d['uid'],
      createdAt: d['createdAt'],
    );
  }

  Map<String, dynamic> toMap() => {
        'kind': kind == ExpenseKind.income ? 'income' : 'expense',
        'amount': amount,
        'category': category,
        'person': person,
        'note': note,
        'date': Timestamp.fromDate(date),
      };
}
