# Android Release Checklist 📱

This guide covers the end-to-end process of preparing, compiling, signing, and deploying the **GameHub** Android app using Capacitor and Android Studio.

---

## 1. Keystore Generation 🔑
To sign your application for production, you must generate a secure release keystore.
Run the following command in a terminal (replace placeholders with your secure credentials):

```bash
keytool -genkey -v -keystore gamehub-release.keystore -alias gamehub-alias -keyalg RSA -keysize 2048 -validity 10000
```

### Best Practices:
* **Keep Keystore Safe**: Never commit your `.keystore` file to Git. Store it in a secure password manager.
* **Record Passwords**: Store the keystore password and alias key password securely. If you lose these, you will not be able to update your app on the Google Play Store.

---

## 2. Compile and Sync Capacitor Web Assets 🔄
Before compiling the Android binaries, ensure the web app is built and synced to the Android platform:

```bash
# 1. Build the production Next.js build
npm run build

# 2. Sync files into the native Android folder
npx cap sync android
```

---

## 3. Build APK (for Local Testing/QA) 📦
An APK (Android Package) is useful for sideloading and testing on physical devices before publishing.

### Option A: Using Command Line (Gradle Wrapper)
Navigate to the `android/` directory and run:
```bash
cd android
./gradlew assembleRelease
```
The unsigned APK will be located at:
`android/app/build/outputs/apk/release/app-release-unsigned.apk`

### Option B: Using Android Studio
1. Open the `/android` folder in Android Studio.
2. Select **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. Once completed, a popup will locate the compiled APK.

---

## 4. Build AAB (for Play Store Production) 📦
An AAB (Android App Bundle) is the required format for publishing apps to Google Play. It allows Google Play to generate optimized APKs tailored to each user's device configuration.

### Option A: Using Command Line (Gradle Wrapper)
Navigate to the `android/` directory and run:
```bash
cd android
./gradlew bundleRelease
```
The unsigned App Bundle will be located at:
`android/app/build/outputs/bundle/release/app-release-unsigned.aab`

### Option B: Using Android Studio
1. Open the `/android` folder in Android Studio.
2. Select **Build** > **Build Bundle(s) / APK(s)** > **Build Bundle(s)**.

---

## 5. Signing Process (Signing the Binaries) ✍️
Unsigned APKs/AABs cannot be installed on user devices or uploaded to Google Play. You must sign them with your keystore.

### Option A: Command Line Signing (using apksigner / jarsigner)
To sign an AAB:
```bash
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore gamehub-release.keystore android/app/build/outputs/bundle/release/app-release-unsigned.aab gamehub-alias
```

To sign an APK:
1. Align the APK first (recommended):
   ```bash
   zipalign -v 4 android/app/build/outputs/apk/release/app-release-unsigned.apk gamehub-release-aligned.apk
   ```
2. Sign the aligned APK with `apksigner`:
   ```bash
   apksigner sign --ks gamehub-release.keystore --ks-key-alias gamehub-alias gamehub-release-aligned.apk
   ```

### Option B: Configure Auto-Signing in Gradle (Recommended)
You can configure Gradle to sign your app automatically during compilation.
Add the following to `android/app/build.gradle` inside the `android` block (use environment variables for security):

```groovy
signingConfigs {
    release {
        storeFile file(System.getenv("RELEASE_STORE_FILE") ?: "gamehub-release.keystore")
        storePassword System.getenv("RELEASE_STORE_PASSWORD")
        keyAlias System.getenv("RELEASE_KEY_ALIAS")
        keyPassword System.getenv("RELEASE_KEY_PASSWORD")
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

---

## 6. Google Play Store Deployment Readiness 🚀
Before uploading the signed AAB to Google Play Console:

1. **Verify Package Name**: Check that the `applicationId` in `android/app/build.gradle` matches your registered Play Store package name (e.g. `com.gamehub.app`).
2. **Version Codes**: Increment `versionCode` (integer) and `versionName` (string) in `android/app/build.gradle` for every new release.
3. **App Icons & Splash Screens**: Verify that all standard resolutions of app icon (`mipmap`) and splash screens are updated inside `android/app/src/main/res/`.
4. **Internet Permissions**: Ensure `AndroidManifest.xml` includes `<uses-permission android:name="android.permission.INTERNET" />` so it can contact the remote DB/Sockets.
5. **Assets Clearance**: Remove any diagnostic code or console logging that leaks credentials or user data in production.
