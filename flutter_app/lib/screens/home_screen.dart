import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/client.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'admin_screen.dart';
import 'auth_screen.dart' show whatsappUrl;
import 'client_detail_screen.dart';
import 'client_form_screen.dart';
import 'expenses_screen.dart';

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
      _ClientsAndStatsTab(subDays: widget.subDays),
      const ExpensesScreen(embedded: true),
    ];

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.card,
        elevation: 0,
        automaticallyImplyLeading: false,
        title: Text('💳 إدارة بطاقاتك', style: TextStyle(color: colors.gold, fontSize: 15, fontWeight: FontWeight.w900)),
        actions: [
          IconButton(onPressed: theme.toggle, icon: Text(theme.isDark ? '☀️' : '🌙')),
          if (widget.isAdmin)
            IconButton(
              icon: const Text('🛡️', style: TextStyle(fontSize: 20)),
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminScreen())),
            ),
          TextButton(
            onPressed: () => FirebaseAuth.instance.signOut(),
            child: Text('خروج', style: TextStyle(color: colors.textMuted)),
          ),
        ],
      ),
      body: pages[navIndex],
      bottomNavigationBar: NavigationBar(
        backgroundColor: colors.card,
        selectedIndex: navIndex,
        onDestinationSelected: (i) => setState(() => navIndex = i),
        destinations: const [
          NavigationDestination(icon: Text('👥'), label: 'العملاء'),
          NavigationDestination(icon: Text('💰'), label: 'المصروفات'),
        ],
      ),
    );
  }
}

class _ClientsAndStatsTab extends StatefulWidget {
  final int? subDays;
  const _ClientsAndStatsTab({this.subDays});

  @override
  State<_ClientsAndStatsTab> createState() => _ClientsAndStatsTabState();
}

class _ClientsAndStatsTabState extends State<_ClientsAndStatsTab> {
  String tab = 'clients';
  String search = '';
  String filterStatus = 'all';
  String filterBank = 'all';
  String sortBy = 'newest';
  bool showFilters = false;

  final Map<String, TextEditingController> _noteCtrls = {};
  final Map<String, bool> _noteSaving = {};

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

  Future<void> _exportCsv(List<Client> clients) async {
    final cols = <String, String Function(Client)>{
      'الاسم': (c) => c.name,
      'المصرف': (c) => c.bankLabel,
      'الهاتف 1': (c) => c.phone1,
      'الهاتف 2': (c) => c.phone2,
      'الرقم الوطني': (c) => c.nationalId,
      'جواز السفر': (c) => c.passportId,
      'رقم الحساب': (c) => c.accountNumber,
      'IBAN': (c) => c.iban,
      'المبلغ': (c) => c.amount,
      'العملة': (c) => c.currency,
      'نوع الحجز': (c) => c.paymentType,
      'حالة البطاقة': (c) => c.cardBooked ? 'تم الحجز' : 'لم يتم',
      'تاريخ الحجز': (c) => c.bookingDate,
      'الرقم السري': (c) => c.pinCode,
      'تم البيع': (c) => c.isSold ? 'نعم' : 'لا',
      'بيعت إلى': (c) => c.soldTo,
      'اشترى من طرف': (c) => c.purchasedBy,
      'ملاحظات': (c) => c.notes,
    };
    String esc(String v) => '"${v.replaceAll('"', '""')}"';
    final header = cols.keys.map(esc).join(',');
    final rows = clients.map((c) => cols.values.map((fn) => esc(fn(c))).join(',')).join('\r\n');
    final csv = '﻿$header\r\n$rows';

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/clients_export.csv');
    await file.writeAsString(csv, encoding: const SystemEncoding());
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], subject: 'قائمة العملاء'));
  }

  @override
  void dispose() {
    for (final c in _noteCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;
    final user = FirebaseAuth.instance.currentUser!;

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('clients')
          .where('uid', isEqualTo: user.uid)
          .orderBy('createdAt', descending: true)
          .snapshots(includeMetadataChanges: true),
      builder: (context, snapshot) {
        final loading = snapshot.connectionState == ConnectionState.waiting;
        final isOffline = snapshot.data?.metadata.isFromCache ?? false;
        final clients = (snapshot.data?.docs ?? []).map((d) => Client.fromDoc(d.id, d.data())).toList();
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
                child: Text('⚠️ اشتراكك ينتهي خلال ${widget.subDays} أيام — تواصل مع المسؤول للتجديد',
                    style: const TextStyle(color: Color(0xFFF39C12), fontSize: 12), textAlign: TextAlign.center),
              ),
            Container(
              margin: const EdgeInsets.all(12),
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(color: colors.overlay, borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  _segButton('clients', '👥 العملاء', colors),
                  _segButton('stats', '📊 الإحصائيات', colors),
                ],
              ),
            ),
            Expanded(
              child: tab == 'stats'
                  ? _buildStats(colors, total, booked, pending, sold, totalAmt)
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

  Widget _segButton(String value, String label, AppColors colors) {
    final isSel = tab == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => tab = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(color: isSel ? colors.gold : Colors.transparent, borderRadius: BorderRadius.circular(7)),
          alignment: Alignment.center,
          child: Text(label,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isSel ? colors.bg : colors.textMuted)),
        ),
      ),
    );
  }

  Widget _buildStats(AppColors colors, int total, int booked, int pending, int sold, double totalAmt) {
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          alignment: WrapAlignment.center,
          children: [
            StatCard(icon: '👥', value: '$total', label: 'إجمالي العملاء', valueColor: colors.gold, colors: colors),
            StatCard(icon: '✅', value: '$booked', label: 'تم حجز البطاقة', valueColor: const Color(0xFF2ECC71), colors: colors),
            StatCard(icon: '⏳', value: '$pending', label: 'لم يتم الحجز', valueColor: const Color(0xFFF39C12), colors: colors),
            StatCard(icon: '🔴', value: '$sold', label: 'تم البيع', valueColor: const Color(0xFFE74C3C), colors: colors),
            StatCard(icon: '💰', value: '${totalAmt.toStringAsFixed(0)} د.ل', label: 'إجمالي المبالغ', valueColor: colors.gold, colors: colors),
          ],
        ),
        const SizedBox(height: 16),
        OutlinedButton(
          style: OutlinedButton.styleFrom(
            backgroundColor: const Color(0x1A25D366),
            side: const BorderSide(color: Color(0x4D25D366)),
            padding: const EdgeInsets.all(14),
          ),
          onPressed: () => launchUrl(Uri.parse(whatsappUrl), mode: LaunchMode.externalApplication),
          child: const Text('📱 تواصل مع خدمة العملاء', style: TextStyle(color: Color(0xFF25D366), fontWeight: FontWeight.w700)),
        ),
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
                    child: OutlinedButton(
                      onPressed: clients.isEmpty ? null : () => _exportCsv(filtered),
                      child: Text('📊 تصدير CSV', style: TextStyle(color: colors.gold, fontSize: 13)),
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
                      style: TextStyle(color: colors.text),
                      decoration: InputDecoration(
                        hintText: '🔍 بحث بالاسم، الجوال، الرقم الوطني...',
                        hintStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                        filled: true,
                        fillColor: colors.inputBg,
                        contentPadding: const EdgeInsets.all(12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: colors.inputBorder)),
                      ),
                      onChanged: (v) => setState(() => search = v),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    style: IconButton.styleFrom(backgroundColor: colors.inputBg, side: BorderSide(color: colors.inputBorder)),
                    onPressed: () => setState(() => showFilters = !showFilters),
                    icon: const Text('⚙️'),
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
                      'newest': '📅 الأحدث',
                      'oldest': '📅 الأقدم',
                      'booking_asc': '📅 حجز ↑',
                      'booking_desc': '📅 حجز ↓',
                    }, (v) => setState(() => sortBy = v)),
                    const SizedBox(height: 10),
                    Text('الحالة:', style: TextStyle(fontSize: 11, color: colors.textMuted, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    _labeledChips(colors, filterStatus, {
                      'all': 'الكل ($total)',
                      'booked': '✅ تم ($booked)',
                      'pending': '⏳ انتظار ($pending)',
                      'sold': '🔴 مباع ($sold)',
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
    final noteCtrl = _noteCtrls.putIfAbsent(c.id!, () => TextEditingController(text: c.notes));
    final changed = noteCtrl.text != c.notes;
    final saving = _noteSaving[c.id] ?? false;

    return Opacity(
      opacity: c.isSold ? 0.6 : 1,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: colors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: colors.borderSoft)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ClientDetailScreen(client: c))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(c.name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.text))),
                      _statusBadge(c),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(c.bankLabel, style: TextStyle(fontSize: 12, color: colors.textMuted)),
                  Text(c.phone1, style: TextStyle(fontSize: 12, color: colors.textSoft)),
                  if (c.amount.isNotEmpty)
                    Text('${c.amountValue.toStringAsFixed(2)} ${c.currency}',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.gold)),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: colors.inputBg, borderRadius: BorderRadius.circular(10), border: Border.all(color: colors.inputBorder)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('📝 ملاحظات', style: TextStyle(fontSize: 11, color: colors.textMuted, fontWeight: FontWeight.w600)),
                  TextField(
                    controller: noteCtrl,
                    maxLines: null,
                    style: TextStyle(fontSize: 13, color: colors.text),
                    textAlign: TextAlign.right,
                    decoration: InputDecoration(
                      isCollapsed: true,
                      hintText: 'أضف ملاحظة...',
                      hintStyle: TextStyle(color: colors.textMuted),
                      border: InputBorder.none,
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                  if (changed)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: colors.gold, foregroundColor: colors.bg, padding: const EdgeInsets.symmetric(vertical: 8)),
                          onPressed: saving
                              ? null
                              : () async {
                                  setState(() => _noteSaving[c.id!] = true);
                                  final user = FirebaseAuth.instance.currentUser!;
                                  await FirebaseFirestore.instance.collection('clients').doc(c.id).update({
                                    'notes': noteCtrl.text,
                                    'updatedBy': user.email,
                                    'updatedAt': FieldValue.serverTimestamp(),
                                  });
                                  if (mounted) setState(() => _noteSaving[c.id!] = false);
                                },
                          child: saving
                              ? SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2, color: colors.bg))
                              : const Text('💾 حفظ الملاحظة', style: TextStyle(fontSize: 12)),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(backgroundColor: colors.goldSoft, side: BorderSide(color: colors.borderSoft), padding: const EdgeInsets.symmetric(vertical: 6)),
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ClientFormScreen(existing: c))),
                    child: Text('✏️ تعديل', style: TextStyle(color: colors.gold, fontSize: 12)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(backgroundColor: const Color(0x1AE74C3C), side: const BorderSide(color: Color(0x4DE74C3C)), padding: const EdgeInsets.symmetric(vertical: 6)),
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ClientDetailScreen(client: c))),
                    child: const Text('🗑 حذف', style: TextStyle(color: Color(0xFFE74C3C), fontSize: 12)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusBadge(Client c) {
    final (bg, border, text, label) = c.isSold
        ? (const Color(0x1AE74C3C), const Color(0x4DE74C3C), const Color(0xFFF8F6F0), '🔴 مباع')
        : c.cardBooked
            ? (const Color(0x1A2ECC71), const Color(0x4D2ECC71), const Color(0xFFF8F6F0), '✅ تم')
            : (const Color(0x1AF39C12), const Color(0x4DF39C12), const Color(0xFFF8F6F0), '⏳ انتظار');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, border: Border.all(color: border), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: text)),
    );
  }
}
