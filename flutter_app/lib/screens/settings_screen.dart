import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'auth_screen.dart' show whatsappUrl;

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController nameCtrl;
  final currentPwCtrl = TextEditingController();
  final newPwCtrl = TextEditingController();
  final confirmPwCtrl = TextEditingController();

  bool savingName = false;
  bool savingPassword = false;
  String? nameMsg;
  bool nameMsgIsError = false;
  String? pwMsg;
  bool pwMsgIsError = false;

  @override
  void initState() {
    super.initState();
    nameCtrl = TextEditingController(text: FirebaseAuth.instance.currentUser?.displayName ?? '');
  }

  @override
  void dispose() {
    nameCtrl.dispose();
    currentPwCtrl.dispose();
    newPwCtrl.dispose();
    confirmPwCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveName() async {
    if (nameCtrl.text.trim().isEmpty) {
      setState(() {
        nameMsg = 'أدخل الاسم';
        nameMsgIsError = true;
      });
      return;
    }
    setState(() {
      savingName = true;
      nameMsg = null;
    });
    try {
      await FirebaseAuth.instance.currentUser?.updateDisplayName(nameCtrl.text.trim());
      setState(() {
        nameMsg = 'تم حفظ الاسم';
        nameMsgIsError = false;
      });
    } catch (e) {
      setState(() {
        nameMsg = e.toString();
        nameMsgIsError = true;
      });
    }
    if (mounted) setState(() => savingName = false);
  }

  Future<void> _changePassword() async {
    if (currentPwCtrl.text.isEmpty) {
      setState(() {
        pwMsg = 'أدخل كلمة المرور الحالية';
        pwMsgIsError = true;
      });
      return;
    }
    if (newPwCtrl.text.length < 6) {
      setState(() {
        pwMsg = 'كلمة المرور الجديدة 6 أحرف على الأقل';
        pwMsgIsError = true;
      });
      return;
    }
    if (newPwCtrl.text != confirmPwCtrl.text) {
      setState(() {
        pwMsg = 'كلمتا المرور غير متطابقتان';
        pwMsgIsError = true;
      });
      return;
    }
    setState(() {
      savingPassword = true;
      pwMsg = null;
    });
    try {
      final user = FirebaseAuth.instance.currentUser!;
      final cred = EmailAuthProvider.credential(email: user.email!, password: currentPwCtrl.text);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(newPwCtrl.text);
      currentPwCtrl.clear();
      newPwCtrl.clear();
      confirmPwCtrl.clear();
      setState(() {
        pwMsg = 'تم تغيير كلمة المرور';
        pwMsgIsError = false;
      });
    } on FirebaseAuthException catch (e) {
      const m = {
        'wrong-password': 'كلمة المرور الحالية غير صحيحة',
        'invalid-credential': 'كلمة المرور الحالية غير صحيحة',
        'too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
      };
      setState(() {
        pwMsg = m[e.code] ?? e.message;
        pwMsgIsError = true;
      });
    }
    if (mounted) setState(() => savingPassword = false);
  }

  Widget _sectionCard(AppColors colors, {required String title, required IconData icon, required List<Widget> children}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: colors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: colors.borderSoft)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: colors.gold),
              const SizedBox(width: 8),
              Text(title, style: TextStyle(color: colors.text, fontSize: 14, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;
    final user = FirebaseAuth.instance.currentUser;
    final identityLabel = user?.email ?? '';

    return Container(
      color: colors.bg,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Icon(Icons.settings_outlined, size: 20, color: colors.gold),
              const SizedBox(width: 6),
              Text('الإعدادات', style: TextStyle(color: colors.text, fontSize: 19, fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 16),
          _sectionCard(
            colors,
            title: 'الملف الشخصي',
            icon: Icons.person_outline,
            children: [
              Text('البريد الإلكتروني', style: TextStyle(fontSize: 12, color: colors.textSoft)),
              const SizedBox(height: 5),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: colors.inputBg, borderRadius: BorderRadius.circular(10), border: Border.all(color: colors.inputBorder)),
                child: Text(identityLabel, style: TextStyle(color: colors.textMuted, fontSize: 14)),
              ),
              const SizedBox(height: 14),
              ThemedField(label: 'الاسم', controller: nameCtrl, colors: colors, hint: 'اسمك الكامل'),
              if (nameMsg != null) MessageBanner(text: nameMsg!, isError: nameMsgIsError),
              PrimaryButton(label: 'حفظ الاسم', colors: colors, loading: savingName, onPressed: _saveName),
            ],
          ),
          _sectionCard(
            colors,
            title: 'تغيير كلمة المرور',
            icon: Icons.lock_outline,
            children: [
              ThemedField(label: 'كلمة المرور الحالية', controller: currentPwCtrl, colors: colors, obscure: true),
              ThemedField(label: 'كلمة المرور الجديدة', controller: newPwCtrl, colors: colors, obscure: true),
              ThemedField(label: 'تأكيد كلمة المرور الجديدة', controller: confirmPwCtrl, colors: colors, obscure: true),
              if (pwMsg != null) MessageBanner(text: pwMsg!, isError: pwMsgIsError),
              PrimaryButton(label: 'تغيير كلمة المرور', colors: colors, loading: savingPassword, onPressed: _changePassword),
            ],
          ),
          _sectionCard(
            colors,
            title: 'الدعم',
            icon: Icons.support_agent_outlined,
            children: [
              Text('هل تواجه مشكلة أو لديك استفسار؟ تواصل معنا مباشرة.',
                  style: TextStyle(color: colors.textMuted, fontSize: 12)),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  backgroundColor: const Color(0x1A25D366),
                  side: const BorderSide(color: Color(0x4D25D366)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: () => launchUrl(Uri.parse(whatsappUrl), mode: LaunchMode.externalApplication),
                icon: const Icon(Icons.chat_outlined, size: 18, color: Color(0xFF25D366)),
                label: const Text('تواصل مع خدمة العملاء عبر واتساب',
                    style: TextStyle(color: Color(0xFF25D366), fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
