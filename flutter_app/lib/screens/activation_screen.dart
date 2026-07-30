import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/subscription.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'auth_screen.dart' show whatsappUrl;

const commissionPctDefault = 10;

class ActivationScreen extends StatefulWidget {
  final User user;
  final String subStatus;
  const ActivationScreen({super.key, required this.user, required this.subStatus});

  @override
  State<ActivationScreen> createState() => _ActivationScreenState();
}

class _ActivationScreenState extends State<ActivationScreen> {
  final codeCtrl = TextEditingController();
  final refCtrl = TextEditingController();
  bool loading = false;

  @override
  void initState() {
    super.initState();
    refCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    codeCtrl.dispose();
    refCtrl.dispose();
    super.dispose();
  }

  void _showMsg(String title, String msg) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: Text(msg),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('حسناً'))],
      ),
    );
  }

  Future<void> _activate() async {
    final trimmed = codeCtrl.text.trim().toUpperCase();
    if (trimmed.isEmpty) {
      _showMsg('خطأ', 'أدخل كود التفعيل');
      return;
    }
    setState(() => loading = true);
    final db = FirebaseFirestore.instance;
    final user = widget.user;
    try {
      final ref = db.collection('subscriptions').doc(trimmed);
      final snap = await ref.get();
      if (!snap.exists) {
        _showMsg('خطأ', 'الكود غير صحيح');
        setState(() => loading = false);
        return;
      }
      final data = snap.data()!;
      final usedBy = data['usedBy'] as String?;
      if (usedBy != null && usedBy != user.uid) {
        _showMsg('خطأ', 'هذا الكود مستخدم مسبقاً');
        setState(() => loading = false);
        return;
      }
      final expTs = data['expiresAt'] as Timestamp?;
      final exp = expTs?.toDate() ?? DateTime.now();
      if (exp.isBefore(DateTime.now())) {
        _showMsg('خطأ', 'هذا الكود منتهي الصلاحية');
        setState(() => loading = false);
        return;
      }

      final refTrimmed = refCtrl.text.trim().toUpperCase();
      var bonusMonths = 0;

      if (refTrimmed.isNotEmpty) {
        final affRef = db.collection('affiliates').doc(refTrimmed);
        final affSnap = await affRef.get();
        if (!affSnap.exists) {
          _showMsg('خطأ', 'كود الإحالة غير صحيح');
          setState(() => loading = false);
          return;
        }
        final affData = affSnap.data()!;
        final userRef = db.collection('users').doc(user.uid);
        final userSnap = await userRef.get();
        if (userSnap.exists && (userSnap.data()?['usedReferral'] == true)) {
          _showMsg('خطأ', 'لقد استخدمت كود إحالة مسبقاً');
          setState(() => loading = false);
          return;
        }
        bonusMonths = 1;
        final plan = subPlans.where((p) => p.id == data['plan']).firstOrNull;
        final commPct = (affData['commissionPct'] as num?)?.toDouble() ?? commissionPctDefault;
        final commAmount = plan != null ? ((plan.price * commPct / 100) * 100).round() / 100 : null;
        await affRef.update({'totalReferrals': ((affData['totalReferrals'] as num?) ?? 0) + 1});
        if (commAmount != null) {
          await db.collection('affiliates').doc(affSnap.id).collection('payments').add({
            'amount': commAmount,
            'note': 'عمولة تلقائية — ${user.email}',
            'date': DateTime.now().toIso8601String().split('T').first,
            'paidBy': 'تلقائي',
            'isAuto': true,
            'subscriptionCode': trimmed,
            'createdAt': FieldValue.serverTimestamp(),
          });
          await affRef.update({'totalPaid': ((affData['totalPaid'] as num?) ?? 0) + commAmount});
        }
        await userRef.set({
          'uid': user.uid,
          'email': user.email,
          'usedReferral': true,
          'referralCode': refTrimmed,
          'referralUsedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      }

      if (bonusMonths > 0) {
        final newExp = DateTime(exp.year, exp.month + bonusMonths, exp.day, exp.hour, exp.minute, exp.second);
        await ref.update({
          'usedBy': user.uid,
          'usedAt': FieldValue.serverTimestamp(),
          'usedByEmail': user.email,
          'expiresAt': Timestamp.fromDate(newExp),
          'planLabel': '${data['planLabel'] ?? ''} + شهر مجاني 🎁',
        });
        _showMsg('🎉 تم التفعيل', 'مرحباً بك!\nحصلت على شهر مجاني إضافي بفضل كود الإحالة 🎁');
      } else {
        await ref.update({
          'usedBy': user.uid,
          'usedAt': FieldValue.serverTimestamp(),
          'usedByEmail': user.email,
        });
        _showMsg('✅ تم التفعيل', 'مرحباً بك في إدارة بطاقاتك!');
      }
    } catch (e) {
      _showMsg('خطأ', e.toString());
    }
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeController>();
    final colors = theme.colors;

    return Scaffold(
      backgroundColor: colors.bg,
      body: SafeArea(
        child: Stack(
          children: [
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    const Text('💳', style: TextStyle(fontSize: 50)),
                    const SizedBox(height: 12),
                    Text('تفعيل الاشتراك', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: colors.text)),
                    const SizedBox(height: 4),
                    Text(widget.user.email ?? '', style: TextStyle(fontSize: 13, color: colors.textMuted)),
                    const SizedBox(height: 20),
                    if (widget.subStatus == 'expired') const MessageBanner(text: '⚠️ انتهى اشتراكك — تواصل مع المسؤول للتجديد'),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ThemedField(
                            label: 'كود التفعيل *',
                            controller: codeCtrl,
                            colors: colors,
                            hint: 'XXXXXXXX',
                            capitalization: TextCapitalization.characters,
                          ),
                          ThemedField(
                            label: 'كود الإحالة (اختياري — للحصول على شهر مجاني 🎁)',
                            controller: refCtrl,
                            colors: colors,
                            hint: 'مثال: MOHAMAD47',
                            capitalization: TextCapitalization.characters,
                          ),
                          if (refCtrl.text.isNotEmpty)
                            const MessageBanner(text: '🎁 ستحصل على شهر مجاني إضافي!', isError: false),
                          const SizedBox(height: 4),
                          PrimaryButton(label: '🔓 تفعيل الاشتراك', onPressed: _activate, loading: loading, colors: colors),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          backgroundColor: const Color(0x1A25D366),
                          side: const BorderSide(color: Color(0x4D25D366)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () => launchUrl(Uri.parse(whatsappUrl), mode: LaunchMode.externalApplication),
                        child: const Text('📱 تواصل مع خدمة العملاء عبر واتساب',
                            style: TextStyle(color: Color(0xFF25D366), fontSize: 14, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextButton(
                      onPressed: () => FirebaseAuth.instance.signOut(),
                      child: Text('تسجيل خروج',
                          style: TextStyle(color: colors.textMuted, fontSize: 13, decoration: TextDecoration.underline)),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: IconButton(
                onPressed: theme.toggle,
                style: IconButton.styleFrom(backgroundColor: colors.card, side: BorderSide(color: colors.border)),
                icon: Text(theme.isDark ? '☀️' : '🌙'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
