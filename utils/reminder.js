// Daily reminder: one local notification every day at a time the player chooses (no server needed).
// Safe everywhere: if notifications are unavailable (web, Expo Go limits) every function quietly does nothing.
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "quizin_reminder";
const CHANNEL = "daily-reminder";
export const REMINDER_HOURS = [7, 12, 18, 20, 21]; // choices shown on the Settings page
const DEFAULT = { enabled: false, hour: 20, minute: 0 };

let Notifications = null;
try {
  Notifications = require("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
} catch {
  Notifications = null;
}

export const getReminder = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
};

const saveReminder = (value) => AsyncStorage.setItem(KEY, JSON.stringify(value)).catch(() => {});

const ensurePermission = async () => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
};

const schedule = async (hour, minute, title, body) => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Daily reminder",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#0C6478",
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
  });
};

// Turn the reminder on (asks permission first) or off. Returns { ok, reason } where reason is "denied" or "unavailable".
export const setReminder = async ({ enabled, hour, text }) => {
  const current = await getReminder();
  const next = { enabled, hour: hour ?? current.hour, minute: 0 };
  if (!Notifications) return { ok: false, reason: "unavailable", reminder: current };
  try {
    if (!enabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } else {
      if (!(await ensurePermission())) return { ok: false, reason: "denied", reminder: current };
      await schedule(next.hour, next.minute, text.title, text.body);
    }
    await saveReminder(next);
    return { ok: true, reminder: next };
  } catch (error) {
    console.warn("Reminder failed:", error);
    return { ok: false, reason: "unavailable", reminder: current };
  }
};

// Called when the app opens: re-schedules with the current language so the text always matches.
export const syncReminder = async (text) => {
  if (!Notifications) return;
  try {
    const current = await getReminder();
    if (!current.enabled) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    await schedule(current.hour, current.minute, text.title, text.body);
  } catch (error) {
    console.warn("Reminder sync failed:", error);
  }
};
