// Daily reminder: one local notification every day. The ADMIN decides if it is on, the time and the text
// (admin Settings page -> gameSettings). The player can only switch it off for themselves.
// Safe everywhere: if notifications are unavailable (web, Expo Go limits) every function quietly does nothing.
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { gameSettings } from "./storage";

const KEY = "quizin_reminder";
const CHANNEL = "daily-reminder";

let Notifications = null;
try {
  Notifications = require("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
} catch {
  Notifications = null;
}

// The player's own choice: optOut (switched off) and asked (permission already requested once).
export const getReminderPrefs = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return { optOut: false, asked: false, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { optOut: false, asked: false };
  }
};
const savePrefs = (value) => AsyncStorage.setItem(KEY, JSON.stringify(value)).catch(() => {});

const schedule = async (lang) => {
  const ta = lang !== "en";
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Daily reminder",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#0C6478",
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: ta ? gameSettings.reminderTitleTa : gameSettings.reminderTitleEn,
      body: ta ? gameSettings.reminderBodyTa : gameSettings.reminderBodyEn,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: gameSettings.reminderHour,
      minute: gameSettings.reminderMinute,
      channelId: CHANNEL,
    },
  });
};

// Makes the phone match the admin setting + the player's choice. Returns "scheduled", "off", "denied" or "unavailable".
// Asks for permission only once, so the player is never nagged.
export const syncReminder = async (lang, { forceAsk = false } = {}) => {
  if (!Notifications) return "unavailable";
  try {
    const prefs = await getReminderPrefs();
    if (!gameSettings.reminderEnabled || prefs.optOut) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return "off";
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && (forceAsk || !prefs.asked) && permission.canAskAgain !== false) {
      permission = await Notifications.requestPermissionsAsync();
      await savePrefs({ ...prefs, asked: true });
    }
    if (!permission.granted) return "denied";
    await schedule(lang);
    return "scheduled";
  } catch (error) {
    console.warn("Reminder sync failed:", error);
    return "unavailable";
  }
};

// The player's own on/off switch in Settings. Returns the same result words as syncReminder.
export const setReminderOptOut = async (optOut, lang) => {
  const prefs = await getReminderPrefs();
  await savePrefs({ ...prefs, optOut });
  return syncReminder(lang, { forceAsk: !optOut });
};
