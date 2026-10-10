import 'package:cloud_firestore/cloud_firestore.dart';

const bankOptions = [
  'التجاري الوطني',
  'الجمهورية',
  'الأمان',
  'الوحدة',
  'شمال أفريقيا',
  'التجارة والتنمية',
  'المتوسط',
  'الاتحاد',
  'أخرى',
];

class Client {
  final String? id;
  final String name;
  final String bankType;
  final String bankTypeOther;
  final String phone1;
  final String phone2;
  final String nationalId;
  final String passportId;
  final String accountNumber;
  final String iban;
  final String amount;
  final String currency;
  final String purchasedBy;
  final String paymentType;
  final bool cardBooked;
  final String bookingDate;
  final String pinCode;
  final String soldTo;
  final bool isSold;
  final String notes;
  final String? uid;
  final String? createdBy;
  final Timestamp? createdAt;
  final String? updatedBy;
  final Timestamp? updatedAt;

  const Client({
    this.id,
    this.name = '',
    this.bankType = '',
    this.bankTypeOther = '',
    this.phone1 = '',
    this.phone2 = '',
    this.nationalId = '',
    this.passportId = '',
    this.accountNumber = '',
    this.iban = '',
    this.amount = '',
    this.currency = 'د.ل',
    this.purchasedBy = '',
    this.paymentType = '',
    this.cardBooked = false,
    this.bookingDate = '',
    this.pinCode = '',
    this.soldTo = '',
    this.isSold = false,
    this.notes = '',
    this.uid,
    this.createdBy,
    this.createdAt,
    this.updatedBy,
    this.updatedAt,
  });

  String get bankLabel => bankType == 'أخرى' ? (bankTypeOther.isNotEmpty ? bankTypeOther : 'أخرى') : bankType;

  double get amountValue => double.tryParse(amount) ?? 0;

  factory Client.fromDoc(String id, Map<String, dynamic> d) {
    return Client(
      id: id,
      name: d['name'] ?? '',
      bankType: d['bankType'] ?? '',
      bankTypeOther: d['bankTypeOther'] ?? '',
      phone1: d['phone1'] ?? '',
      phone2: d['phone2'] ?? '',
      nationalId: d['nationalId'] ?? '',
      passportId: d['passportId'] ?? '',
      accountNumber: d['accountNumber'] ?? '',
      iban: d['iban'] ?? '',
      amount: d['amount']?.toString() ?? '',
      currency: d['currency'] ?? 'د.ل',
      purchasedBy: d['purchasedBy'] ?? '',
      paymentType: d['paymentType'] ?? '',
      cardBooked: d['cardBooked'] ?? false,
      bookingDate: d['bookingDate'] ?? '',
      pinCode: d['pinCode'] ?? '',
      soldTo: d['soldTo'] ?? '',
      isSold: d['isSold'] ?? false,
      notes: d['notes'] ?? '',
      uid: d['uid'],
      createdBy: d['createdBy'],
      createdAt: d['createdAt'],
      updatedBy: d['updatedBy'],
      updatedAt: d['updatedAt'],
    );
  }

  Map<String, dynamic> toMap() => {
        'name': name,
        'bankType': bankType,
        'bankTypeOther': bankTypeOther,
        'phone1': phone1,
        'phone2': phone2,
        'nationalId': nationalId,
        'passportId': passportId,
        'accountNumber': accountNumber,
        'iban': iban,
        'amount': amount,
        'currency': currency,
        'purchasedBy': purchasedBy,
        'paymentType': paymentType,
        'cardBooked': cardBooked,
        'bookingDate': bookingDate,
        'pinCode': pinCode,
        'soldTo': soldTo,
        'isSold': isSold,
        'notes': notes,
      };

  Client copyWith({
    String? name,
    String? bankType,
    String? bankTypeOther,
    String? phone1,
    String? phone2,
    String? nationalId,
    String? passportId,
    String? accountNumber,
    String? iban,
    String? amount,
    String? currency,
    String? purchasedBy,
    String? paymentType,
    bool? cardBooked,
    String? bookingDate,
    String? pinCode,
    String? soldTo,
    bool? isSold,
    String? notes,
  }) {
    return Client(
      id: id,
      name: name ?? this.name,
      bankType: bankType ?? this.bankType,
      bankTypeOther: bankTypeOther ?? this.bankTypeOther,
      phone1: phone1 ?? this.phone1,
      phone2: phone2 ?? this.phone2,
      nationalId: nationalId ?? this.nationalId,
      passportId: passportId ?? this.passportId,
      accountNumber: accountNumber ?? this.accountNumber,
      iban: iban ?? this.iban,
      amount: amount ?? this.amount,
      currency: currency ?? this.currency,
      purchasedBy: purchasedBy ?? this.purchasedBy,
      paymentType: paymentType ?? this.paymentType,
      cardBooked: cardBooked ?? this.cardBooked,
      bookingDate: bookingDate ?? this.bookingDate,
      pinCode: pinCode ?? this.pinCode,
      soldTo: soldTo ?? this.soldTo,
      isSold: isSold ?? this.isSold,
      notes: notes ?? this.notes,
      uid: uid,
      createdBy: createdBy,
      createdAt: createdAt,
      updatedBy: updatedBy,
      updatedAt: updatedAt,
    );
  }
}
