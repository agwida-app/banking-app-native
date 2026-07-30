import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme/app_theme.dart';
import '../widgets/common.dart';

const whatsappUrl = 'https://wa.me/218945888844';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  String tab = 'login';
  bool resetMode = false;
  final nameCtrl = TextEditingController();
  final emailCtrl = TextEditingController();
  final passCtrl = TextEditingController();
  String err = '';
  String ok = '';
  bool loading = false;

  @override
  void dispose() {
    nameCtrl.dispose();
    emailCtrl.dispose();
    passCtrl.dispose();
    super.dispose();
  }

  static const _errorMessages = {
    'invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
    'email-already-in-use': 'البريد مسجل مسبقا',
    'weak-password': 'كلمة المرور قصيرة (6+ أحرف)',
    'invalid-email': 'البريد غير صالح',
    'too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
  };

  Future<void> _submit() async {
    setState(() {
      err = '';
      ok = '';
      loading = true;
    });

    if (tab == 'register') {
      if (nameCtrl.text.trim().isEmpty || emailCtrl.text.trim().isEmpty || passCtrl.text.trim().isEmpty) {
        setState(() {
          err = 'يرجى ملء جميع الحقول';
          loading = false;
        });
        return;
      }
    } else if (emailCtrl.text.trim().isEmpty || passCtrl.text.trim().isEmpty) {
      setState(() {
        err = 'يرجى ملء جميع الحقول';
        loading = false;
      });
      return;
    }

    try {
      if (tab == 'login') {
        await FirebaseAuth.instance.signInWithEmailAndPassword(
          email: emailCtrl.text.trim(),
          password: passCtrl.text,
        );
      } else {
        final cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(
          email: emailCtrl.text.trim(),
          password: passCtrl.text,
        );
        await cred.user?.updateDisplayName(nameCtrl.text.trim());
      }
    } on FirebaseAuthException catch (e) {
      setState(() => err = _errorMessages[e.code] ?? 'حدث خطأ');
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _submitReset() async {
    setState(() {
      err = '';
      ok = '';
      loading = true;
    });
    if (emailCtrl.text.trim().isEmpty) {
      setState(() {
        err = 'أدخل بريدك';
        loading = false;
      });
      return;
    }
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: emailCtrl.text.trim());
      setState(() {
        ok = 'تم الإرسال ✉';
        resetMode = false;
      });
    } catch (_) {
      setState(() => err = 'البريد غير مسجل');
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
                    Text('إدارة بطاقاتك', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: colors.text)),
                    const SizedBox(height: 4),
                    Text('منصة آمنة ومتزامنة عبر جميع الأجهزة',
                        style: TextStyle(fontSize: 13, color: colors.textMuted), textAlign: TextAlign.center),
                    const SizedBox(height: 20),
                    Container(
                      constraints: const BoxConstraints(maxWidth: 420),
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                      ),
                      child: resetMode ? _buildReset(colors) : _buildAuthForm(colors),
                    ),
                    const SizedBox(height: 16),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
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

  Widget _buildAuthForm(AppColors colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(color: colors.overlay, borderRadius: BorderRadius.circular(10)),
          child: Row(
            children: [
              _tabButton('login', 'تسجيل الدخول', colors),
              _tabButton('register', 'حساب جديد', colors),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (err.isNotEmpty) MessageBanner(text: err),
        if (ok.isNotEmpty) MessageBanner(text: ok, isError: false),
        if (tab == 'register') ThemedField(label: 'الاسم الكامل', controller: nameCtrl, colors: colors, hint: 'اسمك الكامل'),
        ThemedField(
          label: 'البريد الإلكتروني',
          controller: emailCtrl,
          colors: colors,
          hint: 'example@mail.com',
          keyboardType: TextInputType.emailAddress,
        ),
        ThemedField(label: 'كلمة المرور', controller: passCtrl, colors: colors, hint: '••••••••', obscure: true),
        const SizedBox(height: 4),
        PrimaryButton(
          label: tab == 'login' ? '🔐 تسجيل الدخول' : '✨ إنشاء حساب',
          onPressed: _submit,
          loading: loading,
          colors: colors,
        ),
        if (tab == 'login')
          TextButton(
            onPressed: () => setState(() {
              resetMode = true;
              err = '';
            }),
            child: Text('نسيت كلمة المرور؟',
                style: TextStyle(color: colors.gold, fontSize: 12, decoration: TextDecoration.underline)),
          ),
      ],
    );
  }

  Widget _buildReset(AppColors colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('إعادة تعيين كلمة المرور', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: colors.gold)),
        const SizedBox(height: 4),
        Text('سنرسل رابطاً لبريدك الإلكتروني', style: TextStyle(fontSize: 12, color: colors.textMuted)),
        const SizedBox(height: 16),
        if (err.isNotEmpty) MessageBanner(text: err),
        if (ok.isNotEmpty) MessageBanner(text: ok, isError: false),
        ThemedField(
          label: 'البريد الإلكتروني',
          controller: emailCtrl,
          colors: colors,
          hint: 'example@mail.com',
          keyboardType: TextInputType.emailAddress,
        ),
        PrimaryButton(label: '📨 إرسال', onPressed: _submitReset, loading: loading, colors: colors),
        TextButton(
          onPressed: () => setState(() {
            resetMode = false;
            err = '';
          }),
          child: Text('← العودة', style: TextStyle(color: colors.gold, fontSize: 12)),
        ),
      ],
    );
  }

  Widget _tabButton(String value, String label, AppColors colors) {
    final isSel = tab == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          tab = value;
          err = '';
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: isSel ? colors.gold : Colors.transparent,
            borderRadius: BorderRadius.circular(7),
          ),
          alignment: Alignment.center,
          child: Text(label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isSel ? colors.bg : colors.textMuted,
              )),
        ),
      ),
    );
  }
}
