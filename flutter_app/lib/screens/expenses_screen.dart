import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/expense.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

String _fmtDate(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

class ExpensesScreen extends StatefulWidget {
  final bool embedded;
  const ExpensesScreen({super.key, this.embedded = false});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  String filterKind = 'all'; // all | expense | income
  String filterCategory = 'all';

  void _openForm({Expense? existing}) {
    final colors = context.read<ThemeController>().colors;
    final amountCtrl = TextEditingController(text: existing?.amount.toStringAsFixed(2));
    final personCtrl = TextEditingController(text: existing?.person);
    final noteCtrl = TextEditingController(text: existing?.note);
    var kind = existing?.kind ?? ExpenseKind.expense;
    var category = existing?.category ?? expenseCategories.first;
    var date = existing?.date ?? DateTime.now();
    var saving = false;
    String? err;

    showModalBottomSheet(
      context: context,
      backgroundColor: colors.bg,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(existing == null ? '➕ حركة مالية جديدة' : '✏️ تعديل الحركة',
                    style: TextStyle(color: colors.gold, fontSize: 16, fontWeight: FontWeight.w900)),
                const SizedBox(height: 12),
                if (err != null) MessageBanner(text: err!),
                Text('نوع الحركة', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: _kindButton(colors, 'مصروف 🔻', kind == ExpenseKind.expense, () => setSheetState(() => kind = ExpenseKind.expense)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _kindButton(colors, 'دخل 🔺', kind == ExpenseKind.income, () => setSheetState(() => kind = ExpenseKind.income)),
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
                Text('الفئة', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 6),
                SelectChips(
                  colors: colors,
                  selected: category,
                  options: expenseCategories,
                  onSelect: (v) => setSheetState(() => category = v),
                ),
                const SizedBox(height: 14),
                ThemedField(
                  label: 'الشخص (اختياري — من أعطيت / من أخذت)',
                  controller: personCtrl,
                  colors: colors,
                  hint: 'مثال: أحمد',
                ),
                Text('التاريخ', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 6),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.all(12), side: BorderSide(color: colors.inputBorder)),
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: date,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                    );
                    if (picked != null) setSheetState(() => date = picked);
                  },
                  child: Text(_fmtDate(date), style: TextStyle(color: colors.text)),
                ),
                const SizedBox(height: 14),
                ThemedField(label: 'ملاحظة', controller: noteCtrl, colors: colors, maxLines: 2, hint: 'مثال: إيجار شهر يوليو'),
                const SizedBox(height: 8),
                PrimaryButton(
                  label: '💾 حفظ',
                  colors: colors,
                  loading: saving,
                  onPressed: () async {
                    final amount = double.tryParse(amountCtrl.text.trim());
                    if (amount == null || amount <= 0) {
                      setSheetState(() => err = 'أدخل مبلغاً صحيحاً');
                      return;
                    }
                    setSheetState(() {
                      saving = true;
                      err = null;
                    });
                    final user = FirebaseAuth.instance.currentUser!;
                    final data = Expense(
                      kind: kind,
                      amount: amount,
                      category: category,
                      person: personCtrl.text.trim(),
                      note: noteCtrl.text.trim(),
                      date: date,
                    ).toMap();
                    final col = FirebaseFirestore.instance.collection('expenses');
                    try {
                      if (existing != null) {
                        await col.doc(existing.id).update(data);
                      } else {
                        await col.add({...data, 'uid': user.uid, 'createdAt': FieldValue.serverTimestamp()});
                      }
                      if (ctx.mounted) Navigator.pop(ctx);
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

  Widget _labeledChips(AppColors colors, String selected, Map<String, String> optionLabels, ValueChanged<String> onSelect) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: optionLabels.entries.map((e) {
        final isSel = e.key == selected;
        return ChoiceChip(
          label: Text(e.value),
          selected: isSel,
          onSelected: (_) => onSelect(e.key),
          backgroundColor: colors.inputBg,
          selectedColor: colors.goldSoft,
          labelStyle: TextStyle(color: isSel ? colors.gold : colors.textMuted, fontWeight: isSel ? FontWeight.w700 : FontWeight.normal, fontSize: 12),
          side: BorderSide(color: isSel ? colors.gold : colors.inputBorder),
        );
      }).toList(),
    );
  }

  Widget _kindButton(AppColors colors, String label, bool selected, VoidCallback onTap) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 12),
        side: BorderSide(color: selected ? colors.gold : colors.inputBorder, width: selected ? 2 : 1),
        backgroundColor: selected ? colors.goldSoft : null,
      ),
      onPressed: onTap,
      child: Text(label, style: TextStyle(color: selected ? colors.gold : colors.textMuted, fontWeight: selected ? FontWeight.w700 : FontWeight.normal)),
    );
  }

  Future<void> _delete(Expense e) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('🗑 حذف الحركة'),
        content: const Text('هل تريد حذف هذه الحركة المالية؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      await FirebaseFirestore.instance.collection('expenses').doc(e.id).delete();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;
    final user = FirebaseAuth.instance.currentUser!;

    final body = StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('expenses')
          .where('uid', isEqualTo: user.uid)
          .orderBy('date', descending: true)
          .snapshots(includeMetadataChanges: true),
      builder: (context, snapshot) {
        final loading = snapshot.connectionState == ConnectionState.waiting;
        final isOffline = snapshot.data?.metadata.isFromCache ?? false;
        final all = (snapshot.data?.docs ?? []).map((d) => Expense.fromDoc(d.id, d.data())).toList();

        final totalExpense = all.where((e) => e.kind == ExpenseKind.expense).fold<double>(0, (s, e) => s + e.amount);
        final totalIncome = all.where((e) => e.kind == ExpenseKind.income).fold<double>(0, (s, e) => s + e.amount);
        final net = totalIncome - totalExpense;

        final filtered = all.where((e) {
          final fk = filterKind == 'all' || (filterKind == 'expense' && e.kind == ExpenseKind.expense) || (filterKind == 'income' && e.kind == ExpenseKind.income);
          final fc = filterCategory == 'all' || e.category == filterCategory;
          return fk && fc;
        }).toList();

        return Stack(
          children: [
            Column(
              children: [
                OfflineBanner(isOffline: isOffline),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Expanded(child: StatCard(icon: '🔻', value: totalExpense.toStringAsFixed(0), label: 'إجمالي المصروفات', valueColor: const Color(0xFFE74C3C), colors: colors)),
                      const SizedBox(width: 10),
                      Expanded(child: StatCard(icon: '🔺', value: totalIncome.toStringAsFixed(0), label: 'إجمالي الدخل', valueColor: const Color(0xFF2ECC71), colors: colors)),
                      const SizedBox(width: 10),
                      Expanded(child: StatCard(icon: '💼', value: net.toStringAsFixed(0), label: 'الصافي', valueColor: net >= 0 ? colors.gold : const Color(0xFFE74C3C), colors: colors)),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _labeledChips(colors, filterKind, const {
                        'all': 'الكل',
                        'expense': '🔻 مصروف',
                        'income': '🔺 دخل',
                      }, (v) => setState(() => filterKind = v)),
                      const SizedBox(height: 8),
                      _labeledChips(
                        colors,
                        filterCategory,
                        {'all': 'كل الفئات', for (final c in expenseCategories) c: c},
                        (v) => setState(() => filterCategory = v),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: loading
                      ? Center(child: CircularProgressIndicator(color: colors.gold))
                      : filtered.isEmpty
                          ? Center(child: Text('لا توجد حركات مالية بعد', style: TextStyle(color: colors.textMuted)))
                          : ListView.builder(
                              padding: const EdgeInsets.fromLTRB(14, 0, 14, 90),
                              itemCount: filtered.length,
                              itemBuilder: (context, i) => _expenseCard(colors, filtered[i]),
                            ),
                ),
              ],
            ),
            Positioned(
              bottom: 16,
              left: 16,
              child: FloatingActionButton(
                backgroundColor: colors.gold,
                foregroundColor: colors.bg,
                onPressed: () => _openForm(),
                child: const Icon(Icons.add, size: 28),
              ),
            ),
          ],
        );
      },
    );

    if (widget.embedded) return Container(color: colors.bg, child: body);

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(backgroundColor: colors.card, foregroundColor: colors.gold, title: const Text('💰 المصروفات')),
      body: body,
    );
  }

  Widget _expenseCard(AppColors colors, Expense e) {
    final isExpense = e.kind == ExpenseKind.expense;
    final color = isExpense ? const Color(0xFFE74C3C) : const Color(0xFF2ECC71);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: colors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: colors.borderSoft)),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
            child: Text(isExpense ? '🔻' : '🔺'),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(e.category, style: TextStyle(color: colors.text, fontWeight: FontWeight.w700, fontSize: 14))),
                    Text('${isExpense ? '-' : '+'}${e.amount.toStringAsFixed(2)} د.ل',
                        style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 14)),
                  ],
                ),
                if (e.person.isNotEmpty)
                  Text(isExpense ? '👤 أُعطيت لـ: ${e.person}' : '👤 من: ${e.person}', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                if (e.note.isNotEmpty) Text(e.note, style: TextStyle(color: colors.textSoft, fontSize: 12)),
                Text(_fmtDate(e.date), style: TextStyle(color: colors.textMuted, fontSize: 11)),
              ],
            ),
          ),
          PopupMenuButton<String>(
            icon: Icon(Icons.more_vert, color: colors.textMuted),
            onSelected: (v) {
              if (v == 'edit') _openForm(existing: e);
              if (v == 'delete') _delete(e);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'edit', child: Text('✏️ تعديل')),
              PopupMenuItem(value: 'delete', child: Text('🗑 حذف')),
            ],
          ),
        ],
      ),
    );
  }
}
