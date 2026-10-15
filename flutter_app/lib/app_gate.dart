import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:app_links/app_links.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'main.dart' show navigatorKey;
import 'screens/activation_screen.dart';
import 'screens/admin_screen.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/reset_password_confirm_screen.dart';
import 'theme/app_theme.dart';

const adminUid = 'yel5HGeqTfXRUmraIzfZK4XVhrS2';

String _deviceType() => Platform.isIOS ? 'iPhone' : 'Android';

String _generateDeviceId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  final rnd = Random();
  final rand = List.generate(9, (_) => chars[rnd.nextInt(chars.length)]).join();
  return 'dev_${rand}_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
}

class AppGate extends StatefulWidget {
  const AppGate({super.key});

  @override
  State<AppGate> createState() => _AppGateState();
}

class _AppGateState extends State<AppGate> {
  User? user;
  bool ready = false;
  String? subStatus; // null(loading) | none | expired | active | device_limit
  int? subDays;

  final _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSub;

  @override
  void initState() {
    super.initState();
    FirebaseAuth.instance.authStateChanges().listen((u) {
      setState(() {
        user = u;
        ready = true;
        if (u == null) {
          subStatus = null;
          subDays = null;
        }
      });
      if (u != null) _watchSubscription(u);
    });
    _initDeepLinks();
  }

  Future<void> _initDeepLinks() async {
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) _handleLink(initial);
    } catch (_) {}
    _linkSub = _appLinks.uriLinkStream.listen(_handleLink, onError: (_) {});
  }

  void _handleLink(Uri uri) {
    if (uri.queryParameters['mode'] != 'resetPassword') return;
    final oobCode = uri.queryParameters['oobCode'];
    if (oobCode == null) return;
    navigatorKey.currentState?.push(
      MaterialPageRoute(builder: (_) => ResetPasswordConfirmScreen(oobCode: oobCode)),
    );
  }

  @override
  void dispose() {
    _linkSub?.cancel();
    super.dispose();
  }

  void _watchSubscription(User u) {
    if (u.uid == adminUid) {
      setState(() {
        subStatus = 'active';
        subDays = 9999;
      });
      return;
    }

    FirebaseFirestore.instance
        .collection('subscriptions')
        .where('usedBy', isEqualTo: u.uid)
        .snapshots()
        .listen((snap) async {
      if (!mounted) return;
      if (snap.docs.isEmpty) {
        setState(() => subStatus = 'none');
        return;
      }

      final subDoc = snap.docs.first;
      final data = subDoc.data();
      final expTs = data['expiresAt'] as Timestamp?;
      final exp = expTs?.toDate();
      final days = exp == null ? null : (exp.difference(DateTime.now()).inHours / 24).ceil();
      setState(() => subDays = days);

      if (days != null && days <= 0) {
        setState(() => subStatus = 'expired');
        return;
      }

      try {
        final prefs = await SharedPreferences.getInstance();
        var deviceId = prefs.getString('deviceId');
        if (deviceId == null) {
          deviceId = _generateDeviceId();
          await prefs.setString('deviceId', deviceId);
        }
        final devices = Map<String, dynamic>.from(data['devices'] ?? {});
        final deviceEntry = {
          'uid': u.uid,
          'email': u.email ?? '',
          'lastSeen': DateTime.now().toIso8601String(),
          'type': _deviceType(),
        };

        if (devices.containsKey(deviceId)) {
          await subDoc.reference.update({'devices.$deviceId': deviceEntry});
          if (mounted) setState(() => subStatus = 'active');
        } else if (devices.length >= 7) {
          if (mounted) setState(() => subStatus = 'device_limit');
        } else {
          await subDoc.reference.update({'devices.$deviceId': deviceEntry});
          if (mounted) setState(() => subStatus = 'active');
        }
      } catch (_) {
        if (mounted) setState(() => subStatus = 'active');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;

    if (!ready || (user != null && subStatus == null)) {
      return _SplashLoading(colors: colors);
    }

    if (user != null && subStatus == 'device_limit') {
      return Scaffold(
        backgroundColor: colors.bg,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.phonelink_erase, size: 50, color: colors.textMuted),
                const SizedBox(height: 16),
                Text('تجاوزت الحد الأقصى للأجهزة',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: colors.text)),
                const SizedBox(height: 10),
                Text(
                  'اشتراكك مسجّل على 7 أجهزة وهو الحد الأقصى.\nتواصل مع المسؤول لإعادة ضبط أجهزتك.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: colors.textMuted, height: 1.5),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: colors.gold, foregroundColor: colors.bg),
                  onPressed: () => FirebaseAuth.instance.signOut(),
                  child: const Text('تسجيل خروج'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (user == null) return const AuthScreen();
    if (subStatus == 'none' || subStatus == 'expired') {
      return ActivationScreen(user: user!, subStatus: subStatus!);
    }
    return HomeScreen(subDays: subDays, isAdmin: user!.uid == adminUid);
  }
}

class AdminRoute extends StatelessWidget {
  const AdminRoute({super.key});
  @override
  Widget build(BuildContext context) => const AdminScreen();
}

class _SplashLoading extends StatefulWidget {
  final AppColors colors;
  const _SplashLoading({required this.colors});

  @override
  State<_SplashLoading> createState() => _SplashLoadingState();
}

class _SplashLoadingState extends State<_SplashLoading> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..forward();
  late final Animation<double> _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
  late final Animation<double> _scale = Tween(begin: 0.85, end: 1.0).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutBack));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    return Scaffold(
      backgroundColor: colors.bg,
      body: Center(
        child: FadeTransition(
          opacity: _fade,
          child: ScaleTransition(
            scale: _scale,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.credit_card, size: 56, color: colors.gold),
                const SizedBox(height: 14),
                Text('إدارة بطاقاتك', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: colors.text)),
                const SizedBox(height: 24),
                SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.4, color: colors.gold)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
