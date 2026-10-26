import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

import '../models/client.dart';
import '../models/ledger.dart';

pw.Font? _arabicFont;

Future<pw.Font> _loadArabicFont() async {
  if (_arabicFont != null) return _arabicFont!;
  final data = await rootBundle.load('assets/fonts/NotoSansArabic.ttf');
  _arabicFont = pw.Font.ttf(data);
  return _arabicFont!;
}

String _fmtDate(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String _csvEscape(String v) => '"${v.replaceAll('"', '""')}"';

Future<File> _writeTextTemp(String name, String content) async {
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/$name');
  await file.writeAsString(content, encoding: const SystemEncoding());
  return file;
}

Future<File> _writeBytesTemp(String name, List<int> bytes) async {
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/$name');
  await file.writeAsBytes(bytes);
  return file;
}

const _clientColumns = <String, String Function(Client)>{
  'الاسم': _cName,
  'المصرف': _cBank,
  'الهاتف 1': _cPhone1,
  'الهاتف 2': _cPhone2,
  'الرقم الوطني': _cNationalId,
  'جواز السفر': _cPassport,
  'رقم الحساب': _cAccount,
  'IBAN': _cIban,
  'المبلغ': _cAmount,
  'العملة': _cCurrency,
  'نوع الحجز': _cPaymentType,
  'حالة البطاقة': _cBookedLabel,
  'تاريخ الحجز': _cBookingDate,
  'الرقم السري': _cPin,
  'تم البيع': _cSoldLabel,
  'بيعت إلى': _cSoldTo,
  'اشترى من طرف': _cPurchasedBy,
  'ملاحظات': _cNotes,
};

String _cName(Client c) => c.name;
String _cBank(Client c) => c.bankLabel;
String _cPhone1(Client c) => c.phone1;
String _cPhone2(Client c) => c.phone2;
String _cNationalId(Client c) => c.nationalId;
String _cPassport(Client c) => c.passportId;
String _cAccount(Client c) => c.accountNumber;
String _cIban(Client c) => c.iban;
String _cAmount(Client c) => c.amount;
String _cCurrency(Client c) => c.currency;
String _cPaymentType(Client c) => c.paymentType;
String _cBookedLabel(Client c) => c.cardBooked ? 'تم الحجز' : 'لم يتم';
String _cBookingDate(Client c) => c.bookingDate;
String _cPin(Client c) => c.pinCode;
String _cSoldLabel(Client c) => c.isSold ? 'نعم' : 'لا';
String _cSoldTo(Client c) => c.soldTo;
String _cPurchasedBy(Client c) => c.purchasedBy;
String _cNotes(Client c) => c.notes;

Future<void> exportClientsCsv(List<Client> clients) async {
  final header = _clientColumns.keys.map(_csvEscape).join(',');
  final rows = clients.map((c) => _clientColumns.values.map((fn) => _csvEscape(fn(c))).join(',')).join('\r\n');
  final csv = '﻿$header\r\n$rows';
  final file = await _writeTextTemp('clients_export.csv', csv);
  await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], subject: 'قائمة العملاء'));
}

Future<void> exportClientsPdf(List<Client> clients) async {
  final font = await _loadArabicFont();
  final doc = pw.Document();
  // The pdf package's Table lays columns out left-to-right regardless of
  // text direction (it has no RTL column-reordering support at all), so to
  // read correctly in Arabic (first column on the right) the array itself
  // has to be reversed — written here in natural RTL reading order, then
  // physically reversed right before handing it to the table.
  final headersRtl = ['الاسم', 'المصرف', 'الهاتف', 'الرقم الوطني', 'الحالة', 'المبلغ', 'بيعت إلى'];
  final headers = headersRtl.reversed.toList();
  final rows = clients
      .map((c) => [
            c.name,
            c.bankLabel,
            c.phone1,
            c.nationalId,
            c.isSold ? 'مباع' : (c.cardBooked ? 'تم الحجز' : 'انتظار'),
            '${c.amountValue.toStringAsFixed(0)} ${c.currency}',
            c.isSold && c.soldTo.isNotEmpty ? c.soldTo : '—',
          ].reversed.toList())
      .toList();

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4.landscape,
      textDirection: pw.TextDirection.rtl,
      theme: pw.ThemeData.withFont(base: font, bold: font),
      header: (ctx) => pw.Padding(
        padding: const pw.EdgeInsets.only(bottom: 12),
        child: pw.Text('قائمة العملاء — إدارة بطاقاتك', style: const pw.TextStyle(fontSize: 18), textAlign: pw.TextAlign.right),
      ),
      build: (ctx) => [
        pw.TableHelper.fromTextArray(
          headers: headers,
          data: rows,
          tableDirection: pw.TextDirection.rtl,
          headerStyle: const pw.TextStyle(fontSize: 11),
          cellStyle: const pw.TextStyle(fontSize: 10),
          cellAlignment: pw.Alignment.centerRight,
          headerAlignment: pw.Alignment.center,
          border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
          headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
        ),
      ],
    ),
  );

  final file = await _writeBytesTemp('clients_export.pdf', await doc.save());
  await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], subject: 'قائمة العملاء'));
}

Future<void> exportAllLedgerCsv(List<LedgerPerson> people, List<LedgerEntry> entries) async {
  final names = {for (final p in people) p.id: p.name};
  final sorted = [...entries]..sort((a, b) {
      final byName = (names[a.personId] ?? '').compareTo(names[b.personId] ?? '');
      return byName != 0 ? byName : b.date.compareTo(a.date);
    });
  final header = ['الاسم', 'التاريخ', 'النوع', 'المبلغ', 'السبب'].map(_csvEscape).join(',');
  final rows = sorted
      .map((e) => [
            _csvEscape(names[e.personId] ?? '—'),
            _csvEscape(_fmtDate(e.date)),
            _csvEscape(e.type == LedgerEntryType.lana ? 'لنا' : 'لهم'),
            _csvEscape(e.amount.toStringAsFixed(2)),
            _csvEscape(e.reason),
          ].join(','))
      .join('\r\n');
  final csv = '﻿$header\r\n$rows';
  final file = await _writeTextTemp('expenses_export.csv', csv);
  await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], subject: 'المصروفات — جميع المعاملات'));
}

Future<void> exportAllLedgerPdf(List<LedgerPerson> people, List<LedgerEntry> entries) async {
  final font = await _loadArabicFont();
  final names = {for (final p in people) p.id: p.name};
  final sorted = [...entries]..sort((a, b) {
      final byName = (names[a.personId] ?? '').compareTo(names[b.personId] ?? '');
      return byName != 0 ? byName : b.date.compareTo(a.date);
    });

  final totalLana = entries.where((e) => e.type == LedgerEntryType.lana).fold<double>(0, (s, e) => s + e.amount);
  final totalLahom = entries.where((e) => e.type == LedgerEntryType.lahom).fold<double>(0, (s, e) => s + e.amount);

  final doc = pw.Document();
  final headersRtl = ['الاسم', 'التاريخ', 'النوع', 'المبلغ (د.ل)', 'السبب'];
  final headers = headersRtl.reversed.toList();
  final rows = sorted
      .map((e) => [
            names[e.personId] ?? '—',
            _fmtDate(e.date),
            e.type == LedgerEntryType.lana ? 'لنا' : 'لهم',
            e.amount.toStringAsFixed(2),
            e.reason,
          ].reversed.toList())
      .toList();

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      textDirection: pw.TextDirection.rtl,
      theme: pw.ThemeData.withFont(base: font, bold: font),
      header: (ctx) => pw.Padding(
        padding: const pw.EdgeInsets.only(bottom: 12),
        child: pw.Text('المصروفات — جميع المعاملات', style: const pw.TextStyle(fontSize: 18), textAlign: pw.TextAlign.right),
      ),
      build: (ctx) => [
        pw.TableHelper.fromTextArray(
          headers: headers,
          data: rows,
          tableDirection: pw.TextDirection.rtl,
          headerStyle: const pw.TextStyle(fontSize: 11),
          cellStyle: const pw.TextStyle(fontSize: 10),
          cellAlignment: pw.Alignment.centerRight,
          headerAlignment: pw.Alignment.center,
          border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
          headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
        ),
        pw.SizedBox(height: 20),
        pw.Container(
          alignment: pw.Alignment.centerRight,
          padding: const pw.EdgeInsets.all(12),
          decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.grey400), borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8))),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.end,
            children: [
              pw.Text('إجمالي لنا: ${totalLana.toStringAsFixed(2)} د.ل', style: const pw.TextStyle(fontSize: 12)),
              pw.SizedBox(height: 4),
              pw.Text('إجمالي لهم: ${totalLahom.toStringAsFixed(2)} د.ل', style: const pw.TextStyle(fontSize: 12)),
              pw.SizedBox(height: 4),
              pw.Text('الصافي: ${(totalLana - totalLahom).toStringAsFixed(2)} د.ل', style: const pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold)),
            ],
          ),
        ),
      ],
    ),
  );

  final file = await _writeBytesTemp('expenses_export.pdf', await doc.save());
  await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], subject: 'المصروفات — جميع المعاملات'));
}

Future<void> exportLedgerCsv(LedgerPerson person, List<LedgerEntry> entries) async {
  final header = ['التاريخ', 'النوع', 'المبلغ', 'السبب'].map(_csvEscape).join(',');
  final rows = entries
      .map((e) => [
            _csvEscape(_fmtDate(e.date)),
            _csvEscape(e.type == LedgerEntryType.lana ? 'لنا' : 'لهم'),
            _csvEscape(e.amount.toStringAsFixed(2)),
            _csvEscape(e.reason),
          ].join(','))
      .join('\r\n');
  final csv = '﻿$header\r\n$rows';
  final safeName = person.name.replaceAll(RegExp(r'[\\/]'), '_');
  final file = await _writeTextTemp('ledger_$safeName.csv', csv);
  await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], subject: 'كشف حساب - ${person.name}'));
}

Future<void> exportLedgerPdf(LedgerPerson person, List<LedgerEntry> entries, double balance) async {
  final font = await _loadArabicFont();
  final doc = pw.Document();
  final isZero = balance.abs() < 0.005;
  final balanceLabel = isZero ? 'الحساب متصافٍ' : (balance > 0 ? 'لنا عنده' : 'له عندنا');

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      textDirection: pw.TextDirection.rtl,
      theme: pw.ThemeData.withFont(base: font, bold: font),
      build: (ctx) => [
        pw.Text('كشف حساب', style: const pw.TextStyle(fontSize: 22), textAlign: pw.TextAlign.right),
        pw.SizedBox(height: 4),
        pw.Text(person.name, style: const pw.TextStyle(fontSize: 16), textAlign: pw.TextAlign.right),
        pw.SizedBox(height: 16),
        pw.TableHelper.fromTextArray(
          // Reversed for the same reason as the clients table — see the
          // comment in exportClientsPdf.
          headers: ['التاريخ', 'النوع', 'المبلغ (د.ل)', 'السبب'].reversed.toList(),
          data: entries
              .map((e) => [_fmtDate(e.date), e.type == LedgerEntryType.lana ? 'لنا' : 'لهم', e.amount.toStringAsFixed(2), e.reason].reversed.toList())
              .toList(),
          tableDirection: pw.TextDirection.rtl,
          headerStyle: const pw.TextStyle(fontSize: 11),
          cellStyle: const pw.TextStyle(fontSize: 10),
          cellAlignment: pw.Alignment.centerRight,
          headerAlignment: pw.Alignment.center,
          border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
          headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
        ),
        pw.SizedBox(height: 20),
        pw.Container(
          alignment: pw.Alignment.centerRight,
          padding: const pw.EdgeInsets.all(12),
          decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.grey400), borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8))),
          child: pw.Text('$balanceLabel: ${balance.abs().toStringAsFixed(2)} د.ل', style: const pw.TextStyle(fontSize: 14)),
        ),
      ],
    ),
  );

  final safeName = person.name.replaceAll(RegExp(r'[\\/]'), '_');
  final file = await _writeBytesTemp('ledger_$safeName.pdf', await doc.save());
  await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], subject: 'كشف حساب - ${person.name}'));
}
