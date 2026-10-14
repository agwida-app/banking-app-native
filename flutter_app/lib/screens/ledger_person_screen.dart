import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../models/ledger.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

const _arMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
String _fmtDateHuman(DateTime d) => '${d.day} ${_arMonths[d.month - 1]}';
String _fmtDate(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

class LedgerPersonScreen extends StatefulWidget {
  final LedgerPerson person;
  const LedgerPersonScreen({super.key, required this.person});

  @override
  State<LedgerPersonScreen> createState() => _LedgerPersonScreenState();
}

class _LedgerPersonScreenState extends State<LedgerPersonScreen> {
  void _openForm({LedgerEntry? existing}) {
    final colors = context.read<ThemeController>().colors;
    final amountCtrl = TextEditingController(text: existing?.amount.toStringAsFixed(2));
    final reasonCtrl = TextEditingController(text: existing?.reason);
    var type = existing?.type ?? LedgerEntryType.lana;
    var date = existing?.date ?? DateTime.now();
    var saving = false;
    String? err;

    showModalBottomSheet(
      context: context,
      backgroundColor: colors.bg,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(left: 16, right: 16, top: 10, bottom: MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(color: colors.borderSoft, borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: colors.goldSoft, borderRadius: BorderRadius.circular(10)),
                      child: Icon(existing == null ? Icons.add_circle_outline : Icons.edit_outlined, size: 18, color: colors.gold),
                    ),
                    const SizedBox(width: 10),
                    Text(existing == null ? 'معاملة جديدة' : 'تعديل المعاملة',
                        style: TextStyle(color: colors.text, fontSize: 16, fontWeight: FontWeight.w900)),
                  ],
                ),
                const SizedBox(height: 16),
                if (err != null) MessageBanner(text: err!),
                Text('نوع المعاملة', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: _typeButton(colors, 'لنا', const Color(0xFF2ECC71), type == LedgerEntryType.lana,
                          () => setSheetState(() => type = LedgerEntryType.lana)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _typeButton(colors, 'لهم', const Color(0xFFE74C3C), type == LedgerEntryType.lahom,
                          () => setSheetState(() => type = LedgerEntryType.lahom)),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                ThemedField(
                  label: 'المبلغ (د.ل) *',
                  controller: amountCtrl,
                  colors: colors,
                  hint: '0.00',
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                ),
                ThemedField(label: 'السبب *', controller: reasonCtrl, colors: colors, maxLines: 2, hint: 'مثال: ثمن بطاقة، سلفة...'),
                Text('التاريخ', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 6),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.all(12),
                    side: BorderSide(color: colors.inputBorder),
                    alignment: Alignment.centerRight,
                  ),
                  onPressed: () async {
                    final picked = await showDatePicker(context: ctx, initialDate: date, firstDate: DateTime(2020), lastDate: DateTime(2100));
                    if (picked != null) setSheetState(() => date = picked);
                  },
                  icon: Icon(Icons.calendar_today_outlined, size: 15, color: colors.gold),
                  label: Text(_fmtDate(date), style: TextStyle(color: colors.text)),
                ),
                const SizedBox(height: 14),
                PrimaryButton(
                  label: 'حفظ',
                  colors: colors,
                  loading: saving,
                  onPressed: () async {
                    final amount = double.tryParse(amountCtrl.text.trim());
                    if (amount == null || amount <= 0) {
                      setSheetState(() => err = 'أدخل مبلغاً صحيحاً');
                      return;
                    }
                    if (reasonCtrl.text.trim().isEmpty) {
                      setSheetState(() => err = 'أدخل سبب المعاملة');
                      return;
                    }
                    setSheetState(() {
                      saving = true;
                      err = null;
                    });
                    final user = FirebaseAuth.instance.currentUser!;
                    final data = LedgerEntry(
                      personId: widget.person.id!,
                      type: type,
                      amount: amount,
                      reason: reasonCtrl.text.trim(),
                      date: date,
                    ).toMap();
                    final col = FirebaseFirestore.instance.collection('ledgerEntries');
                    try {
                      if (existing != null) {
                        await col.doc(existing.id).update(data);
                      } else {
                        await col.add({...data, 'uid': user.uid, 'createdAt': FieldValue.serverTimestamp()});
                      }
                      if (ctx.mounted) Navigator.pop(ctx);
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(existing == null ? 'تمت إضافة المعاملة' : 'تم حفظ التعديلات')),
                        );
                      }
                    } catch (e) {
                      setSheetState(() {
                        err = e.toString();
                        saving = false;
                      });
                    }
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _typeButton(AppColors colors, String label, Color color, bool selected, VoidCallback onTap) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 12),
        side: BorderSide(color: selected ? color : colors.inputBorder, width: selected ? 2 : 1),
        backgroundColor: selected ? color.withOpacity(0.12) : null,
      ),
      onPressed: onTap,
      child: Text(label, style: TextStyle(color: selected ? color : colors.textMuted, fontWeight: selected ? FontWeight.w800 : FontWeight.normal)),
    );
  }

  Future<void> _deleteEntry(LedgerEntry e) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('حذف المعاملة'),
        content: const Text('هل تريد حذف هذه المعاملة؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      await FirebaseFirestore.instance.collection('ledgerEntries').doc(e.id).delete();
    }
  }

  Future<void> _deletePerson() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('حذف الشخص'),
        content: Text('هل تريد حذف "${widget.person.name}" وكل معاملاته؟\nلا يمكن التراجع عن هذا الإجراء.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف نهائياً', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm != true) return;
    final db = FirebaseFirestore.instance;
    final entries = await db.collection('ledgerEntries').where('personId', isEqualTo: widget.person.id).get();
    final batch = db.batch();
    for (final d in entries.docs) {
      batch.delete(d.reference);
    }
    batch.delete(db.collection('ledgerPeople').doc(widget.person.id));
    await batch.commit();
    if (mounted) Navigator.pop(context);
  }

  Future<void> _shareStatement() async {
    final user = FirebaseAuth.instance.currentUser!;
    final snap = await FirebaseFirestore.instance
        .collection('ledgerEntries')
        .where('uid', isEqualTo: user.uid)
        .where('personId', isEqualTo: widget.person.id)
        .orderBy('date', descending: true)
        .get();
    final entries = snap.docs.map((d) => LedgerEntry.fromDoc(d.id, d.data())).toList();

    if (entries.isEmpty) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('لا توجد معاملات للمشاركة')));
      return;
    }

    final balance = entries.fold<double>(0, (s, e) => s + (e.type == LedgerEntryType.lana ? e.amount : -e.amount));
    final isZero = balance.abs() < 0.005;
    final balanceLabel = isZero ? 'الحساب متصافٍ' : (balance > 0 ? 'لنا عنده' : 'له عندنا');

    final buffer = StringBuffer()
      ..writeln('كشف حساب — ${widget.person.name}')
      ..writeln('——————————————');
    for (final e in entries) {
      final sign = e.type == LedgerEntryType.lana ? 'لنا' : 'لهم';
      buffer.writeln('${_fmtDate(e.date)} | $sign | ${e.amount.toStringAsFixed(2)} د.ل | ${e.reason}');
    }
    buffer
      ..writeln('——————————————')
      ..writeln('$balanceLabel: ${balance.abs().toStringAsFixed(2)} د.ل');

    await SharePlus.instance.share(ShareParams(text: buffer.toString(), subject: 'كشف حساب - ${widget.person.name}'));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;
    final user = FirebaseAuth.instance.currentUser!;

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.gold,
        foregroundColor: Colors.white,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        title: Text(widget.person.name),
        actions: [
          IconButton(icon: const Icon(Icons.share_outlined), onPressed: _shareStatement),
          IconButton(icon: const Icon(Icons.delete_outline, color: Color(0xFFE74C3C)), onPressed: _deletePerson),
        ],
      ),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance
            .collection('ledgerEntries')
            .where('uid', isEqualTo: user.uid)
            .where('personId', isEqualTo: widget.person.id)
            .orderBy('date', descending: true)
            .snapshots(includeMetadataChanges: true),
        builder: (context, snapshot) {
          final loading = snapshot.connectionState == ConnectionState.waiting;
          final entries = (snapshot.data?.docs ?? []).map((d) => LedgerEntry.fromDoc(d.id, d.data())).toList();
          final balance = entries.fold<double>(0, (s, e) => s + (e.type == LedgerEntryType.lana ? e.amount : -e.amount));
          final isZero = balance.abs() < 0.005;
          final isPositive = balance > 0;
          final color = isZero ? colors.textMuted : (isPositive ? const Color(0xFF2ECC71) : const Color(0xFFE74C3C));
          final label = isZero ? 'الحساب متصافٍ' : (isPositive ? 'لنا عنده' : 'له عندنا');

          return Stack(
            children: [
              Column(
                children: [
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(20),
                    width: double.infinity,
                    decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(18), border: Border.all(color: color.withOpacity(0.3))),
                    child: Column(
                      children: [
                        Text(label, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Text('${balance.abs().toStringAsFixed(2)} د.ل', style: TextStyle(color: color, fontSize: 28, fontWeight: FontWeight.w900)),
                      ],
                    ),
                  ),
                  Expanded(
                    child: loading
                        ? Center(child: CircularProgressIndicator(color: colors.gold))
                        : entries.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.receipt_long_outlined, size: 34, color: colors.textMuted.withOpacity(0.6)),
                                    const SizedBox(height: 8),
                                    Text('لا توجد معاملات بعد', style: TextStyle(color: colors.textMuted)),
                                  ],
                                ),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.fromLTRB(16, 0, 16, 88),
                                itemCount: entries.length,
                                itemBuilder: (context, i) => _entryCard(colors, entries[i]),
                              ),
                  ),
                ],
              ),
              Positioned(
                bottom: 16,
                left: 16,
                child: InkWell(
                  borderRadius: BorderRadius.circular(28),
                  onTap: () => _openForm(),
                  child: Container(
                    width: 56,
                    height: 56,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [colors.gold, colors.gold.withOpacity(0.7)]),
                      boxShadow: [BoxShadow(color: colors.gold.withOpacity(0.4), blurRadius: 16, offset: const Offset(0, 6))],
                    ),
                    child: Icon(Icons.add, color: colors.bg, size: 28),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _entryCard(AppColors colors, LedgerEntry e) {
    final isLana = e.type == LedgerEntryType.lana;
    final color = isLana ? const Color(0xFF2ECC71) : const Color(0xFFE74C3C);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(color: colors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: colors.borderSoft)),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _openForm(existing: e),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: color.withOpacity(0.14), borderRadius: BorderRadius.circular(11)),
                  child: Text(isLana ? 'لنا' : 'لهم', style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 11)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e.reason, style: TextStyle(color: colors.text, fontWeight: FontWeight.w700, fontSize: 13.5), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(_fmtDateHuman(e.date), style: TextStyle(color: colors.textMuted, fontSize: 11)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(e.amount.toStringAsFixed(0), style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 14)),
                const SizedBox(width: 2),
                IconButton(
                  icon: Icon(Icons.delete_outline, size: 18, color: colors.textMuted),
                  splashRadius: 18,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () => _deleteEntry(e),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
