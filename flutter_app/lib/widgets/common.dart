import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

class OfflineBanner extends StatelessWidget {
  final bool isOffline;
  const OfflineBanner({super.key, required this.isOffline});

  @override
  Widget build(BuildContext context) {
    if (!isOffline) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0x1AF39C12),
        border: Border.all(color: const Color(0x4DF39C12)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.wifi_off, size: 14, color: Color(0xFFF39C12)),
          SizedBox(width: 6),
          Flexible(
            child: Text(
              'غير متصل بالإنترنت — التغييرات ستُحفظ وتتزامن تلقائياً عند رجوع الاتصال',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFFF39C12), fontSize: 11.5, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class ThemedField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String? hint;
  final bool obscure;
  final TextInputType? keyboardType;
  final int maxLines;
  final AppColors colors;
  final ValueChanged<String>? onChanged;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization capitalization;

  const ThemedField({
    super.key,
    required this.label,
    required this.controller,
    required this.colors,
    this.hint,
    this.obscure = false,
    this.keyboardType,
    this.maxLines = 1,
    this.onChanged,
    this.inputFormatters,
    this.capitalization = TextCapitalization.none,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: colors.textSoft, fontWeight: FontWeight.w500)),
          const SizedBox(height: 5),
          TextField(
            controller: controller,
            obscureText: obscure,
            keyboardType: keyboardType,
            maxLines: obscure ? 1 : maxLines,
            onChanged: onChanged,
            textCapitalization: capitalization,
            textAlign: TextAlign.right,
            style: TextStyle(color: colors.fieldText, fontSize: 15),
            inputFormatters: inputFormatters,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: TextStyle(color: colors.textMuted),
              filled: true,
              fillColor: colors.fieldBg,
              contentPadding: const EdgeInsets.all(12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: colors.gold, width: 1.5),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final AppColors colors;
  final Color? background;
  final Color? foreground;

  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.colors,
    this.loading = false,
    this.background,
    this.foreground,
  });

  static const double _height = 48;
  static const double _circleSize = 48;

  @override
  Widget build(BuildContext context) {
    final fg = foreground ?? colors.bg;
    return LayoutBuilder(
      builder: (context, constraints) {
        return Center(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeInOutCubic,
            width: loading ? _circleSize : constraints.maxWidth,
            height: _height,
            decoration: BoxDecoration(
              color: background ?? colors.gold,
              borderRadius: BorderRadius.circular(loading ? _circleSize / 2 : 10),
            ),
            clipBehavior: Clip.antiAlias,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: loading ? null : onPressed,
                child: Center(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 150),
                    child: loading
                        ? SizedBox(
                            key: const ValueKey('spinner'),
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: fg),
                          )
                        : Text(
                            label,
                            key: const ValueKey('label'),
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: fg),
                          ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class MessageBanner extends StatelessWidget {
  final String text;
  final bool isError;
  const MessageBanner({super.key, required this.text, this.isError = true});

  @override
  Widget build(BuildContext context) {
    final color = isError ? const Color(0xFFE74C3C) : const Color(0xFF2ECC71);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        border: Border.all(color: color.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text, textAlign: TextAlign.center, style: TextStyle(color: color, fontSize: 13)),
    );
  }
}

class SelectChips extends StatelessWidget {
  final List<String> options;
  final String selected;
  final ValueChanged<String> onSelect;
  final AppColors colors;
  const SelectChips({super.key, required this.options, required this.selected, required this.onSelect, required this.colors});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options.map((o) {
        final isSel = o == selected;
        return ChoiceChip(
          label: Text(o),
          selected: isSel,
          onSelected: (_) => onSelect(o),
          backgroundColor: colors.inputBg,
          selectedColor: colors.goldSoft,
          labelStyle: TextStyle(color: isSel ? colors.gold : colors.textMuted, fontWeight: isSel ? FontWeight.w700 : FontWeight.normal),
          side: BorderSide(color: isSel ? colors.gold : colors.inputBorder),
        );
      }).toList(),
    );
  }
}

class StatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color valueColor;
  final AppColors colors;
  const StatCard({super.key, required this.icon, required this.value, required this.label, required this.valueColor, required this.colors});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.borderSoft),
      ),
      child: Column(
        children: [
          Icon(icon, size: 24, color: valueColor),
          const SizedBox(height: 6),
          _CountUpText(value: value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: valueColor)),
          const SizedBox(height: 3),
          Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: colors.textMuted)),
        ],
      ),
    );
  }
}

/// Animates the leading number in [value] (e.g. "128" or "45,230 د.ل") from
/// its previous displayed amount up to the new one, keeping any surrounding
/// text as-is. Falls back to a plain Text if no number is found.
class _CountUpText extends StatelessWidget {
  final String value;
  final TextStyle style;
  const _CountUpText({required this.value, required this.style});

  @override
  Widget build(BuildContext context) {
    final match = RegExp(r'[\d]+(\.\d+)?').firstMatch(value);
    if (match == null) return Text(value, style: style);
    final target = double.parse(match.group(0)!);
    final isDecimal = match.group(0)!.contains('.');
    final prefix = value.substring(0, match.start);
    final suffix = value.substring(match.end);
    return TweenAnimationBuilder<double>(
      duration: const Duration(milliseconds: 800),
      curve: Curves.easeOutCubic,
      tween: Tween(begin: 0, end: target),
      builder: (context, v, _) {
        final numText = isDecimal ? v.toStringAsFixed(match.group(1)!.length - 1) : v.round().toString();
        return Text('$prefix$numText$suffix', style: style);
      },
    );
  }
}
