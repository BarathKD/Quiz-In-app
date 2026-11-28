// Single data-access layer for the whole app.
//
// Screens import from "utils/api" and never talk to AsyncStorage or the server directly.
//  - API_BASE_URL empty  -> local mode: everything below is simply utils/storage.js (all data on the phone).
//  - API_BASE_URL set    -> server mode: accounts, content, progress, bookmarks, mistakes, daily streak and
//                           leaderboard come from the ASP.NET Core backend. Content and the last answers are
//                           cached, so the quiz still opens offline.
// Names defined in this file replace the same-named exports of ./storage.
// Structure of this file:
//   1. helpers (absoluteUrl, mapCategory, mapQuestion, progressKey, dateKey)
//   2. server = { ... }: server-mode versions of the functions (HTTP calls through ./server.js)
//   3. extra exports that exist only here (reportQuestion, submitExam, loadGameSettings, password reset, pending writes)
//   4. at the bottom: pick(name) chooses server[name] or local[name] (storage.js) using USE_SERVER
// Where is X done? Find the name in the server section (server mode) or in storage.js (local mode).
// Functions not listed at the bottom (for example completeDaily rules, game settings) come straight from storage.js through export * below.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as local from "./storage";
import { API_BASE_URL, USE_SERVER } from "./config";
import {
  ApiError, cachedGet, clearCaches, memo, request, setMemo, setToken, getToken,
  isNetworkError, enqueueWrite, flushQueue, clearQueue, pendingWrites,
} from "./server";

// Re-export everything from storage.js, so screens can import all names from this one file. Names defined below replace them.
export * from "./storage";
// Screens use USE_SERVER to show server-only features (for example the report button).
export { USE_SERVER };

// DAILY_HISTORY_KEY: AsyncStorage key prefix for the list of days the user finished the daily challenge. Real key = prefix + userId.
const DAILY_HISTORY_KEY = "quizin_daily_history_";

// absoluteUrl(u): server gives image paths like /images/a.jpg. This adds the server address in front. Returns null if empty.
// ---------- helpers ----------
const absoluteUrl = (u) => (u ? (u.startsWith("http") ? u : API_BASE_URL + u) : null);

// mapCategory(c): converts a category from the server JSON to the shape the screens use (same as local mode).
const mapCategory = (c) => ({
  id: String(c.id),
  name: c.name,
  description: c.description || "",
  backgroundOpacity: c.backgroundOpacity,
  timer: c.timer,
  subcategories: c.subcategories || [],
  subjects: c.subjects || {},
  subjectTimers: c.subjectTimers || {},
  backgroundImage: absoluteUrl(c.imageUrl),
  subjectImages: Object.fromEntries(Object.entries(c.subjectImages || {}).map(([k, v]) => [k, absoluteUrl(v)])),
});

// progressKey(category, subcategory, subject): key used in the progress object, e.g. "GK_History" or "GK_History_India".
const progressKey = (category, subcategory, subject) =>
  subject ? `${category}_${subcategory}_${subject}` : `${category}_${subcategory}`;

// dateKey(d): date as "YYYY-MM-DD" in the phone's local time. Used for the daily challenge.
const dateKey = (d = new Date()) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
// yesterdayKey(): same as dateKey but for yesterday. Needed to check the daily streak.
const yesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
};

// server: an object that holds the server-mode functions. They are added below as server.name = ...
// ---------- server-mode implementations ----------
const server = {};

// --- Server mode: accounts ---
// registerUser: creates an account. Returns {ok:true} or {ok:false, reason:"exists"} if the email is used.
// Accounts
server.registerUser = async (email, password) => {
  try {
    await request("POST", "/api/auth/register", { email, password });
    await setToken(null); // the signup screen asks the user to log in next
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) return { ok: false, reason: "exists" };
    throw error;
  }
};

// authenticateUser: login. Saves the token, clears old cache, returns the user or null if email or password is wrong.
server.authenticateUser = async (email, password) => {
  try {
    const res = await request("POST", "/api/auth/login", { email, password });
    await setToken(res.token);
    await clearCaches();
    return { id: res.user.id, email: res.user.email, isAdmin: !!res.user.isAdmin };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 400)) return null;
    throw error;
  }
};

// getLoggedInUserSession: the saved user (from storage.js), but only if a login token also exists.
server.getLoggedInUserSession = async () => {
  const user = await local.getLoggedInUserSession();
  if (!user) return null;
  return (await getToken()) ? user : null;
};

// logoutUserSession: removes the token and the cache, then the saved user.
server.logoutUserSession = async () => {
  await setToken(null);
  await clearCaches();
  return local.logoutUserSession();
};

// deleteUserAccount: deletes the account on the server, then clears everything on the phone. Returns true or false.
server.deleteUserAccount = async () => {
  try {
    const userId = await currentUserId();
    await request("DELETE", "/api/auth/me");
    await clearQueue(userId);
    await setToken(null);
    await clearCaches();
    await local.logoutUserSession();
    return true;
  } catch (error) {
    console.error("Error deleting account:", error);
    return false;
  }
};

// initStorageWithSample: nothing to do in server mode (sample data is only for local mode).
server.initStorageWithSample = async () => {};

// --- Server mode: content (categories and questions). Reads use cachedGet, so they work offline after the first load ---
// Content
server.getAllCategories = async () => (await cachedGet("/api/categories")).map(mapCategory);

// getCategoryByName(name): finds one category in the list. Used by QuizScreen for the background and timer.
server.getCategoryByName = async (name) => (await server.getAllCategories()).find((c) => c.name === name) || null;

// getCategoryImage: image URL of a category or of one subject. Returns null if there is none.
server.getCategoryImage = async (categoryId, subcategory = null, subject = null) => {
  const cats = await server.getAllCategories();
  const cat = cats.find((c) => String(c.id) === String(categoryId));
  if (!cat) return null;
  if (subject) return cat.subjectImages[subject] || null;
  return subcategory ? null : cat.backgroundImage;
};

// mapQuestion(q): converts a question from the server JSON to the shape the screens use.
const mapQuestion = (q) => ({
  id: q.id,
  category: q.category,
  subcategory: q.subcategory,
  subject: q.subject || null,
  difficulty: q.difficulty,
  questionText: q.questionText,
  options: q.options,
  correctOptionId: q.correctOptionId,
  explanation: q.explanation || "",
});

// getAllQuestions: all questions (cached).
server.getAllQuestions = async () => (await cachedGet("/api/questions")).map(mapQuestion);

// getQuestionsByFilter: questions for a category, subcategory, subject and difficulty. Filtering is done by the server.
server.getQuestionsByFilter = async (category = null, subcategory = null, subject = null, difficulty = null) => {
  const params = [];
  if (category) params.push(`category=${encodeURIComponent(category)}`);
  if (subcategory) params.push(`subcategory=${encodeURIComponent(subcategory)}`);
  // null / "" means "only questions without a subject" (the server treats a present-but-empty subject that way)
  if (subject !== undefined) params.push(`subject=${encodeURIComponent(subject || "")}`);
  if (difficulty) params.push(`difficulty=${encodeURIComponent(difficulty)}`);
  const path = "/api/questions" + (params.length ? "?" + params.join("&") : "");
  return (await cachedGet(path)).map(mapQuestion);
};

// getQuestionsByIds: questions for a list of ids (used for mistakes and bookmarks practice).
server.getQuestionsByIds = async (ids) => {
  const wanted = new Set(ids);
  return (await server.getAllQuestions()).filter((q) => wanted.has(q.id));
};

// --- Server mode: per-user data. All of it comes from one call /api/me/data (levels, mistakes, bookmarks, stats, daily). loadMe() keeps it in memory ---
// Per-user data (one call, kept in memory and updated after each write)
// ME_CACHE_KEY: AsyncStorage key where the copy of /api/me/data is saved for offline use (same name that cachedGet uses).
const ME_CACHE_KEY = "quizin_cache_/api/me/data";

// currentUserId(): id of the logged-in user, or null.
const currentUserId = async () => (await local.getLoggedInUserSession())?.id || null;

// flushPendingWrites(): sends the writes that were saved while offline. Returns how many are still waiting.
// Sends any writes saved while offline. Returns how many are still waiting.
export const flushPendingWrites = async () => {
  if (!USE_SERVER) return 0;
  return flushQueue(await currentUserId());
};

// getPendingWriteCount(): how many writes are waiting to be sent.
export const getPendingWriteCount = async () => (USE_SERVER ? pendingWrites(await currentUserId()) : 0);

// setMe(me): stores the changed user data in memory and in AsyncStorage.
// Keeps the saved copy of /api/me/data in step with local changes, so they survive a restart while offline.
const setMe = (me) => {
  setMemo("me", me);
  AsyncStorage.setItem(ME_CACHE_KEY, JSON.stringify(me)).catch(() => {});
};

// writeOrQueue(userId, op): sends a change to the server. If there is no network, saves it in a queue (sent later by flushQueue). Other errors are thrown.
// Runs a write against the server. With no connection it is queued and the app carries on with its local copy.
const writeOrQueue = async (userId, op) => {
  try {
    await request(op.method, op.path, op.body);
    flushQueue(userId).catch(() => {}); // the connection works, so send anything that was waiting
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueueWrite(userId, { type: op.type, payload: op.payload });
  }
};

// loadMe(): gets the user data once and keeps it for 60 seconds (memo). Pending writes are sent first. Offline fallback is empty data.
const loadMe = () => memo("me", async () => {
  try {
    await flushQueue(await currentUserId()); // our own pending changes must reach the server before we read it back
    return await cachedGet("/api/me/data");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return { levels: [], mistakes: [], bookmarks: [], stats: { answered: 0, correct: 0 }, daily: {} };
  }
}, 60000);

// getUserProgress: builds the progress object {key: {easy, medium, hard, levels}} from the passed levels list.
// Builds the same progress shape the screens already use, from the passed-level rows.
server.getUserProgress = async () => {
  const me = await loadMe();
  const progress = {};
  for (const row of me.levels || []) {
    const key = progressKey(row.category, row.subcategory, row.subject);
    if (!progress[key]) progress[key] = { easy: false, medium: false, hard: false, levels: { easy: {}, medium: {}, hard: {} } };
    progress[key].levels[row.difficulty][row.levelNumber] = true;
  }

  // Mark a difficulty as complete only if every level of it was passed (level count from the question count).
  // A difficulty counts as complete when every level of it (50 questions each) has been passed.
  const keys = Object.keys(progress);
  if (keys.length) {
    const all = await server.getAllQuestions();
    for (const key of keys) {
      for (const diff of ["easy", "medium", "hard"]) {
        const passed = progress[key].levels[diff];
        const passedCount = Object.keys(passed).length;
        if (!passedCount) continue;
        const total = all.filter((q) => progressKey(q.category, q.subcategory, q.subject) === key && q.difficulty === diff).length;
        const totalLevels = Math.max(1, Math.ceil(total / local.gameSettings.questionsPerLevel));
        let allPassed = true;
        for (let i = 1; i <= totalLevels; i++) if (!passed[i]) { allPassed = false; break; }
        progress[key][diff] = allPassed;
      }
    }
  }
  return progress;
};

// markLevelPassed: saves a passed level (called by QuizScreen). Returns difficultyCompleted, which tells if the next difficulty can open.
server.markLevelPassed = async (userId, category, subcategory, subject, difficulty, levelNumber, totalLevels) => {
  const payload = { category, subcategory, subject: subject || null, difficulty, levelNumber };
  await writeOrQueue(userId, { type: "level", method: "POST", path: "/api/me/levels", body: payload, payload });
  const me = await loadMe();
  const exists = (me.levels || []).some((r) => r.category === category && r.subcategory === subcategory
    && (r.subject || null) === (subject || null) && r.difficulty === difficulty && r.levelNumber === levelNumber);
  if (!exists) me.levels = [...(me.levels || []), { category, subcategory, subject: subject || null, difficulty, levelNumber }];
  setMe(me);

  const progress = await server.getUserProgress();
  const entry = progress[progressKey(category, subcategory, subject)] || {};
  let allPassed = true;
  for (let i = 1; i <= totalLevels; i++) if (!entry.levels?.[difficulty]?.[i]) { allPassed = false; break; }
  return { progress: entry, difficultyCompleted: !!entry[difficulty] || allPassed };
};

// getLeaderboard: top users list. Returns [] on error.
server.getLeaderboard = async () => {
  try {
    const rows = await cachedGet("/api/leaderboard");
    return rows.map((r) => ({ id: r.id, name: r.name, levels: r.levels, points: r.points, rank: r.rank }));
  } catch (error) {
    console.error("Error loading leaderboard:", error);
    return [];
  }
};

// --- Server mode: mistakes, bookmarks and stats ---
// Mistakes, bookmarks, stats
server.getMistakeIds = async () => (await loadMe()).mistakes || [];
server.getBookmarkIds = async () => (await loadMe()).bookmarks || [];
server.getUserStats = async () => (await loadMe()).stats || { answered: 0, correct: 0 };

// toggleBookmark: adds or removes the bookmark. Returns true if it is now bookmarked.
// Decides the new state from our own copy and sends that state (add / remove), so replaying it later is safe.
server.toggleBookmark = async (userId, questionId) => {
  const me = await loadMe();
  const on = !(me.bookmarks || []).includes(questionId);
  const rest = (me.bookmarks || []).filter((id) => id !== questionId);
  me.bookmarks = on ? [...rest, questionId] : rest;
  setMe(me);
  const payload = { questionId, on };
  await writeOrQueue(userId, {
    type: "bookmark", method: on ? "PUT" : "DELETE", path: `/api/me/bookmarks/${questionId}`, payload,
  });
  return on;
};

// removeBookmark: removes one bookmark.
server.removeBookmark = async (userId, questionId) => {
  const me = await loadMe();
  me.bookmarks = (me.bookmarks || []).filter((id) => id !== questionId);
  setMe(me);
  const payload = { questionId, on: false };
  await writeOrQueue(userId, { type: "bookmark", method: "DELETE", path: `/api/me/bookmarks/${questionId}`, payload });
};

// removeMistake: removes one question from the My mistakes list.
server.removeMistake = async (userId, questionId) => {
  const me = await loadMe();
  me.mistakes = (me.mistakes || []).filter((id) => id !== questionId);
  setMe(me);
  const payload = { questionId };
  await writeOrQueue(userId, { type: "mistake_remove", method: "DELETE", path: `/api/me/mistakes/${questionId}`, payload });
};

// recordAnswer: after each answer. Wrong answer adds to mistakes, correct answer removes it. countStats=false skips the answered/correct counters.
server.recordAnswer = async (userId, questionId, correct, countStats = true) => {
  if (!userId) return;
  try {
    // Update the in-memory copy first so the next screen is right even before the server answers
    const me = await loadMe();
    const has = (me.mistakes || []).includes(questionId);
    if (!correct && !has) me.mistakes = [...(me.mistakes || []), questionId];
    else if (correct && has) me.mistakes = me.mistakes.filter((id) => id !== questionId);
    if (countStats) {
      me.stats = me.stats || { answered: 0, correct: 0 };
      me.stats.answered += 1;
      if (correct) me.stats.correct += 1;
    }
    setMe(me);
    const payload = { questionId, correct, countStats };
    await writeOrQueue(userId, { type: "answer", method: "POST", path: "/api/me/answers", body: payload, payload });
  } catch (error) {
    console.error("Error recording answer:", error);
  }
};

// --- Server mode: daily challenge ---
// getDailyQuestions: today's questions (same for all users).
// Daily challenge
server.getDailyQuestions = async () =>
  (await request("GET", `/api/daily?date=${dateKey()}`)).map(mapQuestion);

// readDailyHistory(userId): list of dates when the user completed the daily challenge (kept on the phone only).
const readDailyHistory = async (userId) => {
  try {
    const raw = await AsyncStorage.getItem(DAILY_HISTORY_KEY + userId);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

// getDailyStatus: streak, best streak, done today, last score and history. A streak stays alive only if the last day was today or yesterday.
server.getDailyStatus = async (userId) => {
  const me = await loadMe();
  const d = me.daily || {};
  const today = dateKey();
  const alive = d.lastDate === today || d.lastDate === yesterdayKey();
  return {
    streak: alive ? d.streak || 0 : 0,
    best: d.best || 0,
    doneToday: d.lastDate === today,
    lastScore: d.lastScore ?? null,
    history: await readDailyHistory(userId),
  };
};

// completeDaily: called by QuizScreen after a finished daily quiz. Updates the streak, sends it to the server, saves the history (last 60 days).
server.completeDaily = async (userId, score, total) => {
  const me = await loadMe();
  const payload = { date: dateKey(), score, total };
  const today = dateKey();
  if (me.daily?.lastDate !== today) {
    // Same rule as the server: yesterday keeps the streak going, anything else starts again at 1
    const streak = me.daily?.lastDate === yesterdayKey() ? (me.daily.streak || 0) + 1 : 1;
    me.daily = { lastDate: today, streak, best: Math.max(me.daily?.best || 0, streak), lastScore: `${score}/${total}` };
    setMe(me);
  }
  await writeOrQueue(userId, { type: "daily", method: "POST", path: "/api/me/daily", body: payload, payload });
  const history = [...(await readDailyHistory(userId)).filter((d) => d !== dateKey()), dateKey()].slice(-60);
  await AsyncStorage.setItem(DAILY_HISTORY_KEY + userId, JSON.stringify(history));
  return server.getDailyStatus(userId);
};

// --- Server mode: challenge wins ---
// getChallengeWins(userId): total Challenge mode wins, from the data the server sent (me.challengeWins). Used for the "challenger" badge.
server.getChallengeWins = async () => (await loadMe()).challengeWins || 0;

// recordChallengeWin: saves a Challenge mode win on the server (POST /api/me/challenge-wins).
// The first win for a subject + difficulty earns leaderboard bonus points (the server decides). Queued when offline.
server.recordChallengeWin = async (userId, category, subcategory, subject, difficulty) => {
  if (!userId) return 0;
  const payload = { category, subcategory, subject: subject || null, difficulty };
  await writeOrQueue(userId, { type: "challengeWin", method: "POST", path: "/api/me/challenge-wins", body: payload, payload });
  const me = await loadMe();
  me.challengeWins = (me.challengeWins || 0) + 1; // keep our own copy in step so the badge updates at once
  setMe(me);
  return me.challengeWins;
};

// --- Server mode: achievements ---
// getAchievements: each badge has value, target and unlocked. Counts levels, hard levels, full subjects, streak, correct answers and challenge wins.
// Badges (computed from the data above, same rules as local mode)
server.getAchievements = async (userId) => {
  const progress = await server.getUserProgress();
  const stats = await server.getUserStats();
  const daily = await server.getDailyStatus(userId);
  const challengeWins = await server.getChallengeWins(userId);

  let levelsPassed = 0;
  let hardPassed = 0;
  let masterCount = 0;
  for (const entry of Object.values(progress)) {
    for (const [diff, passed] of Object.entries(entry.levels || {})) {
      const n = Object.values(passed).filter(Boolean).length;
      levelsPassed += n;
      if (diff === "hard") hardPassed += n;
    }
    if (entry.easy && entry.medium && entry.hard) masterCount += 1;
  }

  // Badge list: id is used for the text in i18n.js. value is capped at target.
  const defs = [
    { id: "firstLevel", icon: "flag", value: levelsPassed, target: 1 },
    { id: "levels10", icon: "layers", value: levelsPassed, target: 10 },
    { id: "hardHero", icon: "flame", value: hardPassed, target: 1 },
    { id: "master", icon: "ribbon", value: masterCount, target: 1 },
    { id: "streak3", icon: "calendar", value: daily.best, target: 3 },
    { id: "streak7", icon: "calendar-number", value: daily.best, target: 7 },
    { id: "correct100", icon: "checkmark-done", value: stats.correct, target: 100 },
    { id: "correct500", icon: "trophy", value: stats.correct, target: 500 },
    { id: "challenger", icon: "flash", value: challengeWins, target: 1 },
  ];
  return defs.map((d) => ({ ...d, value: Math.min(d.value, d.target), unlocked: d.value >= d.target }));
};

// "Report this question" (server mode only). reason: wrong_answer | typo | unclear | other
export const reportQuestion = async (questionId, reason, note, userId) => {
  if (!USE_SERVER) return false;
  const payload = { questionId, reason, note };
  await writeOrQueue(userId || (await currentUserId()), { type: "report", method: "POST", path: "/api/me/reports", body: payload, payload });
  return true;
};

// Mock test result. Server mode: the server grades it again and answers with the rank (null when offline: it is queued).
// Local mode: nothing to send.
server.submitExam = async (userId, answers, seconds) => {
  const payload = { answers, seconds };
  try {
    return await request("POST", "/api/me/exams", payload);
  } catch (error) {
    if (!isNetworkError(error)) return null; // the server refused it (for example exam mode was turned off): keep the local result
    await enqueueWrite(userId, { type: "exam", payload });
    return null;
  }
};
// submitExam is exported only in server mode. In local mode it does nothing and returns null.
export const submitExam = USE_SERVER ? server.submitExam : async () => null;

// --- Password reset (used by the login screens) ---
// Forgot password (server mode only): e-mail a 6-digit code, then set a new password with it.
export const requestPasswordReset = async (email) => {
  await request("POST", "/api/auth/forgot", { email });
};
export const resetPassword = async (email, code, newPassword) => {
  await request("POST", "/api/auth/reset", { email, code, newPassword });
};

// Game rules from the admin Settings page (server mode only; local mode keeps the built-in defaults).
export const loadGameSettings = async () => {
  if (!USE_SERVER) return;
  try {
    local.applyGameSettings(await cachedGet("/api/settings"));
  } catch (error) {
    console.error("Could not load game settings, using defaults:", error);
  }
};

// --- Public exports: the screens use these. In server mode the server version is used, otherwise the local version from storage.js ---
// pick(name): chooses the right function.
// ---------- public exports: server version in server mode, local version otherwise ----------
const pick = (name) => (USE_SERVER ? server[name] : local[name]);

export const registerUser = pick("registerUser");
export const authenticateUser = pick("authenticateUser");
export const getLoggedInUserSession = pick("getLoggedInUserSession");
export const logoutUserSession = pick("logoutUserSession");
export const deleteUserAccount = pick("deleteUserAccount");
export const initStorageWithSample = pick("initStorageWithSample");
export const getAllCategories = pick("getAllCategories");
export const getCategoryByName = pick("getCategoryByName");
export const getCategoryImage = pick("getCategoryImage");
export const getAllQuestions = pick("getAllQuestions");
export const getQuestionsByFilter = pick("getQuestionsByFilter");
export const getQuestionsByIds = pick("getQuestionsByIds");
export const getUserProgress = pick("getUserProgress");
export const markLevelPassed = pick("markLevelPassed");
export const getLeaderboard = pick("getLeaderboard");
export const getChallengeWins = pick("getChallengeWins");
export const recordChallengeWin = pick("recordChallengeWin");
export const getMistakeIds = pick("getMistakeIds");
export const getBookmarkIds = pick("getBookmarkIds");
export const getUserStats = pick("getUserStats");
export const toggleBookmark = pick("toggleBookmark");
export const removeBookmark = pick("removeBookmark");
export const removeMistake = pick("removeMistake");
export const recordAnswer = pick("recordAnswer");
export const getDailyQuestions = pick("getDailyQuestions");
export const getDailyStatus = pick("getDailyStatus");
export const completeDaily = pick("completeDaily");
export const getAchievements = pick("getAchievements");
