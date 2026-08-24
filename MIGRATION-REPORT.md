# Migration Report: hemu-app

This report documents the migration of the Cricket Academy Manager application from the original `cricket` repository into the new dedicated Android/Capacitor repository, `hemu-app`.

---

## 1. Files Copied

All required React 19, TypeScript, Vite, Tailwind CSS, and Capacitor application files have been migrated:
*   **Source Code**: `src/` (retains the full Feature-Sliced design architecture: `app/`, `components/`, `features/`, `pages/`, `lib/`, `stores/`, `hooks/`, `types/`, `assets/`).
*   **Public Assets**: `public/`.
*   **Supabase Configs**: `supabase/` (PostgreSQL schemas, seed sql, migrations, and local tests).
*   **Documentation**: `docs/` (retains core architecture guidelines and DB schemas).
*   **Build Scripts**: `scripts/`.
*   **Capacitor Native Scaffold**: `android/` (native project scaffold for Android).
*   **Configuration Files**: 
    - `capacitor.config.ts`
    - `package.json`
    - `package-lock.json`
    - `vite.config.ts`
    - `tsconfig.json`
    - `tsconfig.app.json`
    - `tsconfig.node.json`
    - `index.html`
    - `eslint.config.js`
    - `.gitignore`
    - `.prettierignore`
    - `.prettierrc.json`
    - `.nvmrc`

---

## 2. Files Intentionally Not Copied

Obsolete, experimental, and large temporary folders/files were excluded to preserve repository hygiene:
*   `node_modules/` (re-installed cleanly).
*   `dist/` and build outputs (re-compiled cleanly).
*   `.git/` from the original repository (preserved the new repository's target `.git` history).
*   `player-dashboard-refresh/` (legacy developer sandbox).
*   `test-results/` and `coverage/` (vitest artifacts).
*   `.env` and `.env.local` containing local developer credentials (clean `.env.example` provided).
*   `cricket_academy_flutter/` (the paused Flutter experiment, removed to ensure `hemu-app` stays purely Capacitor/Android).

---

## 3. Files Modified

No application code or feature functionality was modified during this migration. Only configuration alignment was verified:
*   Added `.env` containing publishable anon keys for compilation and build-time parsing.
*   Preserved `capacitor.config.ts` targeting app ID `com.hemu.cricketacademy`.

---

## 4. Capacitor Configuration

*   **Application ID**: `com.hemu.cricketacademy` (Preserved in full).
*   **App Name**: `Cricket Academy` (Preserved in full).
*   **Plugins**: Synchronized native dependencies:
    - `@capacitor/app`
    - `@capacitor/browser`
    - `@capacitor/camera`

---

## 5. Supabase Integration Preserved

*   **Client Configuration**: [`client.ts`](file:///c:/Users/SELVI/OneDrive/Desktop/New%20folder/hemu-app/src/lib/supabase/client.ts) and automatic IP resolving for local development remain fully active.
*   **Models & Database Types**: Generated database schemas in [`database.types.ts`](file:///c:/Users/SELVI/OneDrive/Desktop/New%20folder/hemu-app/src/lib/supabase/database.types.ts) are preserved.
*   **API & Core Hooks**: Async fetch wrappers and query actions are fully intact.

---

## 6. Offline Functionality Preserved

*   **IndexedDB Sync Queue**: Persists offline attendance updates via [`indexedDb.ts`](file:///c:/Users/SELVI/OneDrive/Desktop/New%20folder/hemu-app/src/lib/offline/indexedDb.ts).
*   **Query Cache Persistence**: Automatically dehydrates and hydrates the TanStack Query cache in client storage.
*   **PWA Cache**: precaches assets locally via Service Worker.

---

## 7. Environment Variables Required

Refer to `.env.example`. The following client-facing keys must be set:
*   `VITE_SUPABASE_URL`: Target Supabase instance URL.
*   `VITE_SUPABASE_ANON_KEY`: Publishable Client Key.
*   `VITE_APP_NAME`: `Cricket Academy Manager`.
*   `VITE_APP_URL`: App web URL.
*   `VITE_DEFAULT_TIMEZONE`: `Asia/Kolkata`.

---

## 8. Verification Status

*   **Dependency Setup (`npm install`)**:  ✅ **SUCCESS** (Exit code `0`).
*   **Typecheck (`npm run typecheck`)**: ✅ **SUCCESS** (Exit code `0`).
*   **Linter (`npm run lint`)**:  ✅ **SUCCESS** (Exit code `0`).
*   **Vite Production Build (`npm run build`)**: ✅ **SUCCESS** (Exit code `0`).
*   **Capacitor Sync (`npx cap sync`)**: ✅ **SUCCESS** (Exit code `0`).
*   **Capacitor Doctor (`npx cap doctor`)**: ✅ **SUCCESS** (Android configured correctly; reports "Android looking great! 👌").
*   **Vitest Unit Tests (`npm run test`)**: ✅ **SUCCESS** (Exit code `0`, all 338 tests passing across 54 test suites).


---

## 9. Android Build Status & Issues

*   **Gradle Build Compilation**: ✅ **SUCCESS** (Exit code `0`).
*   **JDK Environment**: Microsoft Build of OpenJDK 21 (`jdk-21.0.12.101-hotspot`) installed via `winget` and configured dynamically as `JAVA_HOME`.
*   **Compilation Command**: `.\gradlew assembleDebug` (Completed successfully in 4m 10s).

---

## 10. Functional Smoke Test Status & Blocks

*   **AVD Emulator Execution**: ⚠️ **BLOCKED**
*   **Blocking Issues**:
    1.  **Missing command-line SDK tools**: Android SDK Command-line Tools (`cmdline-tools`) is not installed under the Android SDK folder (`C:\Users\SELVI\AppData\Local\Android\Sdk`), which means `sdkmanager` is not available to retrieve images or build AVDs from the command line.
    2.  **RAM resource limitations**: The host machine has only **3.2 GB of available physical memory** free out of 16 GB. Launching a standard Android Virtual Device requires a minimum of 2-3 GB of dedicated memory, which would lead to host OOM lockups or severe VM page swapping.
    3.  **No connected physical devices**: `adb devices` lists no connected debugging hardware.


