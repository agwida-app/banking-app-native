import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app_gate.dart';
import 'firebase_options.dart';
import 'theme/app_theme.dart';

final navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(
    ChangeNotifierProvider(
      create: (_) => ThemeController(),
      child: const BankingApp(),
    ),
  );
}

class BankingApp extends StatelessWidget {
  const BankingApp({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = context.watch<ThemeController>().isDark;
    // Both palettes are light (white-backed) now, so Material always runs
    // in light brightness regardless of which accent palette is active.
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'إدارة بطاقاتك',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: isDark ? darkColors.bg : lightColors.bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: isDark ? darkColors.gold : lightColors.gold,
          brightness: Brightness.light,
        ),
      ),
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: child!,
        );
      },
      home: const AppGate(),
    );
  }
}
