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
  final Color fieldBg;
  final Color fieldText;
  final Color fieldBorder;

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
    required this.fieldBg,
    required this.fieldText,
    required this.fieldBorder,
  });
}

// The app's primary palette: white with a calm muted-navy accent (named
// "darkColors" only for historical/minimal-diff reasons — it is the
// default theme, not a dark background).
const darkColors = AppColors(
  mode: 'dark',
  bg: Color(0xFFFFFFFF),
  card: Color(0xFFF5F7FA),
  border: Color(0x333B5B82),
  borderSoft: Color(0x263B5B82),
  gold: Color(0xFF3B5B82),
  goldSoft: Color(0x1A3B5B82),
  text: Color(0xFF1C2B3A),
  textSoft: Color(0xFF46566B),
  textMuted: Color(0xFF6B7A94),
  inputBg: Color(0x0A1C2B3A),
  inputBorder: Color(0x1F1C2B3A),
  overlay: Color(0x14000000),
  // Fields sit a shade brighter than the card, like an inset paper cut-out.
  fieldBg: Color(0xFFFFFFFF),
  fieldText: Color(0xFF1C2B3A),
  fieldBorder: Color(0x141C2B3A),
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
  // A touch darker than the white card so fields still read as distinct
  // boxes instead of disappearing into it.
  fieldBg: Color(0xFFF5F3ED),
  fieldText: Color(0xFF0A1628),
  fieldBorder: Color(0x1F0A1628),
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
