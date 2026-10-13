import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/expense.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

String _fmtDate(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

const _arMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
String _fmtDateHuman(DateTime d) => '${d.day} ${_arMonths[d.month - 1]}';

const _categoryIcons = {
  'إيجار': Icons.home_outlined,
  'مطعم': Icons.restaurant_outlined,
  'تسوق': Icons.shopping_bag_outlined,
  'فواتير': Icons.receipt_long_outlined,
  'شراء بطاقة': Icons.credit_card,
  'صديق': Icons.person_outline,
  'ادخار': Icons.account_balance_outlined,
  'أخرى': Icons.category_outlined,
};

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
                    Text(existing == null ? 'حركة مالية جديدة' : 'تعديل الحركة',
                        style: TextStyle(color: colors.text, fontSize: 16, fontWeight: FontWeight.w900)),
                  ],
                ),
                const SizedBox(height: 16),
                if (err != null) MessageBanner(text: err!),
                Text('نوع الحركة', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: _kindButton(
                          colors, 'مصروف', Icons.arrow_downward, kind == ExpenseKind.expense, () => setSheetState(() => kind = ExpenseKind.expense)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _kindButton(
                          colors, 'دخل', Icons.arrow_upward, kind == ExpenseKind.income, () => setSheetState(() => kind = ExpenseKind.income)),
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
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.all(12),
                    side: BorderSide(color: colors.inputBorder),
                    alignment: Alignment.centerRight,
                  ),
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: date,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                    );
                    if (picked != null) setSheetState(() => date = picked);
                  },
                  icon: Icon(Icons.calendar_today_outlined, size: 15, color: colors.gold),
                  label: Text(_fmtDate(date), style: TextStyle(color: colors.text)),
                ),
                const SizedBox(height: 14),
                ThemedField(label: 'ملاحظة', controller: noteCtrl, colors: colors, maxLines: 2, hint: 'مثال: إيجار شهر يوليو'),
                const SizedBox(height: 8),
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
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(existing == null ? 'تمت إضافة الحركة' : 'تم حفظ التعديلات')),
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

  Widget _kindButton(AppColors colors, String label, IconData icon, bool selected, VoidCallback onTap) {
    final color = selected ? colors.gold : colors.textMuted;
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 12),
        side: BorderSide(color: selected ? colors.gold : colors.inputBorder, width: selected ? 2 : 1),
        backgroundColor: selected ? colors.goldSoft : null,
      ),
      onPressed: onTap,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: color, fontWeight: selected ? FontWeight.w700 : FontWeight.normal)),
        ],
      ),
    );
  }

  Widget _header(AppColors colors) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.account_balance_wallet_outlined, size: 20, color: colors.gold),
              const SizedBox(width: 6),
              Text('المصروفات', style: TextStyle(color: colors.text, fontSize: 19, fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 3),
          Text('متابعة ما يُصرف ويُدّخر', style: TextStyle(color: colors.textMuted, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _addFab(AppColors colors) {
    return Positioned(
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
    );
  }

  Widget _summaryTile(AppColors colors, String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }

  Future<void> _delete(Expense e) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('حذف الحركة'),
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

        return Column(
              children: [
                OfflineBanner(isOffline: isOffline),
                _header(colors),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                  child: Row(
                    children: [
                      _summaryTile(colors, 'مصروفات', totalExpense.toStringAsFixed(0), const Color(0xFFE74C3C)),
                      const SizedBox(width: 10),
                      _summaryTile(colors, 'دخل', totalIncome.toStringAsFixed(0), const Color(0xFF2ECC71)),
                      const SizedBox(width: 10),
                      _summaryTile(colors, 'صافي', '${net >= 0 ? '+' : ''}${net.toStringAsFixed(0)}', net >= 0 ? colors.gold : const Color(0xFFE74C3C)),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _labeledChips(colors, filterKind, const {
                        'all': 'الكل',
                        'expense': 'مصروف',
                        'income': 'دخل',
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
                const SizedBox(height: 10),
                Expanded(
                  child: loading
                      ? Center(child: CircularProgressIndicator(color: colors.gold))
                      : filtered.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.inbox_outlined, size: 34, color: colors.textMuted.withOpacity(0.6)),
                                  const SizedBox(height: 8),
                                  Text('لا توجد حركات مالية بعد', style: TextStyle(color: colors.textMuted)),
                                ],
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 88),
                              itemCount: filtered.length,
                              itemBuilder: (context, i) => _expenseCard(colors, filtered[i]),
                            ),
                ),
              ],
            );
      },
    );

    if (widget.embedded) {
      return Container(color: colors.bg, child: Stack(children: [body, _addFab(colors)]));
    }

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(backgroundColor: colors.card, foregroundColor: colors.gold, title: const Text('المصروفات')),
      body: Stack(children: [body, _addFab(colors)]),
    );
  }

  Widget _expenseCard(AppColors colors, Expense e) {
    final isExpense = e.kind == ExpenseKind.expense;
    final color = isExpense ? const Color(0xFFE74C3C) : const Color(0xFF2ECC71);
    final categoryIcon = _categoryIcons[e.category] ?? Icons.category_outlined;
    final metaParts = [
      if (e.person.isNotEmpty) (isExpense ? 'إلى ${e.person}' : 'من ${e.person}'),
      _fmtDateHuman(e.date),
    ];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.borderSoft),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _openForm(existing: e),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: color.withOpacity(0.14), borderRadius: BorderRadius.circular(13)),
                  child: Icon(categoryIcon, size: 19, color: color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e.category, style: TextStyle(color: colors.text, fontWeight: FontWeight.w700, fontSize: 13.5)),
                      const SizedBox(height: 2),
                      Text(metaParts.join(' · '),
                          style: TextStyle(color: colors.textMuted, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
                      if (e.note.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(e.note, style: TextStyle(color: colors.textSoft, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text('${isExpense ? '-' : '+'}${e.amount.toStringAsFixed(0)}',
                    style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 14)),
                const SizedBox(width: 2),
                IconButton(
                  icon: Icon(Icons.delete_outline, size: 18, color: colors.textMuted),
                  splashRadius: 18,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () => _delete(e),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
