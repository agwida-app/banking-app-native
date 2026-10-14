import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/ledger.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'ledger_person_screen.dart';

class ExpensesScreen extends StatefulWidget {
  final bool embedded;
  const ExpensesScreen({super.key, this.embedded = false});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  String search = '';

  void _addPerson() {
    final colors = context.read<ThemeController>().colors;
    final nameCtrl = TextEditingController();
    String? err;

    showModalBottomSheet(
      context: context,
      backgroundColor: colors.bg,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(left: 16, right: 16, top: 10, bottom: MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(color: colors.borderSoft, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: colors.goldSoft, borderRadius: BorderRadius.circular(10)),
                    child: Icon(Icons.person_add_alt_outlined, size: 18, color: colors.gold),
                  ),
                  const SizedBox(width: 10),
                  Text('شخص جديد', style: TextStyle(color: colors.text, fontSize: 16, fontWeight: FontWeight.w900)),
                ],
              ),
              const SizedBox(height: 16),
              if (err != null) MessageBanner(text: err!),
              ThemedField(label: 'الاسم', controller: nameCtrl, colors: colors, hint: 'اسم الشخص'),
              const SizedBox(height: 8),
              PrimaryButton(
                label: 'إضافة',
                colors: colors,
                onPressed: () {
                  final name = nameCtrl.text.trim();
                  if (name.isEmpty) {
                    setSheetState(() => err = 'أدخل الاسم');
                    return;
                  }
                  final user = FirebaseAuth.instance.currentUser!;
                  // Fire-and-forget: Firestore applies this to the local cache
                  // immediately and syncs once online, but the returned Future
                  // doesn't resolve until the server acks it — awaiting it
                  // would hang the UI indefinitely while offline.
                  FirebaseFirestore.instance.collection('ledgerPeople').add({
                    'name': name,
                    'uid': user.uid,
                    'createdAt': FieldValue.serverTimestamp(),
                  }).catchError((e) {
                    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تعذر الحفظ: $e')));
                  });
                  Navigator.pop(ctx);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(AppColors colors) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.account_balance_wallet_outlined, size: 20, color: colors.gold),
              const SizedBox(width: 6),
              Text('المصروفات', style: TextStyle(color: colors.text, fontSize: 19, fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 3),
          Text('دفتر حسابات — من له ومن عليه', style: TextStyle(color: colors.textMuted, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _searchField(AppColors colors) {
    return TextField(
      textAlign: TextAlign.right,
      style: TextStyle(color: colors.fieldText),
      decoration: InputDecoration(
        hintText: 'بحث بالاسم...',
        hintStyle: TextStyle(color: colors.textMuted, fontSize: 13),
        prefixIcon: Icon(Icons.search, color: colors.textMuted, size: 20),
        filled: true,
        fillColor: colors.fieldBg,
        contentPadding: const EdgeInsets.all(12),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: colors.fieldBorder)),
      ),
      onChanged: (v) => setState(() => search = v),
    );
  }

  Widget _addFab(AppColors colors) {
    return Positioned(
      bottom: 16,
      left: 16,
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: _addPerson,
        child: Container(
          width: 56,
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [colors.gold, colors.gold.withOpacity(0.7)]),
            boxShadow: [BoxShadow(color: colors.gold.withOpacity(0.4), blurRadius: 16, offset: const Offset(0, 6))],
          ),
          child: Icon(Icons.person_add_alt_1, color: colors.bg, size: 26),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.watch<ThemeController>().colors;
    final user = FirebaseAuth.instance.currentUser!;

    final body = StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('ledgerPeople')
          .where('uid', isEqualTo: user.uid)
          .orderBy('createdAt', descending: true)
          .snapshots(includeMetadataChanges: true),
      builder: (context, peopleSnap) {
        final loading = peopleSnap.connectionState == ConnectionState.waiting;
        final isOffline = peopleSnap.data?.metadata.isFromCache ?? false;
        final people = (peopleSnap.data?.docs ?? []).map((d) => LedgerPerson.fromDoc(d.id, d.data())).toList();

        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance.collection('ledgerEntries').where('uid', isEqualTo: user.uid).snapshots(includeMetadataChanges: true),
          builder: (context, entriesSnap) {
            final allEntries = (entriesSnap.data?.docs ?? []).map((d) => LedgerEntry.fromDoc(d.id, d.data())).toList();

            double balanceFor(String? personId) {
              var net = 0.0;
              for (final e in allEntries) {
                if (e.personId != personId) continue;
                net += e.type == LedgerEntryType.lana ? e.amount : -e.amount;
              }
              return net;
            }

            final q = search.trim().toLowerCase();
            final filteredPeople = q.isEmpty ? people : people.where((p) => p.name.toLowerCase().contains(q)).toList();

            return Column(
              children: [
                OfflineBanner(isOffline: isOffline),
                _header(colors),
                if (people.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                    child: _searchField(colors),
                  ),
                const SizedBox(height: 12),
                Expanded(
                  child: loading
                      ? Center(child: CircularProgressIndicator(color: colors.gold))
                      : people.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.people_outline, size: 34, color: colors.textMuted.withOpacity(0.6)),
                                  const SizedBox(height: 8),
                                  Text('لا يوجد أشخاص بعد — اضغط + لإضافة أول شخص', style: TextStyle(color: colors.textMuted)),
                                ],
                              ),
                            )
                          : filteredPeople.isEmpty
                              ? Center(child: Text('لا توجد نتائج', style: TextStyle(color: colors.textMuted)))
                              : ListView.builder(
                                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 88),
                                  itemCount: filteredPeople.length,
                                  itemBuilder: (context, i) => _personCard(colors, filteredPeople[i], balanceFor(filteredPeople[i].id)),
                                ),
                ),
              ],
            );
          },
        );
      },
    );

    if (widget.embedded) {
      return Container(color: colors.bg, child: Stack(children: [body, _addFab(colors)]));
    }

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.gold,
        foregroundColor: Colors.white,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        title: const Text('المصروفات'),
      ),
      body: Stack(children: [body, _addFab(colors)]),
    );
  }

  Widget _personCard(AppColors colors, LedgerPerson p, double balance) {
    final isZero = balance.abs() < 0.005;
    final isPositive = balance > 0;
    final color = isZero ? colors.textMuted : (isPositive ? const Color(0xFF2ECC71) : const Color(0xFFE74C3C));
    final label = isZero ? 'متصافي' : (isPositive ? 'لنا' : 'لهم');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.borderSoft),
        boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 10, offset: Offset(0, 4))],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => LedgerPersonScreen(person: p))),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: colors.goldSoft, borderRadius: BorderRadius.circular(13)),
                  child: Text(p.name.isNotEmpty ? p.name[0] : '؟', style: TextStyle(color: colors.gold, fontWeight: FontWeight.w900, fontSize: 16)),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(p.name, style: TextStyle(color: colors.text, fontWeight: FontWeight.w700, fontSize: 14.5))),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('${balance.abs().toStringAsFixed(0)} د.ل', style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 14)),
                    Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(width: 6),
                Icon(Icons.chevron_left, size: 18, color: colors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
