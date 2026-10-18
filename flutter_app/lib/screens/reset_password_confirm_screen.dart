import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../theme/app_theme.dart';
import '../widgets/common.dart';

/// Opened from the deep link in Firebase's password-reset email (see
/// AppGate), so the whole reset happens inside the app instead of a browser.
class ResetPasswordConfirmScreen extends StatefulWidget {
  final String oobCode;
  const ResetPasswordConfirmScreen({super.key, required this.oobCode});

  @override
  State<ResetPasswordConfirmScreen> createState() => _ResetPasswordConfirmScreenState();
}

class _ResetPasswordConfirmScreenState extends State<ResetPasswordConfirmScreen> {
  final newPassCtrl = TextEditingController();
  final confirmCtrl = TextEditingController();
  String err = '';
  String? verifiedEmail;
  bool verifying = true;
  bool submitting = false;
  bool done = false;

  @override
  void initState() {
    super.initState();
    _verify();
  }

  @override
  void dispose() {
    newPassCtrl.dispose();
    confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    try {
      final email = await FirebaseAuth.instance.verifyPasswordResetCode(widget.oobCode);
      setState(() {
        verifiedEmail = email;
        verifying = false;
      });
    } on FirebaseAuthException catch (e) {
      setState(() {
        err = e.code == 'expired-action-code' ? 'انتهت صلاحية الرابط، اطلب رابطاً جديداً' : 'الرابط غير صالح';
        verifying = false;
      });
    }
  }

  Future<void> _confirm() async {
    if (newPassCtrl.text.length < 6) {
      setState(() => err = 'كلمة المرور قصيرة (6+ أحرف)');
      return;
    }
    if (newPassCtrl.text != confirmCtrl.text) {
      setState(() => err = 'كلمتا المرور غير متطابقتان');
      return;
    }
    setState(() {
      err = '';
      submitting = true;
    });
    try {
      await FirebaseAuth.instance.confirmPasswordReset(code: widget.oobCode, newPassword: newPassCtrl.text);
      setState(() => done = true);
    } on FirebaseAuthException catch (e) {
      setState(() => err = e.message ?? 'حدث خطأ');
    }
    if (mounted) setState(() => submitting = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;
    return Scaffold(
      backgroundColor: colors.bg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Icon(Icons.lock_reset, size: 46, color: colors.gold),
                const SizedBox(height: 12),
                Text('تعيين كلمة مرور جديدة', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: colors.text)),
                const SizedBox(height: 20),
                Container(
                  constraints: const BoxConstraints(maxWidth: 420),
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: colors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: colors.border),
                  ),
                  child: _buildBody(colors),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(AppColors colors) {
    if (verifying) {
      return Padding(
        padding: const EdgeInsets.all(12),
        child: Center(child: CircularProgressIndicator(color: colors.gold)),
      );
    }
    if (done) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const MessageBanner(text: 'تم تغيير كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن', isError: false),
          const SizedBox(height: 12),
          PrimaryButton(
            label: 'تسجيل الدخول',
            colors: colors,
            onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
          ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (err.isNotEmpty) MessageBanner(text: err),
        if (verifiedEmail != null) ...[
          Text(verifiedEmail!, style: TextStyle(fontSize: 13, color: colors.textMuted), textAlign: TextAlign.center),
          const SizedBox(height: 12),
          ThemedField(label: 'كلمة المرور الجديدة', controller: newPassCtrl, colors: colors, hint: '••••••••', obscure: true),
          ThemedField(label: 'تأكيد كلمة المرور الجديدة', controller: confirmCtrl, colors: colors, hint: '••••••••', obscure: true),
          const SizedBox(height: 4),
          PrimaryButton(label: 'حفظ كلمة المرور', colors: colors, loading: submitting, onPressed: _confirm),
        ],
      ],
    );
  }
}
