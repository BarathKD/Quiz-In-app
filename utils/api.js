// Single data-access layer for the whole app.
//
// Screens import from "utils/api" and never talk to AsyncStorage or the server directly.
//  - API_BASE_URL empty  -> local mode: everything below is simply utils/storage.js (all data on the phone).
//  - API_BASE_URL set    -> server mode: accounts, content, progress, bookmarks, mistakes, daily streak and
//                           leaderboard come from the ASP.NET Core backend. Content and the last answers are
//                           cached, so the quiz still opens offline.
// Names defined in this file replace the same-named exports of ./storage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as local from "./storage";
import { API_BASE_URL, USE_SERVER } from "./config";
import { ApiError, cachedGet, clearCaches, memo, request, setMemo, setToken, getToken } from "./server";

export * from "./storage";
export { USE_SERVER };

const DAILY_HISTORY_KEY = "quizin_daily_history_";

// ---------- helpers ----------
const absoluteUrl = (u) => (u ? (u.startsWith("http") ? u : API_BASE_URL + u) : null);

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

const progressKey = (category, subcategory, subject) =>
  subject ? `${category}_${subcategory}_${subject}` : `${category}_${subcategory}`;

const dateKey = (d = new Date()) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const yesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
};

// ---------- server-mode implementations ----------
const server = {};

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

server.getLoggedInUserSession = async () => {
  const user = await local.getLoggedInUserSession();
  if (!user) return null;
  return (await getToken()) ? user : null;
};

server.logoutUserSession = async () => {
  await setToken(null);
  await clearCaches();
  return local.logoutUserSession();
};

server.deleteUserAccount = async () => {
  try {
    await request("DELETE", "/api/auth/me");
    await setToken(null);
    await clearCaches();
    await local.logoutUserSession();
    return true;
  } catch (error) {
    console.error("Error deleting account:", error);
    return false;
  }
};

server.initStorageWithSample = async () => {};

// Content
server.getAllCategories = async () => (await cachedGet("/api/categories")).map(mapCategory);

server.getCategoryByName = async (name) => (await server.getAllCategories()).find((c) => c.name === name) || null;

server.getCategoryImage = async (categoryId, subcategory = null, subject = null) => {
  const cats = await server.getAllCategories();
  const cat = cats.find((c) => String(c.id) === String(categoryId));
  if (!cat) return null;
  if (subject) return cat.subjectImages[subject] || null;
  return subcategory ? null : cat.backgroundImage;
};

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

server.getAllQuestions = async () => (await cachedGet("/api/questions")).map(mapQuestion);

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

server.getQuestionsByIds = async (ids) => {
  const wanted = new Set(ids);
  return (await server.getAllQuestions()).filter((q) => wanted.has(q.id));
};

// Per-user data (one call, kept in memory and updated after each write)
const loadMe = () => memo("me", async () => {
  try {
    const data = await cachedGet("/api/me/data");
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return { levels: [], mistakes: [], bookmarks: [], stats: { answered: 0, correct: 0 }, daily: {} };
  }
}, 60000);

// Builds the same progress shape the screens already use, from the passed-level rows.
server.getUserProgress = async () => {
  const me = await loadMe();
  const progress = {};
  for (const row of me.levels || []) {
    const key = progressKey(row.category, row.subcategory, row.subject);
    if (!progress[key]) progress[key] = { easy: false, medium: false, hard: false, levels: { easy: {}, medium: {}, hard: {} } };
    progress[key].levels[row.difficulty][row.levelNumber] = true;
  }

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

server.markLevelPassed = async (userId, category, subcategory, subject, difficulty, levelNumber, totalLevels) => {
  await request("POST", "/api/me/levels", { category, subcategory, subject: subject || null, difficulty, levelNumber });
  const me = await loadMe();
  const exists = (me.levels || []).some((r) => r.category === category && r.subcategory === subcategory
    && (r.subject || null) === (subject || null) && r.difficulty === difficulty && r.levelNumber === levelNumber);
  if (!exists) me.levels = [...(me.levels || []), { category, subcategory, subject: subject || null, difficulty, levelNumber }];
  setMemo("me", me);

  const progress = await server.getUserProgress();
  const entry = progress[progressKey(category, subcategory, subject)] || {};
  let allPassed = true;
  for (let i = 1; i <= totalLevels; i++) if (!entry.levels?.[difficulty]?.[i]) { allPassed = false; break; }
  return { progress: entry, difficultyCompleted: !!entry[difficulty] || allPassed };
};

server.getLeaderboard = async () => {
  try {
    const rows = await cachedGet("/api/leaderboard");
    return rows.map((r) => ({ id: r.id, name: r.name, levels: r.levels, points: r.points, rank: r.rank }));
  } catch (error) {
    console.error("Error loading leaderboard:", error);
    return [];
  }
};

// Mistakes, bookmarks, stats
server.getMistakeIds = async () => (await loadMe()).mistakes || [];
server.getBookmarkIds = async () => (await loadMe()).bookmarks || [];
server.getUserStats = async () => (await loadMe()).stats || { answered: 0, correct: 0 };

server.toggleBookmark = async (userId, questionId) => {
  const res = await request("POST", `/api/me/bookmarks/${questionId}`);
  const me = await loadMe();
  const rest = (me.bookmarks || []).filter((id) => id !== questionId);
  me.bookmarks = res.bookmarked ? [...rest, questionId] : rest;
  setMemo("me", me);
  return res.bookmarked;
};

server.removeBookmark = async (userId, questionId) => {
  await request("DELETE", `/api/me/bookmarks/${questionId}`);
  const me = await loadMe();
  me.bookmarks = (me.bookmarks || []).filter((id) => id !== questionId);
  setMemo("me", me);
};

server.removeMistake = async (userId, questionId) => {
  await request("DELETE", `/api/me/mistakes/${questionId}`);
  const me = await loadMe();
  me.mistakes = (me.mistakes || []).filter((id) => id !== questionId);
  setMemo("me", me);
};

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
    setMemo("me", me);
    await request("POST", "/api/me/answers", { questionId, correct, countStats });
  } catch (error) {
    console.error("Error recording answer:", error);
  }
};

// Daily challenge
server.getDailyQuestions = async () =>
  (await request("GET", `/api/daily?date=${dateKey()}`)).map(mapQuestion);

const readDailyHistory = async (userId) => {
  try {
    const raw = await AsyncStorage.getItem(DAILY_HISTORY_KEY + userId);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

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

server.completeDaily = async (userId, score, total) => {
  const res = await request("POST", "/api/me/daily", { date: dateKey(), score, total });
  const me = await loadMe();
  me.daily = { lastDate: dateKey(), streak: res.streak, best: res.best, lastScore: res.lastScore };
  setMemo("me", me);
  const history = [...(await readDailyHistory(userId)).filter((d) => d !== dateKey()), dateKey()].slice(-60);
  await AsyncStorage.setItem(DAILY_HISTORY_KEY + userId, JSON.stringify(history));
  return server.getDailyStatus(userId);
};

// Badges (computed from the data above, same rules as local mode)
server.getAchievements = async (userId) => {
  const progress = await server.getUserProgress();
  const stats = await server.getUserStats();
  const daily = await server.getDailyStatus(userId);
  const challengeWins = await local.getChallengeWins(userId);

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

// Game rules from the admin Settings page (server mode only; local mode keeps the built-in defaults).
export const loadGameSettings = async () => {
  if (!USE_SERVER) return;
  try {
    local.applyGameSettings(await cachedGet("/api/settings"));
  } catch (error) {
    console.error("Could not load game settings, using defaults:", error);
  }
};

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
