// DailyChallengeScreen.js - daily challenge: streak card, last 7 days, and a start button (or "done today" card).
// ROUTE PARAMS: user (needs user.id; without it nothing is loaded).
// TALKS TO: utils/api.js (getDailyStatus -> streak, best, history, doneToday, lastScore).
// NAVIGATES TO: "Quiz" with { mode: "daily", user } - the quiz itself is in QuizScreen. BottomNav tab: categories.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import FadeInUp from "../components/FadeInUp";
import PressableScale from "../components/PressableScale";
import { getDailyStatus } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, fonts, shadow } from "../utils/theme";

// Date helpers: keyOf() makes a local date key like 2026-01-05. It must have the same format as the dates in status.history from the api.
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function DailyChallengeScreen({ navigation, route }) {
  const { user } = route.params || {};
  const { t } = useLang();
  // State: daily status from the api (null until loaded, so the UI uses status?. with defaults).
  const [status, setStatus] = useState(null);

  // Helper: load the daily status for this user.
  const load = useCallback(async () => {
    if (user?.id) setStatus(await getDailyStatus(user.id));
  }, [user?.id]);

  // Effect: load on open and every time the screen gets focus (to refresh after finishing the daily quiz).
  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [navigation, load]);

  // Last 7 days, oldest first
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: keyOf(d), label: d.toLocaleDateString(undefined, { weekday: "narrow" }) });
  }
  // Set of completed date keys, used to mark the dots in the week card.
  const done = new Set(status?.history || []);

  // Render: header, then streak card, 7-day card, and start/done card.
  return (
    <View style={styles.container}>
      <Header title={t("dailyChallenge")} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Streak card: current streak and best streak */}
        <FadeInUp index={0}>
          <View style={styles.streakCard}>
            <Ionicons name="flame" size={56} color="#FFFFFF" />
            <Text style={styles.streakNum}>{t("dailyStreak", { n: status?.streak || 0 })}</Text>
            <Text style={styles.best}>{t("dailyBest", { n: status?.best || 0 })}</Text>
          </View>
        </FadeInUp>

        {/* Week card: last 7 days, a green dot means the challenge was done that day */}
        <FadeInUp index={1}>
          <View style={styles.weekCard}>
            {days.map((d) => (
              <View key={d.key} style={styles.dayCol}>
                <View style={[styles.dot, done.has(d.key) && styles.dotDone]}>
                  {done.has(d.key) ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                </View>
                <Text style={styles.dayLabel}>{d.label}</Text>
              </View>
            ))}
          </View>
        </FadeInUp>

        {/* Bottom card: if done today show result, otherwise show the start button */}
        <FadeInUp index={2}>
          {status?.doneToday ? (
            <View style={styles.doneCard}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
              <Text style={styles.doneTitle}>{t("dailyDone")}</Text>
              {status.lastScore ? <Text style={styles.doneSub}>{t("dailyScore", { s: status.lastScore })}</Text> : null}
              <Text style={styles.doneSub}>{t("dailyDoneSub")}</Text>
            </View>
          ) : (
            <View style={styles.startCard}>
              <Text style={styles.startSub}>{t("dailySub")}</Text>
              <PressableScale
                style={styles.startBtn}
                onPress={() => navigation.navigate("Quiz", { mode: "daily", user })}
              >
                <Ionicons name="play" size={20} color="#FFFFFF" />
                <Text style={styles.startText}>{t("dailyStart")}</Text>
              </PressableScale>
            </View>
          )}
        </FadeInUp>
      </ScrollView>
      <BottomNav navigation={navigation} user={user} activeTab="categories" />
    </View>
  );
}

// Styles.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  streakCard: { backgroundColor: colors.accent, borderRadius: 24, padding: 26, alignItems: "center", marginBottom: 14, ...shadow },
  streakNum: { color: "#FFFFFF", fontSize: 30, marginTop: 6, fontFamily: fonts.heading },
  best: { color: colors.onAccent, opacity: 0.9, fontSize: 14, marginTop: 2 },
  weekCard: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16, flexDirection: "row",
    justifyContent: "space-around", marginBottom: 14, ...shadow,
  },
  dayCol: { alignItems: "center", gap: 6 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.track, alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: colors.success },
  dayLabel: { fontSize: 12, color: colors.muted },
  startCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 20, alignItems: "center", gap: 14, ...shadow },
  startSub: { fontSize: 16, color: colors.ink, fontWeight: "600" },
  startBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary,
    paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999,
  },
  startText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  doneCard: { backgroundColor: colors.successTint, borderRadius: 18, padding: 22, alignItems: "center", gap: 6 },
  doneTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  doneSub: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 22 },
});
