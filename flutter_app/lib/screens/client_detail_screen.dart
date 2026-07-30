import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../theme/app_theme.dart';
import 'client_form_screen.dart';

class _Row {
  final String label;
  final String value;
  final bool canCopy;
  const _Row(this.label, this.value, {this.canCopy = false});
}

class ClientDetailScreen extends StatelessWidget {
  final Client client;
  const ClientDetailScreen({super.key, required this.client});

  String _fmt(Timestamp? ts) {
    if (ts == null) return '—';
    final d = ts.toDate();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  Future<void> _delete(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('🗑 حذف العميل'),
        content: Text('هل تريد حذف "${client.name}"؟\nلا يمكن التراجع عن هذا الإجراء.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('حذف نهائياً', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await FirebaseFirestore.instance.collection('clients').doc(client.id).delete();
      if (context.mounted) Navigator.pop(context);
    }
  }

  void _copy(BuildContext context, String value, String label) {
    if (value.isEmpty || value == '—') return;
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('✅ تم نسخ $label')));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;

    final rows = [
      _Row('الاسم الكامل', client.name),
      _Row('المصرف', client.bankLabel),
      _Row('الهاتف 1', client.phone1, canCopy: true),
      _Row('الهاتف 2', client.phone2.isEmpty ? '—' : client.phone2, canCopy: true),
      _Row('الرقم الوطني', client.nationalId, canCopy: true),
      _Row('جواز السفر', client.passportId.isEmpty ? '—' : client.passportId, canCopy: true),
      _Row('رقم الحساب', client.accountNumber.isEmpty ? '—' : client.accountNumber, canCopy: true),
      _Row('IBAN', client.iban.isEmpty ? '—' : client.iban, canCopy: true),
      _Row('المبلغ', client.amount.isEmpty ? '—' : '${client.amountValue.toStringAsFixed(2)} ${client.currency}'),
      _Row('تم الشراء من طرف', client.purchasedBy.isEmpty ? '—' : client.purchasedBy),
      _Row('نوع الحجز', client.paymentType.isEmpty ? '—' : client.paymentType),
      _Row('حالة البطاقة', client.cardBooked ? '✅ تم الحجز' : '⏳ لم يتم'),
      _Row('تاريخ الحجز', client.bookingDate.isEmpty ? '—' : client.bookingDate),
      _Row('الرقم السري', client.pinCode.isEmpty ? '—' : client.pinCode, canCopy: true),
      _Row('حالة البيع', client.isSold ? '🔴 تم البيع' : '🟢 لم يُباع'),
      _Row('بيعت إلى', client.soldTo.isEmpty ? '—' : client.soldTo),
      _Row('ملاحظات', client.notes.isEmpty ? '—' : client.notes),
      _Row('تاريخ الإضافة', _fmt(client.createdAt)),
      _Row('أضيف بواسطة', client.createdBy ?? '—'),
    ];

    final sections = [
      ('📋 البيانات الأساسية', rows.sublist(0, 4)),
      ('🏦 البيانات المصرفية', rows.sublist(4, 8)),
      ('💳 بيانات البطاقة', rows.sublist(8, 16)),
      ('📝 معلومات إضافية', rows.sublist(16)),
    ];

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.card,
        foregroundColor: colors.gold,
        title: Text('👤 ${client.name}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ClientFormScreen(existing: client))),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          for (final (title, sectionRows) in sections)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: colors.borderSoft),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    color: colors.goldSoft,
                    child: Text(title, style: TextStyle(color: colors.gold, fontWeight: FontWeight.w700, fontSize: 13)),
                  ),
                  for (final r in sectionRows)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.inputBg))),
                      child: Row(
                        children: [
                          SizedBox(width: 110, child: Text(r.label, style: TextStyle(fontSize: 12, color: colors.textMuted))),
                          Expanded(
                            child: Text(r.value, textAlign: TextAlign.right, style: TextStyle(fontSize: 13, color: colors.text)),
                          ),
                          if (r.canCopy && r.value != '—')
                            IconButton(
                              iconSize: 16,
                              visualDensity: VisualDensity.compact,
                              icon: const Text('📋'),
                              onPressed: () => _copy(context, r.value, r.label),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('إغلاق'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE74C3C)),
                  onPressed: () => _delete(context),
                  child: const Text('🗑 حذف'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
