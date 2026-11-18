# Quiz-In: Project Handoff & Roadmap

> Paste this whole file at the start of a new chat and say: "Continue Quiz-In from this plan, start at the first unchecked item."
> Repo: https://github.com/BarathKD/Quiz-In-app (owner: Barath, fresher .NET developer, India)

## Goal
Ship Quiz-In on the Google Play Store with:
- Real backend (user login + data stored on server)
- Ads (AdMob)
- Paid levels / difficulty (Google Play Billing), all controlled from the Admin panel

## Current state (as of 2026-11-18, code review of `main`)
- React Native 0.81 + Expo SDK 54, React Navigation (native-stack). `expo-router` is installed but unused.
- Storage: everything in AsyncStorage (`utils/storage.js`): users, questions, categories, progress, session. No backend.
- Flow: Splash -> Login -> Categories -> Subcategories -> Subjects -> Difficulty -> Levels (50 questions each) -> Quiz -> QuizSummary. Admin screen manages categories, questions (CSV/JSON import), images, timers.
- Android package: `com.barath78.Quizin`. EAS project id already in `app.json`; `eas.json` has `preview` (apk) and `production`.

## Known problems to fix first (Phase 1)
- [x] Remove hardcoded admin (`admin@quiz.com` / `admin123`), the "Login as Admin" and "Login as Student" demo buttons, and mock Google login in `screens/LoginScreen.js` and `utils/storage.js`.
- [x] Levels vs Quiz question-count mismatch: `LevelsScreen` passes `subject || undefined` to `getQuestionsByFilter`, `QuizScreen` filters strictly to no-subject. Make both use the same filter.
- [x] `QuizSummaryScreen` retry / next-difficulty does not pass `levelStart`, `levelEnd`, `levelNumber`; next difficulty skips the Levels screen.
- [x] Progress is stored per difficulty, not per level (`updateUserProgress` key has no level). Passing Level 1 marks the whole difficulty complete.
- [x] Pass rule: a wrong answer restarts the quiz, so the 70% pass logic is dead code; summary tip says "5 minutes per question" but timer is per quiz. Decide the rule and make text match.
- [x] `handleTimeout` is called inside a `setTimeLeft` updater (side effect in updater). Move it to an effect.
- [x] CSV import: naive `split('\n')`, no escaped quotes, no multi-line fields.
- [x] Delete dead code: `LogicScreen.js`, `ClassesScreen.js`, `BoardsScreen.js`, `utils/sampleData.json`, duplicate `eslint.config.mjs` (done). Still open: remove unused `expo-router` dependency (needs `npm uninstall` + lockfile check).

## How to verify Phase 1 is really done (manual test on phone)
Run: `git pull`, `npm install`, `npx expo start -c`, open in Expo Go.
- [ ] Login screen has only Email, Password, Login, Sign up. No Admin / Student / Google buttons.
- [ ] Sign up with a new email (6+ chars password), then Login works. Wrong password is rejected.
- [ ] Dev admin login works in Expo Go: `admin@quiz.com` / `admin123` (dev mode only).
- [ ] As admin, import a CSV with a comma and a quote inside a question; it imports correctly.
- [ ] Add 60+ easy questions to one subcategory. Levels screen shows 2 levels; the count matches the questions that appear in the quiz.
- [ ] As a normal user: Level 2 is locked (lock icon) until Level 1 is passed.
- [ ] Answer every question correctly in Level 1 -> summary shows PASSED + "Next Level (2)". Tap it: Level 2 starts.
- [ ] Answer one wrong -> quiz restarts. Try Again on summary reopens the SAME level.
- [ ] Pass all levels of Easy -> "Try Medium" appears and Medium unlocks. Before that, Medium stays locked.
- [ ] Let the timer reach 0 -> "Time's Up" alert appears once, View Results works.
- [ ] Close and reopen the app: you stay logged in; Logout returns to Login.

## Roadmap

### Phase 1: Clean and stabilise the app (no new features)
- [x] Fix every item in the list above
- [x] Add a single `api` layer (`utils/api.js`) so screens never call AsyncStorage directly (makes Phase 2 a swap, not a rewrite)

### Phase 2: Backend (ASP.NET Core Web API + EF Core + PostgreSQL or SQL Server)
- [ ] Create `QuizIn.Api` project in a separate repo (or `/backend` folder)
- [ ] Entities: User, Category, Subcategory, Subject, Question, Level/Difficulty, Progress, Purchase, AdConfig
- [ ] Auth: register/login, password hashing (ASP.NET Identity or BCrypt), JWT + refresh token, roles (Admin / User)
- [ ] Endpoints: categories tree, questions by level, submit result, user progress, admin CRUD, CSV/JSON import
- [ ] Deploy to a free/cheap host (Azure App Service, Render or Railway) + managed DB; HTTPS only
- [ ] Mobile app: login/signup against the API, store JWT in `expo-secure-store`, load data from API (cache offline)

### Phase 3: Paid levels / difficulty
- [ ] Use Google Play Billing (required by Play policy for digital content, not Razorpay/UPI inside the app). Library: `react-native-iap` or RevenueCat
- [ ] Admin panel: per category / subcategory / subject / difficulty / level -> `isPaid`, `price tier` (Play product id), `free preview count`
- [ ] Backend: verify purchase tokens with the Google Play Developer API, store `Purchase`, return `unlocked` flags per user
- [ ] App: lock icon + paywall screen, restore purchases
- [ ] Needs a dev build (EAS), will not work in Expo Go

### Phase 4: Ads
- [ ] AdMob account + app id; library `react-native-google-mobile-ads` (EAS dev build required)
- [ ] Banner on Categories/Levels, interstitial after quiz summary (frequency-capped), optional rewarded ad "unlock one level"
- [ ] Admin panel toggles: ads on/off, interstitial frequency, which screens
- [ ] Paid users: no ads (optional, decide)
- [ ] Use Google test ad IDs until the app is approved

### Phase 5: Play Store release
- [ ] Google Play Developer account (one-time fee, done by Barath)
- [ ] App icon, feature graphic, screenshots, short/long description
- [ ] Privacy policy URL (required: ads + accounts + purchases), Data safety form, content rating
- [ ] Account deletion option (Play policy for apps with accounts)
- [ ] `eas build -p android --profile production` (AAB), upload to Internal testing -> Closed testing (new personal accounts must run a closed test with testers before production) -> Production
- [ ] Remove all `console.log` debug output, set versionCode via `autoIncrement`

## Things only Barath can do (I cannot do these)
- Create Google Play Developer account, AdMob account, Play Console in-app products / merchant profile
- Connect GitHub to Claude with push access so changes can be committed directly
- Choose backend host and pay for it if not free tier
- Run `eas login` / `eas build` on his machine, test on a real phone

## Decisions log
- Backend stack: ASP.NET Core (chosen so the project also strengthens his .NET portfolio). Change only if Barath says otherwise.
- Payments: Google Play Billing only.
- (add new decisions here)

## Progress log
- 2026-11-18: Code review done, roadmap written.
- 2026-11-18: Phase 1 done. Auth: no hardcoded admin / demo buttons / mock Google; passwords salted-SHA-256 hashed (stop-gap until backend); session no longer stores secrets; legacy plain-text accounts upgrade on login. Dev-only test admin `admin@quiz.com` / `admin123` exists ONLY when `__DEV__` (Expo Go / dev build), never in release builds, so the Admin panel cannot be opened in a release APK until the Phase 2 backend has real admin login.
  Levels: Levels and Quiz now use the same question filter; levels unlock one after another; progress is stored per level (`markLevelPassed`), a difficulty completes only when all its levels are passed; summary has Next Level / Try Again (same level) / next difficulty (via Levels screen). A level is passed only when every question is correct (wrong answer restarts).
  Also: timeout handled in an effect (not in a state updater), proper CSV parser, all screens import from `utils/api.js`. Checks: eslint 0 errors, `expo export --platform android` bundles OK, CSV parser tested. NOT tested on a real device.
- NEXT: Phase 2 (backend). Start with the data model + auth endpoints, then swap `utils/api.js` to call them.
