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

### Phase 1B: New look + local-only pages (no backend needed, works now)
- [x] Redesign: "Mayil" peacock palette (no yellow/red brand colors), Tamil-first + English, animations (branch merged to main)
- [x] Leaderboard tab (points = passed levels x 50 x difficulty weight; this device's accounts only)
- [x] Settings page: language, privacy policy link, about/version, logout, delete account (local data wipe now; server delete in Phase 2). Sound toggle dropped: the app has no sounds yet. Privacy URL is set in `utils/config.js`. Play Console target audience: choose 13+ (avoid Families Policy).
- [x] Wrong-answers review + Bookmarks (star in quiz, lists under Profile): save missed/starred questions per user, "practice my mistakes" quiz
- [x] Daily Challenge (same 10 questions for everyone each day, 10 min timer, streak counts only if all answered): 10 random questions per day, streak counter, "done today" state (streak stored locally for now)
- [x] Achievements / Badges (8 badges): first level, 7-day streak, category master, 100 correct. Computed from progress, shown on Profile
- [x] Restyle AdminScreen + components/admin to the Mayil theme

### Phase 2: Backend (ASP.NET Core Web API + EF Core + PostgreSQL or SQL Server)
- [x] Create `QuizIn.Api` project in `/backend/QuizIn.Api` (written, NOT yet compiled: no .NET SDK in Claude's sandbox; build it in Codespaces with `dotnet build` and report errors)
- [x] Entities (written): User, Category, Subcategory, Subject, Question, Level/Difficulty, Progress, Purchase, AdConfig
- [~] Auth: register/login/me/delete-account done (BCrypt, JWT 7 days, Admin role, first admin from config). Refresh token still TODO
- [~] Endpoints: DONE (written, being tested): GET categories, GET questions (filters), admin CRUD for categories/subcategories/subjects/questions, CSV import. TODO: submit result, user progress, daily, bookmarks, mistakes, leaderboard, JSON import, bulk delete, images
- [ ] Deploy to a free/cheap host (Azure App Service, Render or Railway) + managed DB; HTTPS only
- [ ] Global leaderboard on the server: weekly + all-time tabs, anti-cheat (server computes points from submitted results)
- [ ] Move Daily Challenge streak, badges, bookmarks and wrong-answers to the server (sync across devices)
- [ ] Settings: real "delete my account" endpoint (Play policy)
- [~] Web admin panel (ASP.NET Core MVC, inside QuizIn.Api): v1 written = Dashboard, Content, Questions CRUD, CSV import. TODO: Users page, Leaderboard control, Tamil + English fields, bulk delete, images
- [ ] Mobile app: login/signup against the API, store JWT in `expo-secure-store`, load data from API (cache offline)

### Phase 3: Paid levels / difficulty
- [ ] Use Google Play Billing (required by Play policy for digital content, not Razorpay/UPI inside the app). Library: `react-native-iap` or RevenueCat
- [ ] Admin panel: per category / subcategory / subject / difficulty / level -> `isPaid`, `price tier` (Play product id), `free preview count`
- [ ] Backend: verify purchase tokens with the Google Play Developer API, store `Purchase`, return `unlocked` flags per user
- [ ] App: lock icon + paywall screen, restore purchases
- [ ] Store / Premium page: unlock levels, remove ads, purchase history, restore purchases
- [ ] Admin: Paid content manager + purchases list
- [ ] Needs a dev build (EAS), will not work in Expo Go

### Phase 4: Ads
- [ ] AdMob account + app id; library `react-native-google-mobile-ads` (EAS dev build required)
- [ ] Banner on Categories/Levels, interstitial after quiz summary (frequency-capped), optional rewarded ad "unlock one level"
- [ ] Admin panel Ads control: ads on/off, interstitial frequency, which screens
- [ ] Paid users: no ads (optional, decide)
- [ ] Use Google test ad IDs until the app is approved
- [ ] Rewarded ad: watch to unlock one level or get a hint (appears on Store page too)

### Phase 5: Play Store release
- [ ] Google Play Developer account (one-time fee, done by Barath)
- [ ] App icon, feature graphic, screenshots, short/long description
- [ ] Privacy policy URL (required: ads + accounts + purchases), Data safety form, content rating
- [ ] Account deletion option (Play policy for apps with accounts)
- [ ] `eas build -p android --profile production` (AAB), upload to Internal testing -> Closed testing (new personal accounts must run a closed test with testers before production) -> Production
- [ ] Exam packs content ready before launch: TNPSC (Group 1/2/4), TET, TRB, NEET, school boards. Content work, add as categories (Tamil + English). Start with 1-2 packs, add more after launch
- [ ] Admin: Announcements, Question quality (reports, duplicates, draft/publish), Settings (force-update flag, maintenance mode), backup/export, audit log
- [ ] Remove all `console.log` debug output, set versionCode via `autoIncrement`

### Phase 6: After launch
- [ ] Push notifications for the Daily Challenge (streak reminder)
- [ ] Weekly tournaments / reset rewards, friends leaderboard
- [ ] More exam packs from user feedback, analytics-driven content

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
- 2026-11-20: Redesign + Leaderboard merged to main (ee70bd3). Plan reorganised: Phase 1B (local pages) added, new pages placed in phases.
- 2026-11-20: Phase 1B built (Settings, Daily Challenge, Mistakes, Bookmarks, Achievements, admin recolor). Storage logic tested with mocked AsyncStorage; lint 0 errors; bundle OK; NOT tested on a device.
- 2026-11-20: Phase 2 step 1-2 written: backend skeleton, all entities, DbContext, JWT auth endpoints. Dev DB = SQLite (Codespaces), prod = SQL Server (Azure SQL free tier). Decision: office PC cannot install tools, so all dev happens in Codespaces.
- 2026-11-20: Backend auth tested OK in Codespaces (register/login/admin). Step 3 written: content endpoints + CSV import + `backend/smoke-test.sh`.
- 2026-11-20: Smoke test PASSED in Codespaces. Admin web v1 written (login, dashboard, content tree, questions CRUD, CSV import) in the same project; login rate limiting added. NOT yet compiled.
- 2026-11-21: Admin web parity pass (written, not compiled): sample categories seeded in Development, category edit (name/description/timer/opacity/renames/subject timers), question search, bulk delete, JSON import + paste import. STILL MISSING vs the old in-app admin: category background images and subject images (needs file storage decision), Excel .xlsx import (use CSV UTF-8 instead).
- NEXT: build + try /admin in Codespaces, then progress/daily/leaderboard endpoints. (earlier: build backend in Codespaces, then content endpoints. (earlier: test Phase 1B on phone), then Phase 2 (backend). Start with the data model + auth endpoints, then swap `utils/api.js` to call them.

## Redesign progress (branch `ui-redesign`)
- New "Mayil" (peacock) palette in `utils/theme.js`: peacock blue-teal, lotus violet, jasmine white.
  **Do NOT use yellow or red as brand colors** (TVK party colors). Red only for wrong answers/errors.
- Tamil-first bilingual UI (`utils/i18n.js`, `useLang()`), Baloo Thambi 2 headings, fade/press/shake animations.
- Done: Splash, Login, Categories, Subcategories, Subjects, Difficulty, Levels, Quiz, QuizSummary, header, bottom nav.
- Leaderboard tab added (points = passed levels x 50 x difficulty weight 1/2/3; local accounts only until backend).
- Not yet restyled: AdminScreen and components/admin/* (still old palette).
- Test: `git fetch origin && git checkout ui-redesign && npm install && npx expo start --tunnel -c`


## Admin UI plan (build with Phase 2 backend)
Recommended: web admin panel (ASP.NET Core MVC) calling the same API; the in-app AdminScreen stays for quick edits.
Pages, by priority:
1. Dashboard: users, daily actives, quizzes taken, pass rate, top categories, ad and revenue summary.
2. Content manager: categories, subcategories, subjects, questions (add/edit/delete, CSV/JSON import, Tamil + English fields, image upload, timer, background opacity).
3. Paid content manager: price per level or difficulty, free vs paid toggle, Google Play product IDs, purchase list.
4. Ads control: AdMob on/off, ad frequency, placements (banner, interstitial after quiz, rewarded to unlock), test-ad switch.
5. Users: list, search, block/unblock, reset progress, purchases per user.
6. Leaderboard control: reset weekly/monthly, hide users, adjust point weights.
7. Announcements and daily challenge: push message text, featured quiz of the day.
8. Question quality: reported questions, duplicate finder, draft/publish.
9. Settings and audit: app version/force-update flag, maintenance mode, backup/export, admin action log.

## App pages summary (where each is scheduled)
| Page | Phase |
|---|---|
| Home, Profile, Leaderboard (local) | done |
| Settings, Wrong answers + Bookmarks, Daily Challenge, Achievements | 1B |
| Global leaderboard (weekly/all-time), synced streaks and badges | 2 |
| Store / Premium | 3 |
| Rewarded-ad unlock | 4 |
| Exam packs (TNPSC, TET, TRB, NEET) content | 5 (start earlier if content is ready) |

## Privacy policy
- Page: `docs/privacy.html`, hosted by GitHub Pages (Settings > Pages > main /docs) at https://barathkd.github.io/Quiz-In-app/privacy.html
- It describes the CURRENT local-only app. Update it (and the Play Data safety form) before releasing Phase 2 (server accounts), Phase 3 (purchases) and Phase 4 (AdMob).

## Server mode (app <-> backend)
- `utils/config.js`: `API_BASE_URL` (or env `EXPO_PUBLIC_API_URL`). Empty = local mode (all data on the phone, as before).
- `utils/server.js`: HTTP client, JWT in expo-secure-store, offline cache of content, per-session memory cache.
- `utils/api.js`: in server mode swaps accounts, content, progress, bookmarks, mistakes, daily, leaderboard to the backend; screens unchanged.
- Admins use the web panel (`/admin`); in server mode the app opens the normal home screen for them.
- Known limits: writes made while offline are not queued yet; content cache lives in AsyncStorage (fine for a few thousand questions).
- Before release: deploy backend (HTTPS), set `API_BASE_URL`, update privacy policy + Play Data safety form (accounts now stored on a server).

## Admin bulk import (v2)
- Flow: choose file / paste -> preview (status per row, tick/untick) -> Import -> result page.
- Excel/CSV columns: category, subcategory, subject, difficulty, question, A, B, C, D, answer, explanation (+ optional `qid` to update an exported question). Old header-less layout still accepted.
- Difficulty split: rows without a difficulty can be split by count (drag bar) e.g. 20 easy / 30 medium / 50 hard.
- Duplicate policy (skip / update / add), shuffle options, error report (Excel), undo per import, import history, Excel export of filtered questions.
- New table `ImportBatches` + `Questions.ImportBatchId`: delete the dev DB (`rm -f quizin.db*`) after pulling.
- Next: Game Settings page (questions per level, pass marks, challenge rounds/revives/seconds) served to the app; leaderboard bonus for challenge wins.

## Game settings (web-controlled)
- Admin > Settings: questions per level, pass marks, challenge (on/off, questions per round, rounds, seconds per question by difficulty, revives, bonus multiplier), daily challenge (count, minutes).
- Stored as JSON in `AppSettings` (key "game"), served at `GET /api/settings`; the app loads it at start (`loadGameSettings`), cached for offline. Local mode keeps built-in defaults.
- New table: delete the dev DB (`rm -f quizin.db*`) after pulling. Set questions per level BEFORE launch.
