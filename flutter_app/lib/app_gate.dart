import 'dart:io' show Platform;
import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'screens/activation_screen.dart';
import 'screens/admin_screen.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'theme/app_theme.dart';

const adminUid = 'yel5HGeqTfXRUmraIzfZK4XVhrS2';

String _deviceType() => Platform.isIOS ? 'iPhone 📱' : 'Android 📱';

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
          'email': u.email,
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
      return Scaffold(
        backgroundColor: colors.bg,
        body: Center(child: CircularProgressIndicator(color: colors.gold)),
      );
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
                const Text('📱📱📱', style: TextStyle(fontSize: 50)),
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
