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
