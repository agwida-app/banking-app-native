import 'dart:math' as math;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../theme/app_theme.dart';
import '../utils/export_utils.dart';
import '../widgets/common.dart';
import 'admin_screen.dart';
import 'client_detail_screen.dart';
import 'client_form_screen.dart';
import 'expenses_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  final int? subDays;
  final bool isAdmin;
  const HomeScreen({super.key, this.subDays, required this.isAdmin});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int navIndex = 0;

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;
    final theme = context.watch<ThemeController>();

    final pages = [
      _ClientsAndStatsTab(key: const ValueKey('clients'), subDays: widget.subDays, mode: 'clients'),
      _ClientsAndStatsTab(key: const ValueKey('stats'), subDays: widget.subDays, mode: 'stats'),
      const ExpensesScreen(key: ValueKey('expenses'), embedded: true),
      const SettingsScreen(key: ValueKey('settings')),
    ];

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.gold,
        elevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        automaticallyImplyLeading: false,
        title: const Text('إدارة بطاقاتك', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900)),
        actions: [
          IconButton(
            onPressed: theme.toggle,
            icon: const Icon(Icons.palette_outlined, color: Colors.white),
          ),
          if (widget.isAdmin)
            IconButton(
              icon: const Icon(Icons.admin_panel_settings, size: 20, color: Colors.white),
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminScreen())),
            ),
          TextButton(
            onPressed: () => FirebaseAuth.instance.signOut(),
            child: const Text('خروج', style: TextStyle(color: Colors.white70)),
          ),
        ],
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 240),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeIn,
        transitionBuilder: (child, animation) => FadeTransition(
          opacity: animation,
          child: ScaleTransition(
            scale: Tween(begin: 0.98, end: 1.0).animate(animation),
            child: child,
          ),
        ),
        child: pages[navIndex],
      ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: colors.card,
        selectedIndex: navIndex,
        onDestinationSelected: (i) => setState(() => navIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.people_alt_outlined), label: 'العملاء'),
          NavigationDestination(icon: Icon(Icons.bar_chart_outlined), label: 'الإحصائيات'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), label: 'المصروفات'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), label: 'الإعدادات'),
        ],
      ),
    );
  }
}

class _ClientsAndStatsTab extends StatefulWidget {
  final int? subDays;
  final String mode; // 'clients' or 'stats'
  const _ClientsAndStatsTab({super.key, this.subDays, required this.mode});

  @override
  State<_ClientsAndStatsTab> createState() => _ClientsAndStatsTabState();
}

class _ClientsAndStatsTabState extends State<_ClientsAndStatsTab> {
  String search = '';
  String filterStatus = 'all';
  String filterBank = 'all';
  String sortBy = 'newest';
  bool showFilters = false;
  String chartMode = 'bar';


  List<Client> _applyFilters(List<Client> clients) {
    final q = search.toLowerCase().trim();
    var filtered = clients.where((c) {
      final m = q.isEmpty ||
          c.name.toLowerCase().contains(q) ||
          c.phone1.contains(q) ||
          c.phone2.contains(q) ||
          c.nationalId.contains(q) ||
          c.passportId.toLowerCase().contains(q) ||
          c.iban.toLowerCase().contains(q) ||
          c.accountNumber.toLowerCase().contains(q);
      final fb = filterBank == 'all' || c.bankLabel == filterBank || c.bankType == filterBank;
      final fs = filterStatus == 'all' ||
          (filterStatus == 'booked' && c.cardBooked && !c.isSold) ||
          (filterStatus == 'pending' && !c.cardBooked && !c.isSold) ||
          (filterStatus == 'sold' && c.isSold);
      return m && fb && fs;
    }).toList();

    if (sortBy == 'oldest') {
      filtered.sort((a, b) => (a.createdAt?.toDate() ?? DateTime(0)).compareTo(b.createdAt?.toDate() ?? DateTime(0)));
    } else if (sortBy == 'booking_asc') {
      filtered.sort((a, b) => _parseDate(a.bookingDate).compareTo(_parseDate(b.bookingDate)));
    } else if (sortBy == 'booking_desc') {
      filtered.sort((a, b) => _parseDate(b.bookingDate).compareTo(_parseDate(a.bookingDate)));
    }
    return filtered;
  }

  DateTime _parseDate(String s) => DateTime.tryParse(s) ?? DateTime(0);

  Future<void> _export(List<Client> clients) async {
    final colors = context.read<ThemeController>().colors;
    final choice = await showExportPicker(context, colors);
    if (choice == 'csv') await exportClientsCsv(clients);
    if (choice == 'pdf') await exportClientsPdf(clients);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;
    final user = FirebaseAuth.instance.currentUser!;

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      // Not ordered server-side: createdAt is a serverTimestamp(), which is
      // still null in the local cache for a client added while offline —
      // Firestore's query engine excludes docs with a null sort-field value
      // from an orderBy, so the new client would vanish from the list until
      // the server resolves the real timestamp. Sorted client-side instead.
      stream: FirebaseFirestore.instance
          .collection('clients')
          .where('uid', isEqualTo: user.uid)
          .snapshots(includeMetadataChanges: true),
      builder: (context, snapshot) {
        final loading = snapshot.connectionState == ConnectionState.waiting;
        final isOffline = snapshot.data?.metadata.isFromCache ?? false;
        final clients = (snapshot.data?.docs ?? []).map((d) => Client.fromDoc(d.id, d.data())).toList()
          ..sort((a, b) => (b.createdAt?.toDate() ?? DateTime.now()).compareTo(a.createdAt?.toDate() ?? DateTime.now()));
        final filtered = _applyFilters(clients);

        final total = clients.length;
        final booked = clients.where((c) => c.cardBooked && !c.isSold).length;
        final pending = clients.where((c) => !c.cardBooked && !c.isSold).length;
        final sold = clients.where((c) => c.isSold).length;
        final totalAmt = clients.where((c) => !c.isSold).fold<double>(0, (s, c) => s + c.amountValue);
        final bankNames = clients.map((c) => c.bankLabel).where((b) => b.isNotEmpty).toSet().toList();

        return Column(
          children: [
            OfflineBanner(isOffline: isOffline),
            if (widget.subDays != null && widget.subDays! <= 7 && widget.subDays! > 0 && widget.subDays! < 9999)
              Container(
                margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0x1AF39C12),
                  border: Border.all(color: const Color(0x4DF39C12)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFF39C12)),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text('اشتراكك ينتهي خلال ${widget.subDays} أيام — تواصل مع المسؤول للتجديد',
                          style: const TextStyle(color: Color(0xFFF39C12), fontSize: 12), textAlign: TextAlign.center),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: widget.mode == 'stats'
                  ? _buildStats(colors, clients, total, booked, pending, sold, totalAmt)
                  : _buildClients(colors, loading, clients, filtered, bankNames, total, booked, pending, sold),
            ),
          ],
        );
      },
    );
  }

  Widget _labeledChips(AppColors colors, String selected, Map<String, String> optionLabels, ValueChanged<String> onSelect) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: optionLabels.entries.map((e) {
        final isSel = e.key == selected;
        return ChoiceChip(
          label: Text(e.value),
          selected: isSel,
          onSelected: (_) => onSelect(e.key),
          backgroundColor: colors.inputBg,
          selectedColor: colors.goldSoft,
          labelStyle: TextStyle(color: isSel ? colors.gold : colors.textMuted, fontWeight: isSel ? FontWeight.w700 : FontWeight.normal, fontSize: 12),
          side: BorderSide(color: isSel ? colors.gold : colors.inputBorder),
        );
      }).toList(),
    );
  }

  List<MapEntry<String, int>> _bankCounts(List<Client> clients) {
    final counts = <String, int>{};
    for (final c in clients) {
      final b = c.bankLabel;
      if (b.isEmpty) continue;
      counts[b] = (counts[b] ?? 0) + 1;
    }
    final entries = counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    return entries;
  }

  Widget _buildStats(AppColors colors, List<Client> clients, int total, int booked, int pending, int sold, double totalAmt) {
    final bankCounts = _bankCounts(clients);
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          alignment: WrapAlignment.center,
          children: [
            StatCard(icon: Icons.people_alt, value: '$total', label: 'إجمالي العملاء', valueColor: colors.gold, colors: colors),
            StatCard(icon: Icons.check_circle, value: '$booked', label: 'تم حجز البطاقة', valueColor: const Color(0xFF2ECC71), colors: colors),
            StatCard(icon: Icons.hourglass_bottom, value: '$pending', label: 'لم يتم الحجز', valueColor: const Color(0xFFF39C12), colors: colors),
            StatCard(icon: Icons.sell, value: '$sold', label: 'تم البيع', valueColor: const Color(0xFFE74C3C), colors: colors),
            StatCard(icon: Icons.payments, value: '${totalAmt.toStringAsFixed(0)} د.ل', label: 'إجمالي المبالغ', valueColor: colors.gold, colors: colors),
          ],
        ),
        if (bankCounts.isNotEmpty) ...[
          const SizedBox(height: 16),
          _bankDistributionCard(colors, bankCounts),
        ],
      ],
    );
  }

  static const List<Color> _chartPalette = [
    Color(0xFFC9A84C), // gold
    Color(0xFF2ECC71), // green
    Color(0xFF8C6EE6), // purple
    Color(0xFF4AA8E0), // blue
    Color(0xFFF39C12), // orange
    Color(0xFFE74C3C), // red
    Color(0xFF2EC4B6), // teal
  ];

  Widget _bankDistributionCard(AppColors colors, List<MapEntry<String, int>> bankCounts) {
    final maxCount = bankCounts.first.value;
    final totalCount = bankCounts.fold<int>(0, (s, e) => s + e.value);

    Widget toggleBtn(String mode, IconData icon) {
      final active = chartMode == mode;
      return InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => setState(() => chartMode = mode),
        child: Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: active ? colors.goldSoft : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: active ? colors.gold : colors.borderSoft),
          ),
          child: Icon(icon, size: 16, color: active ? colors.gold : colors.textMuted),
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.borderSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('توزيع البطاقات حسب المصرف', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.text)),
              Row(children: [toggleBtn('pie', Icons.pie_chart), const SizedBox(width: 6), toggleBtn('bar', Icons.bar_chart)]),
            ],
          ),
          const SizedBox(height: 14),
          if (chartMode == 'bar')
            Column(
              children: [
                for (int i = 0; i < bankCounts.length; i++)
                  Padding(
                    padding: EdgeInsets.only(top: i == 0 ? 0 : 10),
                    child: Row(
                      children: [
                        SizedBox(width: 26, child: Text('${bankCounts[i].value}', style: TextStyle(fontSize: 11, color: colors.textMuted))),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Stack(
                            children: [
                              Container(height: 8, decoration: BoxDecoration(color: colors.inputBg, borderRadius: BorderRadius.circular(4))),
                              FractionallySizedBox(
                                widthFactor: maxCount == 0 ? 0 : bankCounts[i].value / maxCount,
                                child: Container(
                                  height: 8,
                                  decoration: BoxDecoration(color: _chartPalette[i % _chartPalette.length], borderRadius: BorderRadius.circular(4)),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 90,
                          child: Text(bankCounts[i].key,
                              textAlign: TextAlign.right, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: colors.textSoft)),
                        ),
                      ],
                    ),
                  ),
              ],
            )
          else
            Column(
              children: [
                SizedBox(
                  height: 160,
                  child: Center(
                    child: _DonutChart(
                      values: [for (final e in bankCounts) e.value.toDouble()],
                      colorsList: [for (int i = 0; i < bankCounts.length; i++) _chartPalette[i % _chartPalette.length]],
                      centerText: '$totalCount',
                      centerLabel: 'بطاقة',
                      centerTextColor: colors.text,
                      centerLabelColor: colors.textMuted,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Column(
                  children: [
                    for (int row = 0; row < (bankCounts.length / 2).ceil(); row++)
                      Padding(
                        padding: EdgeInsets.only(top: row == 0 ? 0 : 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(child: _legendItem(colors, bankCounts, row * 2)),
                            const SizedBox(width: 14),
                            Expanded(
                              child: row * 2 + 1 < bankCounts.length ? _legendItem(colors, bankCounts, row * 2 + 1) : const SizedBox(),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _legendItem(AppColors colors, List<MapEntry<String, int>> bankCounts, int i) {
    return Row(
      children: [
        Container(width: 9, height: 9, decoration: BoxDecoration(color: _chartPalette[i % _chartPalette.length], shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(bankCounts[i].key, style: TextStyle(fontSize: 11.5, color: colors.textSoft), overflow: TextOverflow.ellipsis, maxLines: 1),
        ),
        const SizedBox(width: 6),
        Text('${bankCounts[i].value}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: colors.text)),
      ],
    );
  }

  Widget _buildClients(
    AppColors colors,
    bool loading,
    List<Client> clients,
    List<Client> filtered,
    List<String> bankNames,
    int total,
    int booked,
    int pending,
    int sold,
  ) {
    return Stack(
      children: [
        Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: clients.isEmpty ? null : () => _export(filtered),
                      icon: Icon(Icons.ios_share_outlined, size: 16, color: colors.gold),
                      label: Text('تصدير ومشاركة', style: TextStyle(color: colors.gold, fontSize: 13)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      textAlign: TextAlign.right,
                      style: TextStyle(color: colors.fieldText),
                      decoration: InputDecoration(
                        hintText: 'بحث بالاسم، الجوال، الرقم الوطني...',
                        hintStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                        prefixIcon: Icon(Icons.search, color: colors.textMuted, size: 20),
                        filled: true,
                        fillColor: colors.fieldBg,
                        contentPadding: const EdgeInsets.all(12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: colors.fieldBorder)),
                      ),
                      onChanged: (v) => setState(() => search = v),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    style: IconButton.styleFrom(backgroundColor: colors.inputBg, side: BorderSide(color: colors.inputBorder)),
                    onPressed: () => setState(() => showFilters = !showFilters),
                    icon: Icon(Icons.tune, color: colors.textMuted),
                  ),
                ],
              ),
            ),
            if (showFilters)
              Container(
                margin: const EdgeInsets.fromLTRB(14, 8, 14, 0),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: colors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: colors.borderSoft)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('الفرز:', style: TextStyle(fontSize: 11, color: colors.textMuted, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    _labeledChips(colors, sortBy, const {
                      'newest': 'الأحدث',
                      'oldest': 'الأقدم',
                      'booking_asc': 'حجز ↑',
                      'booking_desc': 'حجز ↓',
                    }, (v) => setState(() => sortBy = v)),
                    const SizedBox(height: 10),
                    Text('الحالة:', style: TextStyle(fontSize: 11, color: colors.textMuted, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    _labeledChips(colors, filterStatus, {
                      'all': 'الكل ($total)',
                      'booked': 'تم ($booked)',
                      'pending': 'انتظار ($pending)',
                      'sold': 'مباع ($sold)',
                    }, (v) => setState(() => filterStatus = v)),
                    if (bankNames.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text('المصرف:', style: TextStyle(fontSize: 11, color: colors.textMuted, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 6),
                      _labeledChips(
                        colors,
                        filterBank,
                        {'all': 'الكل', for (final b in bankNames) b: b},
                        (v) => setState(() => filterBank = v),
                      ),
                    ],
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 6, 14, 0),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text('${filtered.length} عميل', style: TextStyle(fontSize: 11, color: colors.textMuted)),
              ),
            ),
            Expanded(
              child: loading
                  ? Center(child: CircularProgressIndicator(color: colors.gold))
                  : filtered.isEmpty
                      ? Center(
                          child: Text(clients.isEmpty ? 'اضغط + لإضافة أول عميل' : 'لا توجد نتائج',
                              style: TextStyle(color: colors.textMuted)),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(14, 8, 14, 90),
                          itemCount: filtered.length,
                          itemBuilder: (context, i) => _clientCard(colors, filtered[i]),
                        ),
            ),
          ],
        ),
        Positioned(
          bottom: 16,
          left: 16,
          child: FloatingActionButton(
            backgroundColor: colors.gold,
            foregroundColor: colors.bg,
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ClientFormScreen())),
            child: const Icon(Icons.add, size: 28),
          ),
        ),
      ],
    );
  }

  Widget _clientCard(AppColors colors, Client c) {
    return Opacity(
      opacity: c.isSold ? 0.6 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ClientDetailScreen(client: c))),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(color: colors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: colors.borderSoft)),
            child: Row(
              children: [
                Expanded(
                  child: Text(c.name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.text)),
                ),
                const SizedBox(width: 10),
                _statusBadge(c),
                const SizedBox(width: 6),
                Icon(Icons.chevron_left, size: 18, color: colors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _statusBadge(Client c) {
    final (bg, border, text, icon, label) = c.isSold
        ? (const Color(0x1AE74C3C), const Color(0x4DE74C3C), const Color(0xFFE74C3C), Icons.sell, 'مباع')
        : c.cardBooked
            ? (const Color(0x1A2ECC71), const Color(0x4D2ECC71), const Color(0xFF2ECC71), Icons.check_circle, 'تم')
            : (const Color(0x1AF39C12), const Color(0x4DF39C12), const Color(0xFFF39C12), Icons.hourglass_bottom, 'انتظار');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, border: Border.all(color: border), borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: text),
          const SizedBox(width: 3),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: text)),
        ],
      ),
    );
  }
}

class _DonutChart extends StatelessWidget {
  final List<double> values;
  final List<Color> colorsList;
  final String centerText;
  final String centerLabel;
  final Color centerTextColor;
  final Color centerLabelColor;

  const _DonutChart({
    required this.values,
    required this.colorsList,
    required this.centerText,
    required this.centerLabel,
    required this.centerTextColor,
    required this.centerLabelColor,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      height: 160,
      child: CustomPaint(
        painter: _DonutPainter(values: values, colorsList: colorsList),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(centerText, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: centerTextColor)),
              Text(centerLabel, style: TextStyle(fontSize: 11, color: centerLabelColor)),
            ],
          ),
        ),
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  final List<double> values;
  final List<Color> colorsList;
  const _DonutPainter({required this.values, required this.colorsList});

  @override
  void paint(Canvas canvas, Size size) {
    final total = values.fold<double>(0, (s, v) => s + v);
    if (total <= 0) return;
    const strokeWidth = 22.0;
    final rect = Rect.fromLTWH(0, 0, size.width, size.height).deflate(strokeWidth / 2 + 2);
    var startAngle = -math.pi / 2;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.butt;
    for (var i = 0; i < values.length; i++) {
      final sweep = (values[i] / total) * 2 * math.pi;
      final gap = values.length > 1 ? 0.025 : 0.0;
      paint.color = colorsList[i % colorsList.length];
      canvas.drawArc(rect, startAngle, (sweep - gap).clamp(0.0, 2 * math.pi), false, paint);
      startAngle += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) =>
      oldDelegate.values != values || oldDelegate.colorsList != colorsList;
}
