// Daily reminder: one local notification every day. The ADMIN alone decides if it is on, the time and the text
// (admin Settings page -> gameSettings). Players have no switch in the app (they could forget it is off and drift away);
// they can still block notifications in their phone's own settings.
// Safe everywhere: if notifications are unavailable (web, Expo Go limits) every function quietly does nothing.
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { gameSettings } from "./storage";

// AsyncStorage key that stores "asked" after we showed the permission popup.
// CHANNEL: Android notification channel id for the daily reminder.
const KEY = "quizin_reminder";
const CHANNEL = "daily-reminder";

// Load expo-notifications safely. If the module is missing (web / Expo Go), Notifications stays null
// and syncReminder() returns "unavailable" instead of crashing.
let Notifications = null;
try {
  Notifications = require("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
} catch {
  Notifications = null;
}

// Remembers that the permission question was already shown, so the player is asked only once.
const getAsked = async () => {
  try { return (await AsyncStorage.getItem(KEY)) === "asked"; } catch { return false; }
};
const setAsked = () => AsyncStorage.setItem(KEY, "asked").catch(() => {});

// schedule(lang): removes old reminders and sets ONE new daily reminder.
// Text and time come from gameSettings (admin). Any language other than "en" uses the Tamil text.
// Called only by syncReminder().
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

// Makes the phone match the admin setting. Returns "scheduled", "off", "denied" or "unavailable".
export const syncReminder = async (lang) => {
  if (!Notifications) return "unavailable";
  try {
    if (!gameSettings.reminderEnabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return "off";
    }
    // Ask for permission only once; after that respect the player's choice.
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && !(await getAsked()) && permission.canAskAgain !== false) {
      await setAsked();
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted) return "denied";
    await schedule(lang);
    return "scheduled";
  } catch (error) {
    console.warn("Reminder sync failed:", error);
    return "unavailable";
  }
};
