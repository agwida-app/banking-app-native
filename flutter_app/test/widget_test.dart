import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:banking_app/screens/auth_screen.dart';
import 'package:banking_app/theme/app_theme.dart';

void main() {
  testWidgets('Login screen renders', (WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => ThemeController(),
        child: const MaterialApp(
          home: Directionality(textDirection: TextDirection.rtl, child: AuthScreen()),
        ),
      ),
    );

    expect(find.text('إدارة بطاقاتك'), findsOneWidget);
    expect(find.text('تسجيل الدخول'), findsWidgets);
  });
}
