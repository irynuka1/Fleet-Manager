---
name: Mobile App Production Cleanup
overview: Upgrade the Expo mobile app from SDK 52 to SDK 54 (latest stable) so it works with the current Expo Go without installing a specific SDK, and perform a production-quality code cleanup across all mobile source files -- fixing bugs, removing hardcoded values, improving type safety, and tightening patterns.
todos:
  - id: expo-upgrade
    content: "Upgrade Expo SDK 52 -> 54: bump deps in package.json, run npx expo install --fix, update app config"
    status: completed
  - id: app-config-ts
    content: Convert app.json to app.config.ts with env-based API_URL via expo-constants
    status: completed
  - id: metro-simplify
    content: Simplify metro.config.js blockList (remove react entry since both apps now use React 19.x)
    status: completed
  - id: fix-api-ts
    content: "Fix api.ts: env-based URL, auth state desync on refresh failure, typed interceptor"
    status: completed
  - id: fix-auth-store
    content: Add clearAuth action to auth.store.ts for use by the API interceptor
    status: completed
  - id: fix-app-tsx
    content: "App.tsx: import colors, use safe area insets, wire alert navigation callback"
    status: completed
  - id: fix-screens
    content: "Fix screens: stale closure bug, type safety (AxiosError, typed params), error logging"
    status: completed
  - id: root-cleanup
    content: "Root package.json: add mobile script, remove empty tools workspace"
    status: completed
isProject: false
---

# Mobile App: Expo Upgrade + Production Code Cleanup

## Part 1: Expo SDK 54 Upgrade (version-agnostic Expo Go)

**Problem:** The app runs Expo SDK 52 (`expo ~52.0.0`, React 18.3, RN 0.76.9). Expo Go on the device always ships the latest SDK (currently 54). SDK mismatch forces installing old Expo Go APKs manually.

**Solution:** Upgrade to SDK 54 (React 19.1, RN 0.81). After upgrading, the app will always work with the latest Expo Go. When a new SDK drops in the future, the upgrade is a single `npx expo install expo@latest --fix` command.

**Note:** SDK 54 is the last version supporting the Old Architecture, so `newArchEnabled` should be set to `true` now to prepare for the future.

### Changes

- **[apps/mobile/package.json](apps/mobile/package.json):** Bump `expo` to `~54.0.0`, `react` to `19.1.0`, `react-native` to `0.81.x`, and all Expo satellite packages (`expo-status-bar`, `expo-secure-store`, `expo-asset`, `@expo/vector-icons`, `react-native-safe-area-context`, `react-native-screens`) to SDK 54-compatible versions. Remove `react-native-screens` entirely since it is unused in source. Update `@types/react` and `typescript` devDeps. Run `npx expo install --fix` after initial bump.
- **[apps/mobile/app.json](apps/mobile/app.json):** Set `"newArchEnabled": true` (recommended; SDK 54 is the last to support Old Arch).
- **[apps/mobile/metro.config.js](apps/mobile/metro.config.js):** Simplify the `blockList`. After the upgrade, both mobile and web use React 19 so the `react` blockList entry can be removed. Keep only the `react-native` entry (web uses RN 0.85 for react-native-web, mobile uses RN 0.81).
- **[apps/mobile/tsconfig.json](apps/mobile/tsconfig.json):** Keep as-is; `expo/tsconfig.base` will update via the new `expo` package.
- Run `npx expo-doctor` in `apps/mobile` to verify compatibility.

---

## Part 2: Production Code Cleanup

### 2a. Environment-based API URL ([apps/mobile/src/lib/api.ts](apps/mobile/src/lib/api.ts))

**Problem:** API URL is hardcoded to a LAN IP (`http://10.49.224.161:3001/api`).

**Fix:** Convert [apps/mobile/app.json](apps/mobile/app.json) to [apps/mobile/app.config.ts](apps/mobile/app.config.ts) and expose `API_URL` via `expo.extra`. Read it in `api.ts` using `expo-constants`. Provide a sensible default and document `.env` usage.

```typescript
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:3001/api';
```

### 2b. Fix auth state desync bug ([apps/mobile/src/lib/api.ts](apps/mobile/src/lib/api.ts))

**Problem:** When the 401 interceptor's refresh fails, it clears SecureStore tokens but does NOT reset Zustand auth state. The app continues to show `MainApp` until the next restart.

**Fix:** Import `useAuthStore` in the interceptor and call `getState().logout()` (or a lightweight `clearAuth` action) on refresh failure, so the UI immediately returns to LoginScreen.

### 2c. Fix stale closure bug ([apps/mobile/src/screens/NotificationsScreen.tsx](apps/mobile/src/screens/NotificationsScreen.tsx))

**Problem:** `fetchNotifications` captures `notifications` in its closure but only has `[filter]` in the dependency array. On page 2+, it may append using a stale `notifications` array.

**Fix:** Use functional state update:

```typescript
setNotifications(prev => p === 1 ? data.data : [...prev, ...data.data]);
```

### 2d. Use colors consistently ([apps/mobile/App.tsx](apps/mobile/App.tsx))

**Problem:** `App.tsx` hardcodes hex values (`#0d9488`, `#94a3b8`, `#f8fafc`) instead of importing from `src/lib/colors`.

**Fix:** Import `colors` and replace all literal hex values in `App.tsx` styles and JSX with the centralized tokens.

### 2e. Proper safe area handling ([apps/mobile/App.tsx](apps/mobile/App.tsx))

**Problem:** `MainApp` uses `paddingTop: 50` which is wrong on devices with notches, dynamic island, or different status bar heights.

**Fix:** Use `useSafeAreaInsets()` from `react-native-safe-area-context` to compute correct padding dynamically.

### 2f. Type safety improvements

- **[apps/mobile/src/screens/NotificationsScreen.tsx](apps/mobile/src/screens/NotificationsScreen.tsx):** Replace `params: any` with a proper typed object.
- **[apps/mobile/src/screens/LoginScreen.tsx](apps/mobile/src/screens/LoginScreen.tsx):** Replace `catch (err: any)` with `AxiosError` type guard using `axios.isAxiosError(err)`.
- **[apps/mobile/src/lib/api.ts](apps/mobile/src/lib/api.ts):** Type the interceptor's `originalRequest` properly (extend `InternalAxiosRequestConfig`).

### 2g. Wire alert card navigation ([apps/mobile/App.tsx](apps/mobile/App.tsx) + [apps/mobile/src/screens/DashboardScreen.tsx](apps/mobile/src/screens/DashboardScreen.tsx))

**Problem:** The alert `TouchableOpacity` on the dashboard has a chevron but no `onPress` -- tapping does nothing.

**Fix:** Accept an `onNavigateToNotifications` callback prop in `DashboardScreen` and pass `setActiveTab('notifications')` from `MainApp`.

### 2h. Improve error handling

**Problem:** Multiple `catch {}` blocks silently swallow errors, making debugging impossible.

**Fix:** Add `console.warn` calls in catch blocks for non-user-facing operations (dashboard fetch, mark-as-read) so errors appear in dev logs. Keep user-facing error messages as-is.

### 2i. Root package.json cleanup ([package.json](package.json))

- Add `"mobile": "npm run start -w apps/mobile"` script for consistency with `api` and `web`.
- Remove `"tools/*"` from workspaces since the directory is empty.

---

## Summary of files touched


| File                                              | Change                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/mobile/package.json`                        | SDK 54 deps, remove unused `react-native-screens`, add `expo-constants` |
| `apps/mobile/app.json` -> `app.config.ts`         | Convert to TS config, add `extra.apiUrl`, enable new arch               |
| `apps/mobile/metro.config.js`                     | Simplify blockList (remove react entry)                                 |
| `apps/mobile/App.tsx`                             | Use colors, safe area insets, wire alert navigation                     |
| `apps/mobile/src/lib/api.ts`                      | Env-based URL, fix auth desync, type interceptor                        |
| `apps/mobile/src/stores/auth.store.ts`            | Add `clearAuth` action for interceptor use                              |
| `apps/mobile/src/screens/LoginScreen.tsx`         | Type-safe error handling                                                |
| `apps/mobile/src/screens/DashboardScreen.tsx`     | Accept nav callback, log errors                                         |
| `apps/mobile/src/screens/NotificationsScreen.tsx` | Fix stale closure, type params, log errors                              |
| `package.json` (root)                             | Add mobile script, remove tools workspace                               |


