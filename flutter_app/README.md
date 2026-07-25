# إدارة بطاقاتك — Flutter

نسخة Flutter من تطبيق إدارة بطاقاتك، تشارك نفس مشروع Firebase (`agwida-39e21`)
المستخدم في نسخة الويب و React Native.

- **Package name (Android):** `com.agwida.bankingapp` (نفس المعرّف المحجوز في Google Play)
- **Firebase project:** `agwida-39e21`

## البدء على جهازك (Windows + Android Studio)

1. ثبّت [Flutter SDK](https://docs.flutter.dev/get-started/install/windows) وشغّل `flutter doctor` للتأكد من جاهزية Android toolchain.
2. من هذا المجلد:
   ```
   flutter pub get
   ```
3. ولّد إعدادات Firebase الخاصة بالمنصّات (Android/iOS) — يحتاج تسجيل دخول Firebase من جهازك:
   ```
   dart pub global activate flutterfire_cli
   flutterfire configure --project=agwida-39e21
   ```
   هذا يولّد `lib/firebase_options.dart` تلقائياً بمفاتيح خاصة بكل منصّة.
4. في `lib/main.dart`، فعّل التهيئة في أول `main()`:
   ```dart
   WidgetsFlutterBinding.ensureInitialized();
   await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
   ```
5. شغّل التطبيق:
   ```
   flutter run
   ```

## الحالة الحالية

- ✅ هيكل مشروع Flutter قياسي (`flutter create`)
- ✅ حزم Firebase مضافة إلى `pubspec.yaml`: `firebase_core`, `firebase_auth`, `cloud_firestore`
- ✅ شاشة تسجيل دخول أولية (`lib/main.dart`) بواجهة عربية RTL ونفس ألوان الهوية البصرية
- ⏳ ربط Firebase فعلياً (يتطلب `flutterfire configure` من جهازك)
- ⏳ باقي الشاشات (الرئيسية، التفعيل، لوحة الأدمن) — نُبنى تباعاً بنفس منطق نسخة React Native
