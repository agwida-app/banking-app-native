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
  String method = 'email'; // 'email' | 'phone'
  bool resetMode = false;
  final nameCtrl = TextEditingController();
  final emailCtrl = TextEditingController();
  final passCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  final otpCtrl = TextEditingController();
  String err = '';
  String ok = '';
  bool loading = false;
  bool otpSent = false;
  String? verificationId;

  @override
  void dispose() {
    nameCtrl.dispose();
    emailCtrl.dispose();
    passCtrl.dispose();
    phoneCtrl.dispose();
    otpCtrl.dispose();
    super.dispose();
  }

  static const _errorMessages = {
    'invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
    'email-already-in-use': 'البريد مسجل مسبقا',
    'weak-password': 'كلمة المرور قصيرة (6+ أحرف)',
    'invalid-email': 'البريد غير صالح',
    'too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
  };

  static const _phoneErrorMessages = {
    'invalid-phone-number': 'رقم الجوال غير صحيح',
    'invalid-verification-code': 'رمز التحقق غير صحيح',
    'session-expired': 'انتهت صلاحية الرمز، أعد الإرسال',
    'too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
  };

  String _toE164Libya(String local) {
    var s = local.trim().replaceAll(RegExp(r'[^0-9]'), '');
    if (s.startsWith('00218')) s = s.substring(5);
    if (s.startsWith('218')) s = s.substring(3);
    if (s.startsWith('0')) s = s.substring(1);
    return '+218$s';
  }

  Future<void> _sendOtp() async {
    if (tab == 'register' && nameCtrl.text.trim().isEmpty) {
      setState(() => err = 'أدخل الاسم الكامل');
      return;
    }
    if (phoneCtrl.text.trim().isEmpty) {
      setState(() => err = 'أدخل رقم الجوال');
      return;
    }
    setState(() {
      err = '';
      ok = '';
      loading = true;
    });
    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: _toE164Libya(phoneCtrl.text),
        timeout: const Duration(seconds: 60),
        verificationCompleted: (credential) async {
          try {
            final userCred = await FirebaseAuth.instance.signInWithCredential(credential);
            if (tab == 'register' && nameCtrl.text.trim().isNotEmpty) {
              await userCred.user?.updateDisplayName(nameCtrl.text.trim());
            }
          } catch (_) {}
          if (mounted) setState(() => loading = false);
        },
        verificationFailed: (e) {
          if (mounted) {
            setState(() {
              err = _phoneErrorMessages[e.code] ?? e.message ?? 'تعذر إرسال رمز التحقق';
              loading = false;
            });
          }
        },
        codeSent: (verId, resendToken) {
          if (mounted) {
            setState(() {
              verificationId = verId;
              otpSent = true;
              loading = false;
            });
          }
        },
        codeAutoRetrievalTimeout: (verId) => verificationId = verId,
      );
    } catch (e) {
      setState(() {
        err = 'تعذر إرسال رمز التحقق';
        loading = false;
      });
    }
  }

  Future<void> _verifyOtp() async {
    if (otpCtrl.text.trim().length < 6 || verificationId == null) {
      setState(() => err = 'أدخل رمز التحقق المكوّن من 6 أرقام');
      return;
    }
    setState(() {
      err = '';
      loading = true;
    });
    try {
      final credential = PhoneAuthProvider.credential(verificationId: verificationId!, smsCode: otpCtrl.text.trim());
      final userCred = await FirebaseAuth.instance.signInWithCredential(credential);
      if (tab == 'register' && nameCtrl.text.trim().isNotEmpty) {
        await userCred.user?.updateDisplayName(nameCtrl.text.trim());
      }
    } on FirebaseAuthException catch (e) {
      setState(() => err = _phoneErrorMessages[e.code] ?? 'رمز غير صحيح');
    }
    if (mounted) setState(() => loading = false);
  }

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
        ok = 'تم الإرسال';
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
                    Icon(Icons.credit_card, size: 50, color: colors.gold),
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
                        child: const Text('تواصل مع خدمة العملاء عبر واتساب',
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
                icon: Icon(theme.isDark ? Icons.light_mode : Icons.dark_mode, color: colors.gold),
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
        const SizedBox(height: 12),
        Row(
          children: [
            _methodButton('email', 'البريد الإلكتروني', Icons.email_outlined, colors),
            const SizedBox(width: 8),
            _methodButton('phone', 'رقم الجوال', Icons.phone_iphone, colors),
          ],
        ),
        const SizedBox(height: 16),
        if (err.isNotEmpty) MessageBanner(text: err),
        if (ok.isNotEmpty) MessageBanner(text: ok, isError: false),
        if (tab == 'register') ThemedField(label: 'الاسم الكامل', controller: nameCtrl, colors: colors, hint: 'اسمك الكامل'),
        if (method == 'email') ...[
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
            label: tab == 'login' ? 'تسجيل الدخول' : 'إنشاء حساب',
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
        ] else ...[
          if (!otpSent) ...[
            ThemedField(
              label: 'رقم الجوال',
              controller: phoneCtrl,
              colors: colors,
              hint: '091xxxxxxx',
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 4),
            PrimaryButton(label: 'إرسال رمز التحقق', onPressed: _sendOtp, loading: loading, colors: colors),
          ] else ...[
            Text('أُرسل رمز تحقق مكوّن من 6 أرقام إلى ${phoneCtrl.text}',
                style: TextStyle(fontSize: 12, color: colors.textMuted), textAlign: TextAlign.center),
            const SizedBox(height: 10),
            ThemedField(
              label: 'رمز التحقق',
              controller: otpCtrl,
              colors: colors,
              hint: '••••••',
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 4),
            PrimaryButton(
              label: tab == 'login' ? 'تسجيل الدخول' : 'إنشاء حساب',
              onPressed: _verifyOtp,
              loading: loading,
              colors: colors,
            ),
            TextButton(
              onPressed: () => setState(() {
                otpSent = false;
                otpCtrl.clear();
                err = '';
              }),
              child: Text('تغيير رقم الجوال', style: TextStyle(color: colors.gold, fontSize: 12)),
            ),
          ],
        ],
      ],
    );
  }

  Widget _methodButton(String value, String label, IconData icon, AppColors colors) {
    final isSel = method == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          method = value;
          err = '';
          otpSent = false;
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSel ? colors.goldSoft : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isSel ? colors.gold : colors.inputBorder),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: isSel ? colors.gold : colors.textMuted),
              const SizedBox(height: 3),
              Text(label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: isSel ? colors.gold : colors.textMuted)),
            ],
          ),
        ),
      ),
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
        PrimaryButton(label: 'إرسال', onPressed: _submitReset, loading: loading, colors: colors),
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
