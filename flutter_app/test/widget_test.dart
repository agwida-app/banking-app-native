import 'package:flutter_test/flutter_test.dart';

import 'package:banking_app/main.dart';

void main() {
  testWidgets('Login screen renders', (WidgetTester tester) async {
    await tester.pumpWidget(const BankingApp());

    expect(find.text('إدارة بطاقاتك'), findsOneWidget);
    expect(find.text('تسجيل الدخول'), findsOneWidget);
  });
}
