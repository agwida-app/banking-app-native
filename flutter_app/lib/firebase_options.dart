// File generated manually from the Firebase console config for the
// agwida-39e21 project (Android app: com.agwida.bankingapp).
// Regenerate with `flutterfire configure` if iOS/web support is added.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'DefaultFirebaseOptions have not been configured for web - '
        'run `flutterfire configure` to add web support.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for iOS - '
          'run `flutterfire configure` to add iOS support.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCYwCdxIRV5qvSjiJab9xRLeNdRY8AT-Tw',
    appId: '1:464547131895:android:511e01873c0e59c1003ef2',
    messagingSenderId: '464547131895',
    projectId: 'agwida-39e21',
    storageBucket: 'agwida-39e21.firebasestorage.app',
  );
}
