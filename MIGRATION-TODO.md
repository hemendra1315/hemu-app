# Migration TODO: hemu-app

The following tasks are recommended to make the local native Android build environment fully operational and equivalent to a production release build:

- [x] **Configure JDK (Java Development Kit)**:
  - Install JDK 21 on the local machine (Microsoft OpenJDK 21 successfully installed).
  - Set the `JAVA_HOME` environment variable to point to the JDK path (`C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`).
  - Add the Java `bin/` directory to the system `PATH` (Verified with `java -version`).
- [x] **Verify Android Compilation**:
  - Run `.\gradlew assembleDebug` inside the `android/` directory of `hemu-app` to confirm compilation success (Verified: Build Successful in 4m 10s).
- [x] **Configure Android SDK Tools**:
  - Ensure the local `local.properties` file in `android/` points to the correct location of the Android SDK if building from the CLI (Verified: Created local.properties pointing to C:\Users\SELVI\AppData\Local\Android\Sdk).
- [x] **Persistent Environment Variables**:
  - Persistently write `JAVA_HOME` into the Windows System Environment Variables so that IDEs (Android Studio / VS Code) can resolve it by default (Verified: Configured User environment variable JAVA_HOME pointing to Microsoft OpenJDK 21).
- [x] **Install Android SDK Command-line Tools**:
  - Open Android Studio SDK Manager, go to SDK Tools, and check "Android SDK Command-line Tools (latest)" to install `sdkmanager` (Verified: Downloaded, configured, and tested version 11076708 successfully in Sdk/cmdline-tools/latest).
- [ ] **Setup and Run AVD Emulator**:
  - Download a system image (e.g. API 34/35) and create an AVD using Android Studio AVD Manager.
  - Open the emulator and verify that the app installs and runs correctly via `npx cap run android`.


