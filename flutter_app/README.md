# إدارة بطاقاتك — Flutter

نسخة Flutter من تطبيق إدارة بطاقاتك، تشارك نفس مشروع Firebase (`agwida-39e21`)
المستخدم في نسخة الويب و React Native.

- **Package name (Android):** `com.agwida.bankingapp` (نفس المعرّف المحجوز في Google Play)
- **Firebase project:** `agwida-39e21`

## البدء على جهازك (Windows + Android Studio)

1. افتح هذا المجلد (`flutter_app`) كمشروع في Android Studio.
2. تأكد من ضبط **Flutter SDK path** و**Dart SDK path** في Settings → Languages & Frameworks.
3. شغّل جهاز/محاكي، ثم `Shift+F10` أو:
   ```
   flutter run
   ```

## الحالة الحالية

- ✅ تسجيل الدخول / إنشاء حساب / نسيت كلمة المرور (`AuthScreen`)
- ✅ تفعيل الاشتراك بالكود + نظام الإحالة (بونص شهر مجاني) (`ActivationScreen`)
- ✅ الشاشة الرئيسية: إدارة العملاء الكاملة (إضافة/تعديل/حذف/بحث/فلترة/فرز)، تعديل الملاحظات مباشرة، تصدير CSV (`HomeScreen`)
- ✅ تبويب الإحصائيات (إجمالي، محجوز، معلّق، مباع، المبالغ)
- ✅ لوحة الأدمن: إدارة الاشتراكات (إنشاء/تجديد/حذف/إعادة ضبط الأجهزة)، المسوّقون والعمولات، تغيير كلمة المرور (`AdminScreen`)
- ✅ **قسم المصروفات (جديد، غير موجود في نسخة الويب/React Native):** تسجيل حركات مالية (مصروف/دخل) مع الفئة، الشخص المرتبط بالحركة (من أُعطي/من أُخذ منه)، ملاحظة، تاريخ، وإحصائيات إجمالي المصروفات/الدخل/الصافي (`ExpensesScreen`)
- ✅ حد 7 أجهزة لكل اشتراك + شاشة تجاوز الحد
- ✅ وضع فاتح/غامق مع الحفظ التلقائي
- ✅ `flutter analyze` و `flutter test` ناجحان بدون أخطاء

## ⚠️ خطوة مطلوبة: قواعد Firestore الأمنية

قسم المصروفات الجديد يستخدم مجموعة Firestore جديدة اسمها `expenses`. يجب إضافة هذه القاعدة
في [Firebase Console](https://console.firebase.google.com/project/agwida-39e21/firestore/rules)
(نفس مكان القواعد الحالية لمجموعة `clients`):

```javascript
match /expenses/{docId} {
  allow read, update, delete: if request.auth != null &&
    request.auth.uid == resource.data.uid;
  allow create: if request.auth != null &&
    request.auth.uid == request.resource.data.uid;
}
```

بدون هذه القاعدة، قسم المصروفات لن يعمل (ستظهر رسالة "permission-denied").

## معلقة / لم تُبنَ بعد

- ⏳ تصدير PDF (تصدير CSV متوفر الآن كبديل يعمل بنفس الغرض عبر خاصية المشاركة)
