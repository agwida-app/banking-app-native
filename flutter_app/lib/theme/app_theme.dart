import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppColors {
  final String mode;
  final Color bg;
  final Color card;
  final Color border;
  final Color borderSoft;
  final Color gold;
  final Color goldSoft;
  final Color text;
  final Color textSoft;
  final Color textMuted;
  final Color inputBg;
  final Color inputBorder;
  final Color overlay;

  const AppColors({
    required this.mode,
    required this.bg,
    required this.card,
    required this.border,
    required this.borderSoft,
    required this.gold,
    required this.goldSoft,
    required this.text,
    required this.textSoft,
    required this.textMuted,
    required this.inputBg,
    required this.inputBorder,
    required this.overlay,
  });
}

const darkColors = AppColors(
  mode: 'dark',
  bg: Color(0xFF0A1628),
  card: Color(0xFF0F2040),
  border: Color(0x33C9A84C),
  borderSoft: Color(0x26C9A84C),
  gold: Color(0xFFC9A84C),
  goldSoft: Color(0x1AC9A84C),
  text: Color(0xFFF8F6F0),
  textSoft: Color(0xFFC5CEDD),
  textMuted: Color(0xFF8A9AB5),
  inputBg: Color(0x0FFFFFFF),
  inputBorder: Color(0x1AFFFFFF),
  overlay: Color(0x40000000),
);

const lightColors = AppColors(
  mode: 'light',
  bg: Color(0xFFF5F3ED),
  card: Color(0xFFFFFFFF),
  border: Color(0x59A8843A),
  borderSoft: Color(0x40A8843A),
  gold: Color(0xFFA8843A),
  goldSoft: Color(0x1AA8843A),
  text: Color(0xFF0A1628),
  textSoft: Color(0xFF33415C),
  textMuted: Color(0xFF6B7A94),
  inputBg: Color(0x0A0A1628),
  inputBorder: Color(0x1F0A1628),
  overlay: Color(0x14000000),
);

const _themeKey = 'app_theme_mode';

class ThemeController extends ChangeNotifier {
  bool _isDark = true;
  bool get isDark => _isDark;
  AppColors get colors => _isDark ? darkColors : lightColors;

  ThemeController() {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_themeKey);
    if (saved == 'light') _isDark = false;
    if (saved == 'dark') _isDark = true;
    notifyListeners();
  }

  Future<void> toggle() async {
    _isDark = !_isDark;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, _isDark ? 'dark' : 'light');
  }
}
