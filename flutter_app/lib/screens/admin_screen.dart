import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/subscription.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

String _genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  final rnd = Random();
  return List.generate(8, (_) => c[rnd.nextInt(c.length)]).join();
}

String _genAffCode(String name) {
  final clean = name.replaceAll(RegExp(r'\s+'), '').toUpperCase();
  final slice = clean.length > 6 ? clean.substring(0, 6) : clean;
  return '$slice${Random().nextInt(80) + 10}';
}

String _fmtDate(Timestamp? ts) {
  if (ts == null) return '—';
  final d = ts.toDate();
  return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  String tab = 'subs';

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.card,
        foregroundColor: colors.gold,
        title: const Text('🛡️ لوحة المدير'),
        actions: [
          IconButton(
            icon: const Text('🔑'),
            onPressed: () => showDialog(context: context, builder: (_) => const _ChangePasswordDialog()),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => FirebaseAuth.instance.signOut(),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(color: colors.overlay, borderRadius: BorderRadius.circular(10)),
            child: Row(
              children: [
                _segButton('subs', '🔑 الاشتراكات', colors),
                _segButton('affiliates', '🤝 المسوّقون', colors),
              ],
            ),
          ),
          Expanded(child: tab == 'subs' ? const _SubsTab() : const _AffiliatesTab()),
        ],
      ),
    );
  }

  Widget _segButton(String value, String label, AppColors colors) {
    final isSel = tab == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => tab = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(color: isSel ? colors.gold : Colors.transparent, borderRadius: BorderRadius.circular(7)),
          alignment: Alignment.center,
          child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isSel ? colors.bg : colors.textMuted)),
        ),
      ),
    );
  }
}

class _ChangePasswordDialog extends StatefulWidget {
  const _ChangePasswordDialog();
  @override
  State<_ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<_ChangePasswordDialog> {
  final current = TextEditingController();
  final newPw = TextEditingController();
  final confirm = TextEditingController();
  bool saving = false;
  String? err;

  Future<void> _submit() async {
    if (current.text.isEmpty) return setState(() => err = 'أدخل كلمة المرور الحالية');
    if (newPw.text.length < 6) return setState(() => err = 'كلمة المرور الجديدة 6 أحرف على الأقل');
    if (newPw.text != confirm.text) return setState(() => err = 'كلمتا المرور غير متطابقتان');
    setState(() {
      saving = true;
      err = null;
    });
    try {
      final user = FirebaseAuth.instance.currentUser!;
      final cred = EmailAuthProvider.credential(email: user.email!, password: current.text);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(newPw.text);
      if (mounted) Navigator.pop(context);
    } on FirebaseAuthException catch (e) {
      const m = {
        'wrong-password': 'كلمة المرور الحالية غير صحيحة',
        'invalid-credential': 'كلمة المرور الحالية غير صحيحة',
        'too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
      };
      setState(() => err = m[e.code] ?? e.message);
    }
    if (mounted) setState(() => saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;
    return AlertDialog(
      backgroundColor: colors.card,
      title: Text('🔑 تغيير كلمة المرور', style: TextStyle(color: colors.gold)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (err != null) MessageBanner(text: err!),
            ThemedField(label: 'كلمة المرور الحالية *', controller: current, colors: colors, obscure: true),
            ThemedField(label: 'كلمة المرور الجديدة *', controller: newPw, colors: colors, obscure: true),
            ThemedField(label: 'تأكيد كلمة المرور *', controller: confirm, colors: colors, obscure: true),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: colors.gold, foregroundColor: colors.bg),
          onPressed: saving ? null : _submit,
          child: saving ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('💾 حفظ'),
        ),
      ],
    );
  }
}

class _SubsTab extends StatefulWidget {
  const _SubsTab();
  @override
  State<_SubsTab> createState() => _SubsTabState();
}

class _SubsTabState extends State<_SubsTab> {
  String? expandedDevices;

  void _copy(String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('✅ تم نسخ $label')));
  }

  Future<void> _deleteSub(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('حذف'),
        content: const Text('هل أنت متأكد؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      await FirebaseFirestore.instance.collection('subscriptions').doc(id).delete();
    }
  }

  Future<void> _resetDevices(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('إعادة ضبط الأجهزة'),
        content: const Text('مسح جميع الأجهزة المسجلة؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('إعادة ضبط')),
        ],
      ),
    );
    if (confirm == true) {
      await FirebaseFirestore.instance.collection('subscriptions').doc(id).update({'devices': {}});
    }
  }

  Future<void> _resetPassword(String? email) async {
    if (email == null || email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('هذا المشترك لم يسجل بريده بعد')));
      return;
    }
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('إعادة تعيين كلمة المرور'),
        content: Text('إرسال رابط إلى:\n$email؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('إرسال')),
        ],
      ),
    );
    if (confirm == true) {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('✅ تم الإرسال إلى $email')));
    }
  }

  void _copyWelcome(Subscription sub) {
    final msg = 'مرحباً 👋\n\nتم تفعيل اشتراكك في تطبيق إدارة بطاقاتك\n\n'
        '🔗 رابط التطبيق:\nhttps://banking-app-pink-six.vercel.app\n\n'
        '🔑 كود التفعيل:\n${sub.code}\n\n'
        '📱 لتثبيت التطبيق:\nافتح الرابط ← زر المشاركة ← "إضافة إلى الشاشة الرئيسية"';
    _copy(msg, 'رسالة الترحيب');
  }

  Future<void> _confirmRenew(Subscription sub, SubPlan plan) async {
    final newExp = addPlanDuration(plan.months, plan.days);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('✅ تأكيد التجديد'),
        content: Text(
            'العميل: ${sub.usedByEmail ?? 'غير مفعّل'}\n\n📦 الباقة: ${plan.label}\n💵 السعر: ${plan.price} د.ل\n📅 ينتهي: ${_fmtDate(Timestamp.fromDate(newExp))}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('تأكيد ✅')),
        ],
      ),
    );
    if (confirm == true) {
      await FirebaseFirestore.instance.collection('subscriptions').doc(sub.id).update({
        'expiresAt': Timestamp.fromDate(newExp),
        'plan': plan.id,
        'planLabel': plan.label,
      });
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('✅ تم تجديد الاشتراك بـ ${plan.label}')));
      }
    }
  }

  void _openRenewSheet(Subscription sub) {
    final colors = context.read<ThemeController>().colors;
    showModalBottomSheet(
      context: context,
      backgroundColor: colors.bg,
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        expand: false,
        builder: (context, scrollController) => Padding(
          padding: const EdgeInsets.all(16),
          child: ListView(
            controller: scrollController,
            children: [
              Text('🔄 تجديد الاشتراك', style: TextStyle(color: colors.gold, fontSize: 16, fontWeight: FontWeight.w900)),
              const SizedBox(height: 12),
              for (final plan in subPlans)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(padding: const EdgeInsets.all(14), side: BorderSide(color: colors.inputBorder)),
                    onPressed: () => _confirmRenew(sub, plan),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(plan.label, style: TextStyle(color: colors.text, fontWeight: FontWeight.w700)),
                              Text('📅 ينتهي: ${_fmtDate(Timestamp.fromDate(addPlanDuration(plan.months, plan.days)))}',
                                  style: TextStyle(color: colors.textMuted, fontSize: 11)),
                            ],
                          ),
                        ),
                        Text('${plan.price} د.ل', style: const TextStyle(color: Color(0xFF2ECC71), fontWeight: FontWeight.w900, fontSize: 16)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _openCreateSheet() {
    final colors = context.read<ThemeController>().colors;
    final codeCtrl = TextEditingController(text: _genCode());
    final maxClientsCtrl = TextEditingController(text: '500');
    final notesCtrl = TextEditingController();
    var plan = '1m';
    var saving = false;

    showModalBottomSheet(
      context: context,
      backgroundColor: colors.bg,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => DraggableScrollableSheet(
          initialChildSize: 0.85,
          expand: false,
          builder: (context, scrollController) => Padding(
            padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(ctx).viewInsets.bottom + 16),
            child: ListView(
              controller: scrollController,
              children: [
                Text('➕ كود اشتراك جديد', style: TextStyle(color: colors.gold, fontSize: 16, fontWeight: FontWeight.w900)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: ThemedField(label: 'كود التفعيل', controller: codeCtrl, colors: colors, capitalization: TextCapitalization.characters),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: () => setSheetState(() => codeCtrl.text = _genCode()),
                      icon: const Text('🎲'),
                    ),
                  ],
                ),
                Text('الباقة', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 6),
                for (final p in subPlans)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.all(12),
                        side: BorderSide(color: plan == p.id ? colors.gold : colors.inputBorder),
                        backgroundColor: plan == p.id ? colors.goldSoft : null,
                      ),
                      onPressed: () => setSheetState(() => plan = p.id),
                      child: Row(
                        children: [
                          Expanded(child: Text(p.label, style: TextStyle(color: plan == p.id ? colors.gold : colors.text))),
                          Text('${p.price} د.ل', style: const TextStyle(color: Color(0xFF2ECC71), fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                ThemedField(label: 'الحد الأقصى للعملاء', controller: maxClientsCtrl, colors: colors, keyboardType: TextInputType.number),
                ThemedField(label: 'ملاحظة', controller: notesCtrl, colors: colors, hint: 'اسم العميل مثلاً'),
                const SizedBox(height: 8),
                PrimaryButton(
                  label: '💾 حفظ',
                  colors: colors,
                  loading: saving,
                  onPressed: () async {
                    if (codeCtrl.text.trim().isEmpty) return;
                    setSheetState(() => saving = true);
                    final selectedPlan = subPlans.firstWhere((p) => p.id == plan);
                    final codeKey = codeCtrl.text.trim().toUpperCase();
                    final exp = addPlanDuration(selectedPlan.months, selectedPlan.days);
                    await FirebaseFirestore.instance.collection('subscriptions').doc(codeKey).set({
                      'code': codeKey,
                      'plan': plan,
                      'planLabel': selectedPlan.label,
                      'maxClients': max(500, int.tryParse(maxClientsCtrl.text) ?? 500),
                      'expiresAt': Timestamp.fromDate(exp),
                      'usedBy': null,
                      'usedAt': null,
                      'usedByEmail': null,
                      'createdBy': FirebaseAuth.instance.currentUser!.uid,
                      'createdAt': FieldValue.serverTimestamp(),
                      'notes': notesCtrl.text,
                      'devices': {},
                    });
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance.collection('subscriptions').orderBy('createdAt', descending: true).snapshots(),
      builder: (context, snapshot) {
        final loading = snapshot.connectionState == ConnectionState.waiting;
        final subs = (snapshot.data?.docs ?? []).map((d) => Subscription.fromDoc(d.id, d.data())).toList();
        final activeCount = subs.where((s) => s.usedBy != null && (s.daysLeft ?? 0) > 0).length;
        final freeCount = subs.where((s) => s.usedBy == null).length;
        final expiredCount = subs.where((s) => (s.daysLeft ?? 1) <= 0).length;

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text('الكل: ${subs.length} | مفعّلة: $activeCount | متاحة: $freeCount | منتهية: $expiredCount',
                        style: TextStyle(fontSize: 11, color: colors.textMuted)),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: colors.gold, foregroundColor: colors.bg),
                    onPressed: _openCreateSheet,
                    child: const Text('＋ كود جديد'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: loading
                  ? Center(child: CircularProgressIndicator(color: colors.gold))
                  : subs.isEmpty
                      ? Center(child: Text('لا يوجد اشتراكات بعد', style: TextStyle(color: colors.textMuted)))
                      : ListView.builder(
                          padding: const EdgeInsets.all(14),
                          itemCount: subs.length,
                          itemBuilder: (context, i) => _subCard(colors, subs[i]),
                        ),
            ),
          ],
        );
      },
    );
  }

  Widget _subCard(AppColors colors, Subscription sub) {
    final days = sub.daysLeft;
    final isActive = sub.usedBy != null && (days ?? 0) > 0;
    final isExpired = (days ?? 1) <= 0;
    final isFree = sub.usedBy == null && !isExpired;
    final deviceCount = sub.devices.length;

    final (chipBg, chipBorder, chipLabel) = isActive
        ? (const Color(0x1A2ECC71), const Color(0x4D2ECC71), '✅ مفعّل')
        : isFree
            ? (const Color(0x1AC9A84C), const Color(0x4DC9A84C), '🔓 متاح')
            : (const Color(0x1AE74C3C), const Color(0x4DE74C3C), '❌ منتهي');

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: colors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: colors.borderSoft)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Flexible(child: Text(sub.code, style: TextStyle(color: colors.gold, fontWeight: FontWeight.w700, fontSize: 15))),
                    IconButton(iconSize: 16, visualDensity: VisualDensity.compact, icon: const Text('📋'), onPressed: () => _copy(sub.code, 'الكود')),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: chipBg, border: Border.all(color: chipBorder), borderRadius: BorderRadius.circular(20)),
                child: Text(chipLabel, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFF8F6F0))),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('📅 ينتهي: ${_fmtDate(sub.expiresAt)} (${(days ?? 0) > 0 ? '$days يوم' : 'منتهي'})', style: TextStyle(fontSize: 12, color: colors.textMuted)),
          if (sub.usedByEmail != null) Text('👤 ${sub.usedByEmail}', style: TextStyle(fontSize: 12, color: colors.textMuted)),
          if (sub.planLabel.isNotEmpty) Text('📦 ${sub.planLabel}', style: TextStyle(fontSize: 12, color: colors.textMuted)),
          Text('👥 الحد: ${sub.maxClients} عميل', style: TextStyle(fontSize: 12, color: colors.textMuted)),
          if (sub.notes.isNotEmpty) Text('📝 ${sub.notes}', style: TextStyle(fontSize: 12, color: colors.textMuted)),
          const SizedBox(height: 8),
          InkWell(
            onTap: () => setState(() => expandedDevices = expandedDevices == sub.id ? null : sub.id),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: colors.inputBg, borderRadius: BorderRadius.circular(8), border: Border.all(color: colors.borderSoft)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('📱 الأجهزة: $deviceCount/7', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.gold)),
                  Text(expandedDevices == sub.id ? '▲' : '▼', style: TextStyle(color: colors.gold, fontSize: 12)),
                ],
              ),
            ),
          ),
          if (expandedDevices == sub.id)
            Container(
              margin: const EdgeInsets.only(top: 6),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: colors.overlay, borderRadius: BorderRadius.circular(8)),
              child: sub.devices.isEmpty
                  ? Text('لا يوجد أجهزة مسجلة', style: TextStyle(fontSize: 12, color: colors.textMuted))
                  : Column(
                      children: sub.devices.entries
                          .toList()
                          .asMap()
                          .entries
                          .map((entry) {
                            final i = entry.key;
                            final d = entry.value.value;
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Row(
                                children: [
                                  SizedBox(width: 18, child: Text('${i + 1}', style: TextStyle(fontSize: 12, color: colors.textMuted))),
                                  const Text('📱', style: TextStyle(fontSize: 16)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(d.type.isEmpty ? 'جهاز غير معروف' : d.type, style: TextStyle(fontSize: 13, color: colors.text)),
                                        Text('آخر ظهور: ${d.lastSeen}', style: TextStyle(fontSize: 11, color: colors.textMuted)),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          })
                          .toList(),
                    ),
            ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(onPressed: () => _copyWelcome(sub), child: const Text('✉️ رسالة', style: TextStyle(fontSize: 12))),
              OutlinedButton(onPressed: () => _openRenewSheet(sub), child: Text('🔄 تجديد', style: TextStyle(fontSize: 12, color: colors.gold))),
              OutlinedButton(onPressed: () => _resetPassword(sub.usedByEmail), child: const Text('🔑 كلمة مرور', style: TextStyle(fontSize: 12))),
              OutlinedButton(onPressed: () => _resetDevices(sub.id), child: const Text('📱 إعادة ضبط الأجهزة', style: TextStyle(fontSize: 12))),
              OutlinedButton(
                style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0x4DE74C3C))),
                onPressed: () => _deleteSub(sub.id),
                child: const Text('🗑 حذف', style: TextStyle(fontSize: 12, color: Color(0xFFE74C3C))),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AffiliatesTab extends StatefulWidget {
  const _AffiliatesTab();
  @override
  State<_AffiliatesTab> createState() => _AffiliatesTabState();
}

class _AffiliatesTabState extends State<_AffiliatesTab> {
  String? expandedHistory;

  void _copy(String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('✅ تم نسخ $label')));
  }

  Future<void> _deleteAff(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('حذف'),
        content: const Text('هل أنت متأكد؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      await FirebaseFirestore.instance.collection('affiliates').doc(id).delete();
    }
  }

  void _openCreateSheet() {
    final colors = context.read<ThemeController>().colors;
    final nameCtrl = TextEditingController();
    final handleCtrl = TextEditingController();
    final codeCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    var commission = 10;
    var saving = false;

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
                Text('🤝 مسوّق جديد', style: TextStyle(color: colors.gold, fontSize: 16, fontWeight: FontWeight.w900)),
                const SizedBox(height: 12),
                ThemedField(label: 'اسم المسوّق *', controller: nameCtrl, colors: colors, hint: 'مثال: محمد الغانم'),
                Row(
                  children: [
                    Expanded(
                      child: ThemedField(label: 'كود الإحالة *', controller: codeCtrl, colors: colors, hint: 'MOHAMAD10', capitalization: TextCapitalization.characters),
                    ),
                    const SizedBox(width: 8),
                    IconButton(onPressed: () => setSheetState(() => codeCtrl.text = _genAffCode(nameCtrl.text.isEmpty ? 'AFF' : nameCtrl.text)), icon: const Text('🎲')),
                  ],
                ),
                ThemedField(label: 'اسم الحساب (يوتيوب/انستغرام)', controller: handleCtrl, colors: colors, hint: 'mohamad_yt'),
                Text('نسبة العمولة %', style: TextStyle(fontSize: 12, color: colors.textSoft)),
                const SizedBox(height: 6),
                Row(
                  children: [10, 15, 20, 25]
                      .map((p) => Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(left: 8),
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  side: BorderSide(color: commission == p ? colors.gold : colors.inputBorder),
                                  backgroundColor: commission == p ? colors.goldSoft : null,
                                ),
                                onPressed: () => setSheetState(() => commission = p),
                                child: Text('$p%', style: TextStyle(color: commission == p ? colors.gold : colors.textMuted)),
                              ),
                            ),
                          ))
                      .toList(),
                ),
                const SizedBox(height: 14),
                ThemedField(label: 'ملاحظات', controller: notesCtrl, colors: colors),
                PrimaryButton(
                  label: '💾 حفظ',
                  colors: colors,
                  loading: saving,
                  onPressed: () async {
                    if (nameCtrl.text.trim().isEmpty || codeCtrl.text.trim().isEmpty) return;
                    setSheetState(() => saving = true);
                    final code = codeCtrl.text.trim().toUpperCase();
                    final existing = await FirebaseFirestore.instance.collection('affiliates').doc(code).get();
                    if (existing.exists) {
                      setSheetState(() => saving = false);
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('هذا الكود مستخدم مسبقاً')));
                      }
                      return;
                    }
                    await FirebaseFirestore.instance.collection('affiliates').doc(code).set({
                      'code': code,
                      'name': nameCtrl.text,
                      'handle': handleCtrl.text,
                      'commissionPct': commission,
                      'notes': notesCtrl.text,
                      'totalReferrals': 0,
                      'totalPaid': 0,
                      'createdAt': FieldValue.serverTimestamp(),
                    });
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openPaySheet(Affiliate aff) {
    final colors = context.read<ThemeController>().colors;
    final amountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    final dateCtrl = TextEditingController(text: DateTime.now().toIso8601String().split('T').first);
    var saving = false;

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
                Text('💰 دفعة — ${aff.name}', style: TextStyle(color: colors.gold, fontSize: 16, fontWeight: FontWeight.w900)),
                const SizedBox(height: 12),
                ThemedField(label: 'المبلغ (د.ل) *', controller: amountCtrl, colors: colors, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
                ThemedField(label: 'التاريخ', controller: dateCtrl, colors: colors),
                ThemedField(label: 'ملاحظة', controller: noteCtrl, colors: colors, hint: 'مثال: دفع عبر تحويل بنكي'),
                PrimaryButton(
                  label: '💾 حفظ',
                  colors: colors,
                  loading: saving,
                  onPressed: () async {
                    final amount = double.tryParse(amountCtrl.text);
                    if (amount == null) return;
                    setSheetState(() => saving = true);
                    await FirebaseFirestore.instance.collection('affiliates').doc(aff.id).collection('payments').add({
                      'amount': amount,
                      'note': noteCtrl.text,
                      'date': dateCtrl.text,
                      'paidBy': FirebaseAuth.instance.currentUser!.email,
                      'createdAt': FieldValue.serverTimestamp(),
                    });
                    await FirebaseFirestore.instance.collection('affiliates').doc(aff.id).update({'totalPaid': aff.totalPaid + amount});
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance.collection('affiliates').orderBy('createdAt', descending: true).snapshots(),
      builder: (context, snapshot) {
        final affiliates = (snapshot.data?.docs ?? []).map((d) => Affiliate.fromDoc(d.id, d.data())).toList();
        final totalReferrals = affiliates.fold<int>(0, (s, a) => s + a.totalReferrals);

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text('المسوّقون: ${affiliates.length} | إجمالي الإحالات: $totalReferrals', style: TextStyle(fontSize: 11, color: colors.textMuted)),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: colors.gold, foregroundColor: colors.bg),
                    onPressed: _openCreateSheet,
                    child: const Text('＋ مسوّق جديد'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: affiliates.isEmpty
                  ? Center(child: Text('لا يوجد مسوّقون بعد', style: TextStyle(color: colors.textMuted)))
                  : ListView.builder(
                      padding: const EdgeInsets.all(14),
                      itemCount: affiliates.length,
                      itemBuilder: (context, i) => _affCard(colors, affiliates[i]),
                    ),
            ),
          ],
        );
      },
    );
  }

  Widget _affCard(AppColors colors, Affiliate aff) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: colors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: colors.borderSoft)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(aff.name, style: TextStyle(color: colors.gold, fontWeight: FontWeight.w700, fontSize: 15))),
              OutlinedButton(
                style: OutlinedButton.styleFrom(backgroundColor: colors.goldSoft, side: BorderSide(color: colors.borderSoft), padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4)),
                onPressed: () => _copy(aff.code, 'كود الإحالة'),
                child: Text('📋 ${aff.code}', style: const TextStyle(fontSize: 11, color: Color(0xFFF8F6F0))),
              ),
            ],
          ),
          if (aff.handle.isNotEmpty) Text('@${aff.handle}', style: TextStyle(fontSize: 12, color: colors.textMuted)),
          Text('💹 العمولة: ${aff.commissionPct}%', style: TextStyle(fontSize: 12, color: colors.textMuted)),
          Text('📊 الإحالات: ${aff.totalReferrals}', style: TextStyle(fontSize: 12, color: colors.textMuted)),
          Text('💵 المدفوع: ${aff.totalPaid.toStringAsFixed(2)} د.ل', style: TextStyle(fontSize: 12, color: colors.textMuted)),
          if (aff.notes.isNotEmpty) Text('📝 ${aff.notes}', style: TextStyle(fontSize: 12, color: colors.textMuted)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0x4D2ECC71))),
                onPressed: () => _openPaySheet(aff),
                child: const Text('💰 دفعة', style: TextStyle(fontSize: 12, color: Color(0xFF2ECC71))),
              ),
              OutlinedButton(
                onPressed: () => setState(() => expandedHistory = expandedHistory == aff.id ? null : aff.id),
                child: const Text('📜 السجل', style: TextStyle(fontSize: 12)),
              ),
              OutlinedButton(
                style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0x4DE74C3C))),
                onPressed: () => _deleteAff(aff.id),
                child: const Text('🗑 حذف', style: TextStyle(fontSize: 12, color: Color(0xFFE74C3C))),
              ),
            ],
          ),
          if (expandedHistory == aff.id)
            StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('affiliates')
                  .doc(aff.id)
                  .collection('payments')
                  .orderBy('createdAt', descending: true)
                  .snapshots(),
              builder: (context, snap) {
                final pays = (snap.data?.docs ?? []).map((d) => AffiliatePayment.fromDoc(d.id, d.data())).toList();
                return Container(
                  margin: const EdgeInsets.only(top: 10),
                  padding: const EdgeInsets.only(top: 10),
                  decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.inputBg))),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('📜 سجل الدفعات', style: TextStyle(color: colors.gold, fontSize: 12, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      if (pays.isEmpty)
                        Text('لا يوجد دفعات بعد', textAlign: TextAlign.center, style: TextStyle(color: colors.textMuted, fontSize: 12))
                      else
                        for (final p in pays)
                          Container(
                            margin: const EdgeInsets.only(bottom: 4),
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(color: colors.inputBg, borderRadius: BorderRadius.circular(8)),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('${p.amount.toStringAsFixed(2)} د.ل', style: const TextStyle(color: Color(0xFF2ECC71), fontSize: 13, fontWeight: FontWeight.w700)),
                                Text('${p.date} · ${p.note}', style: TextStyle(color: colors.textMuted, fontSize: 11)),
                              ],
                            ),
                          ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
