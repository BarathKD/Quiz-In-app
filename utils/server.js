// Talks to the Quiz-IN backend. Only used when API_BASE_URL is set (see utils/config.js).
// - JWT is kept in expo-secure-store (falls back to AsyncStorage where secure store is unavailable).
// - GET results are cached so the app still shows content when offline.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./config";

const TOKEN_KEY = "quizin_token";
const CACHE_PREFIX = "quizin_cache_";
const TIMEOUT_MS = 15000;

let memoryToken = null;
let tokenLoaded = false;

export class ApiError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export const getToken = async () => {
  if (tokenLoaded) return memoryToken;
  try {
    memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (e) {
    memoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  }
  tokenLoaded = true;
  return memoryToken;
};

export const setToken = async (token) => {
  memoryToken = token || null;
  tokenLoaded = true;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (e) {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  }
};

// In-memory copy of the logged-in user's data (/api/me/data); cleared on logout.
let sessionCache = {};
export const clearSessionCache = () => { sessionCache = {}; };
export const memo = async (key, loader, ttlMs = 30000) => {
  const hit = sessionCache[key];
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await loader();
  sessionCache[key] = { at: Date.now(), value };
  return value;
};
export const setMemo = (key, value) => { sessionCache[key] = { at: Date.now(), value }; };
export const dropMemo = (key) => { delete sessionCache[key]; };

export const request = async (method, path, body) => {
  const token = await getToken();
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(API_BASE_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = text; }
  }
  if (!res.ok) {
    // A rejected token on a normal call means the login expired: drop it so the next launch asks to log in.
    if (res.status === 401 && token && !path.startsWith("/api/auth/login")) {
      await setToken(null);
    }
    throw new ApiError(res.status, data);
  }
  return data;
};

// GET with an offline fallback: fresh data when online, the last saved copy when the request fails.
export const cachedGet = async (path) => {
  const key = CACHE_PREFIX + path;
  try {
    const data = await request("GET", path);
    AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => {});
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    const saved = await AsyncStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    throw error;
  }
};

export const clearCaches = async () => {
  clearSessionCache();
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(CACHE_PREFIX)));
};

// ---------- Offline write queue ----------
// When the phone has no connection, writes (level passed, answers, bookmarks, daily, reports) are kept here
// and replayed in order as soon as the server can be reached. Every replayed call is safe to repeat.
const QUEUE_PREFIX = "quizin_queue_";
const MAX_QUEUE = 500;
let flushing = false;

// True for "could not reach the server" (no connection, timeout); false when the server answered with an error.
export const isNetworkError = (error) => !(error instanceof ApiError);

const readQueue = async (userId) => {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_PREFIX + userId)) || "[]");
  } catch (e) {
    return [];
  }
};
const writeQueue = (userId, list) => AsyncStorage.setItem(QUEUE_PREFIX + userId, JSON.stringify(list));

export const enqueueWrite = async (userId, op) => {
  if (!userId) return;
  let list = await readQueue(userId);
  // Only the latest bookmark action per question matters
  if (op.type === "bookmark") list = list.filter((o) => !(o.type === "bookmark" && o.payload.questionId === op.payload.questionId));
  list.push({ ...op, at: Date.now() });
  await writeQueue(userId, list.slice(-MAX_QUEUE));
};

export const pendingWrites = async (userId) => (userId ? (await readQueue(userId)).length : 0);
export const clearQueue = (userId) => (userId ? AsyncStorage.removeItem(QUEUE_PREFIX + userId) : Promise.resolve());

const sendOp = (op) => {
  const p = op.payload;
  switch (op.type) {
    case "level": return request("POST", "/api/me/levels", p);
    case "answer": return request("POST", "/api/me/answers", p);
    case "bookmark": return request(p.on ? "PUT" : "DELETE", `/api/me/bookmarks/${p.questionId}`);
    case "mistake_remove": return request("DELETE", `/api/me/mistakes/${p.questionId}`);
    case "daily": return request("POST", "/api/me/daily", p);
    case "report": return request("POST", "/api/me/reports", p);
    default: return Promise.resolve(); // unknown op from an older version: drop it
  }
};

// Sends queued writes in order. Stops at the first one that cannot be delivered right now (offline, server error,
// logged out). A write the server rejects for good (400/403/404...) is dropped so it cannot block the rest.
export const flushQueue = async (userId) => {
  if (!userId || flushing) return 0;
  flushing = true;
  try {
    const list = await readQueue(userId);
    while (list.length > 0) {
      try {
        await sendOp(list[0]);
        list.shift();
        await writeQueue(userId, list);
      } catch (error) {
        const permanent = error instanceof ApiError && error.status >= 400 && error.status < 500
          && ![401, 408, 429].includes(error.status);
        if (!permanent) break;
        list.shift();
        await writeQueue(userId, list);
      }
    }
    return list.length;
  } finally {
    flushing = false;
  }
};
