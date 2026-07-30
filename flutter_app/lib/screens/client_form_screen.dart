import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class ClientFormScreen extends StatefulWidget {
  final Client? existing;
  const ClientFormScreen({super.key, this.existing});

  @override
  State<ClientFormScreen> createState() => _ClientFormScreenState();
}

class _ClientFormScreenState extends State<ClientFormScreen> {
  late final nameCtrl = TextEditingController(text: widget.existing?.name);
  late final bankOtherCtrl = TextEditingController(text: widget.existing?.bankTypeOther);
  late final phone1Ctrl = TextEditingController(text: widget.existing?.phone1);
  late final phone2Ctrl = TextEditingController(text: widget.existing?.phone2);
  late final nationalIdCtrl = TextEditingController(text: widget.existing?.nationalId);
  late final passportCtrl = TextEditingController(text: widget.existing?.passportId);
  late final accountCtrl = TextEditingController(text: widget.existing?.accountNumber);
  late final ibanCtrl = TextEditingController(text: widget.existing?.iban);
  late final amountCtrl = TextEditingController(text: widget.existing?.amount);
  late final purchasedByCtrl = TextEditingController(text: widget.existing?.purchasedBy);
  late final bookingDateCtrl = TextEditingController(text: widget.existing?.bookingDate);
  late final pinCtrl = TextEditingController(text: widget.existing?.pinCode);
  late final soldToCtrl = TextEditingController(text: widget.existing?.soldTo);
  late final notesCtrl = TextEditingController(text: widget.existing?.notes);

  late String bankType = widget.existing?.bankType ?? '';
  late String currency = widget.existing?.currency ?? 'د.ل';
  late String paymentType = widget.existing?.paymentType ?? '';
  late bool cardBooked = widget.existing?.cardBooked ?? false;
  late bool isSold = widget.existing?.isSold ?? false;
  bool saving = false;

  bool get isEdit => widget.existing != null;

  @override
  void dispose() {
    for (final c in [
      nameCtrl,
      bankOtherCtrl,
      phone1Ctrl,
      phone2Ctrl,
      nationalIdCtrl,
      passportCtrl,
      accountCtrl,
      ibanCtrl,
      amountCtrl,
      purchasedByCtrl,
      bookingDateCtrl,
      pinCtrl,
      soldToCtrl,
      notesCtrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _err(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _save() async {
    if (nameCtrl.text.trim().isEmpty) return _err('الاسم مطلوب');
    if (bankType.isEmpty) return _err('المصرف مطلوب');
    if (phone1Ctrl.text.trim().isEmpty) return _err('الهاتف مطلوب');
    if (nationalIdCtrl.text.trim().isEmpty) return _err('الرقم الوطني مطلوب');

    setState(() => saving = true);
    final user = FirebaseAuth.instance.currentUser!;
    final data = Client(
      name: nameCtrl.text.trim(),
      bankType: bankType,
      bankTypeOther: bankOtherCtrl.text.trim(),
      phone1: phone1Ctrl.text.trim(),
      phone2: phone2Ctrl.text.trim(),
      nationalId: nationalIdCtrl.text.trim(),
      passportId: passportCtrl.text.trim(),
      accountNumber: accountCtrl.text.trim(),
      iban: ibanCtrl.text.trim().toUpperCase(),
      amount: amountCtrl.text.trim(),
      currency: currency,
      purchasedBy: purchasedByCtrl.text.trim(),
      paymentType: paymentType,
      cardBooked: cardBooked,
      bookingDate: bookingDateCtrl.text.trim(),
      pinCode: pinCtrl.text.trim(),
      soldTo: soldToCtrl.text.trim(),
      isSold: isSold,
      notes: notesCtrl.text.trim(),
    ).toMap();

    try {
      final col = FirebaseFirestore.instance.collection('clients');
      if (isEdit) {
        await col.doc(widget.existing!.id).update({
          ...data,
          'updatedBy': user.email,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      } else {
        await col.add({
          ...data,
          'uid': user.uid,
          'createdBy': user.email,
          'createdAt': FieldValue.serverTimestamp(),
        });
      }
      if (mounted) Navigator.pop(context);
    } catch (e) {
      _err(e.toString());
    }
    if (mounted) setState(() => saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;
    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.card,
        foregroundColor: colors.gold,
        title: Text(isEdit ? '✏️ تعديل عميل' : '➕ إضافة عميل'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ThemedField(label: 'الاسم الكامل *', controller: nameCtrl, colors: colors, hint: 'اسم العميل'),
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('المصرف *', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 5),
                DropdownButtonFormField<String>(
                  value: bankType.isEmpty ? null : bankType,
                  isExpanded: true,
                  dropdownColor: colors.card,
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: colors.inputBg,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: colors.inputBorder)),
                  ),
                  hint: Text('اختر المصرف', style: TextStyle(color: colors.textMuted)),
                  items: bankOptions
                      .map((b) => DropdownMenuItem(value: b, child: Text(b, style: TextStyle(color: colors.text))))
                      .toList(),
                  onChanged: (v) => setState(() => bankType = v ?? ''),
                ),
                if (bankType == 'أخرى') ...[
                  const SizedBox(height: 8),
                  ThemedField(label: 'اكتب اسم المصرف', controller: bankOtherCtrl, colors: colors),
                ],
              ],
            ),
          ),
          ThemedField(label: 'رقم الهاتف 1 *', controller: phone1Ctrl, colors: colors, keyboardType: TextInputType.phone),
          ThemedField(label: 'رقم الهاتف 2', controller: phone2Ctrl, colors: colors, keyboardType: TextInputType.phone),
          ThemedField(label: 'الرقم الوطني *', controller: nationalIdCtrl, colors: colors, keyboardType: TextInputType.number),
          ThemedField(label: 'جواز السفر', controller: passportCtrl, colors: colors),
          ThemedField(label: 'رقم الحساب', controller: accountCtrl, colors: colors),
          ThemedField(label: 'رقم IBAN', controller: ibanCtrl, colors: colors, capitalization: TextCapitalization.characters),
          ThemedField(label: 'المبلغ المدفوع', controller: amountCtrl, colors: colors, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('العملة', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 6),
                SelectChips(options: const ['د.ل', 'USD'], selected: currency, onSelect: (v) => setState(() => currency = v), colors: colors),
              ],
            ),
          ),
          ThemedField(label: 'تم الشراء من طرف', controller: purchasedByCtrl, colors: colors),
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('نوع الحجز', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 6),
                SelectChips(options: const ['كاش', 'حوالة', 'بطاقة'], selected: paymentType, onSelect: (v) => setState(() => paymentType = v), colors: colors),
              ],
            ),
          ),
          ThemedField(label: 'تاريخ الحجز', controller: bookingDateCtrl, colors: colors, hint: '2026-01-01'),
          ThemedField(label: 'الرقم السري', controller: pinCtrl, colors: colors, keyboardType: TextInputType.number),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('تم حجز البطاقة', style: TextStyle(color: colors.textSoft)),
            value: cardBooked,
            activeColor: colors.gold,
            onChanged: (v) => setState(() => cardBooked = v),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('تم بيع البطاقة', style: TextStyle(color: colors.textSoft)),
            value: isSold,
            activeColor: colors.gold,
            onChanged: (v) => setState(() => isSold = v),
          ),
          if (isSold) ThemedField(label: 'بيعت إلى', controller: soldToCtrl, colors: colors),
          ThemedField(label: 'ملاحظات', controller: notesCtrl, colors: colors, maxLines: 3),
          const SizedBox(height: 20),
          PrimaryButton(label: '💾 حفظ', onPressed: _save, loading: saving, colors: colors),
        ],
      ),
    );
  }
}
