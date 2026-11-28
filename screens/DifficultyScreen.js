/*
 * DifficultyScreen
 * What: user picks Easy / Medium / Hard (or the mock Exam) for the chosen subject.
 *       Medium unlocks after Easy is completed, Hard after Medium (admin sees all unlocked).
 * Route params: { category, subcategory, subject (can be empty), user, progress (initial done flags) }
 * Data: utils/api.js -> getUserProgress (fresh progress), gameSettings (examEnabled flag).
 * Texts: t() from utils/i18n.js. Colors: utils/theme.js.
 * Next screen: "Levels" (params + difficulty) or "Exam" (mock test, only when gameSettings.examEnabled).
 * If a difficulty is wrongly locked/unlocked, check getDifficultyStatus() and loadProgress().
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import FadeInUp from "../components/FadeInUp";
import PressableScale from "../components/PressableScale";
import { getUserProgress, gameSettings } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, difficultyColors, shadow } from "../utils/theme";

// Order of difficulties (also the unlock order).
const DIFFICULTIES = ["easy", "medium", "hard"];
// Maps a difficulty to its text key in utils/i18n.js.
const LABEL_KEYS = { easy: "difficultyEasy", medium: "difficultyMedium", hard: "difficultyHard" };

export default function DifficultyScreen({ navigation, route }) {
  // Values sent by the previous screen. "progress" is renamed initialProgress to avoid a name clash with state.
  const { category, subcategory, subject, user, progress: initialProgress } = route.params;
  const { t } = useLang();
  // State: progress = which difficulties are completed. Starts from the value passed in route params.
  const [progress, setProgress] = useState(initialProgress || { easy: false, medium: false, hard: false });

  // Effect: refresh progress from storage when the screen opens or the selection changes.
  useEffect(() => {
    loadProgress();
  }, [user?.id, category, subcategory, subject]);

  // Helper: reads progress from utils/api.js. The key format (with or without subject) must match
  // the key that is saved after a quiz is passed.
  const loadProgress = async () => {
    if (user?.id) {
      try {
        const userProgress = await getUserProgress(user.id);
        const key = subject
          ? `${category}_${subcategory}_${subject}`
          : `${category}_${subcategory}`;

        setProgress(userProgress[key] || { easy: false, medium: false, hard: false });
      } catch (error) {
        console.error("Error loading progress:", error);
      }
    }
  };

  // Helper: returns "locked" or "unlocked" for one difficulty. This is the unlock rule (easy -> medium -> hard).
  const getDifficultyStatus = (difficulty) => {
    if (user?.isAdmin) return "unlocked"; // Admin can access all

    switch (difficulty) {
      case "easy":
        return "unlocked"; // Easy is always unlocked
      case "medium":
        return progress.easy ? "unlocked" : "locked"; // Medium unlocks after easy
      case "hard":
        return progress.medium ? "unlocked" : "locked"; // Hard unlocks after medium
      default:
        return "locked";
    }
  };

  // Handler: tap on a difficulty card. Locked -> show alert only. Unlocked -> open Levels screen.
  const handleDifficultyPress = (difficulty) => {
    if (getDifficultyStatus(difficulty) === "locked") {
      Alert.alert(t("lockedTitle"), t("lockedMsg"), [{ text: t("lockedOk") }]);
      return;
    }

    // Levels screen first: questions are split into levels of 50
    navigation.navigate("Levels", { category, subcategory, subject, difficulty, user });
  };

  // Helper: small text under the card title (completed / how to unlock / tap to start).
  const getDescription = (difficulty) => {
    const status = getDifficultyStatus(difficulty);

    if (progress[difficulty]) return t("completedReplay");
    if (status === "locked") {
      return difficulty === "hard" ? t("unlockHard") : t("unlockMedium");
    }
    return t("tapToStart");
  };

  // Helper: Ionicons name for the card (done = check, locked = lock, open = play).
  const getIcon = (difficulty) => {
    if (progress[difficulty]) return "checkmark-circle";
    if (getDifficultyStatus(difficulty) === "locked") return "lock-closed";
    return "play-circle";
  };

  // Render: header, optional Exam card, 3 difficulty cards, progress steps, admin notice, bottom nav.
  return (
    <View style={styles.container}>
      <Header
        title={`${subcategory}${subject ? ` - ${subject}` : ""}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>{t("selectDifficulty")}</Text>
        <Text style={styles.categoryInfo}>
          {category} › {subcategory}{subject ? ` › ${subject}` : ""}
        </Text>

        {/* Mock Exam card: shown only when the exam feature is switched on in gameSettings (utils/api.js) */}
        {gameSettings.examEnabled ? (
          <FadeInUp index={0} style={{ marginBottom: 12 }}>
            <PressableScale
              style={[styles.card, { borderLeftColor: colors.accent }]}
              onPress={() => navigation.navigate("Exam", { category, subcategory, subject, user })}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
                <Ionicons name="school" size={26} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t("examTitle")}</Text>
                <Text style={styles.sub}>{t("examCardSub")}</Text>
              </View>
            </PressableScale>
          </FadeInUp>
        ) : null}

        {/* Difficulty cards: one per difficulty; locked ones are grey and show a lock hint */}
        {DIFFICULTIES.map((difficulty, index) => {
          const locked = getDifficultyStatus(difficulty) === "locked";
          const color = locked ? colors.locked : difficultyColors[difficulty];

          return (
            <FadeInUp key={difficulty} index={index} style={{ marginBottom: 12 }}>
              <PressableScale
                style={[styles.card, { borderLeftColor: color }, locked && styles.lockedCard]}
                onPress={() => handleDifficultyPress(difficulty)}
              >
                <View style={[styles.iconCircle, { backgroundColor: color }]}>
                  <Ionicons name={getIcon(difficulty)} size={26} color="#FFFFFF" />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, locked && { color: colors.muted }]}>
                      {t(LABEL_KEYS[difficulty])}
                    </Text>
                    {progress[difficulty] ? (
                      <View style={[styles.completedBadge, { backgroundColor: color }]}>
                        <Text style={styles.completedBadgeText}>{t("completedBadge")}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.sub}>{getDescription(difficulty)}</Text>
                  {locked ? <Text style={styles.lockHint}>{t("lockedHint")}</Text> : null}
                </View>
              </PressableScale>
            </FadeInUp>
          );
        })}

        {/* Progress steps: 3 dots joined by lines; a dot gets its color when that difficulty is completed */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressTitle}>{t("yourProgress")}</Text>
          <View style={styles.progressBar}>
            {DIFFICULTIES.map((difficulty, index) => (
              <React.Fragment key={difficulty}>
                <View style={styles.progressStep}>
                  <View
                    style={[
                      styles.progressDot,
                      progress[difficulty] && { backgroundColor: difficultyColors[difficulty] },
                    ]}
                  >
                    <Text style={[styles.progressDotText, progress[difficulty] && { color: "#FFFFFF" }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={styles.progressLabel}>{t(LABEL_KEYS[difficulty])}</Text>
                </View>
                {index < DIFFICULTIES.length - 1 ? (
                  <View
                    style={[
                      styles.progressLine,
                      progress[difficulty] && { backgroundColor: difficultyColors[difficulty] },
                    ]}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Admin notice: admin users have every difficulty unlocked */}
        {user?.isAdmin ? (
          <View style={styles.adminNotice}>
            <Text style={styles.adminText}>{t("adminMode")}</Text>
          </View>
        ) : null}
        <View style={{ height: 24 }} />
      </ScrollView>
      {/* Bottom tab bar; "categories" tab stays highlighted */}
      <BottomNav navigation={navigation} user={user} activeTab="categories" />
    </View>
  );
}

// Styles: colors come from utils/theme.js. The card border color is set inline per difficulty.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: 16 },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
    marginTop: 4,
  },
  categoryInfo: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 18,
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderLeftWidth: 5,
    backgroundColor: colors.surface,
    ...shadow,
  },
  lockedCard: { backgroundColor: "#EEF2F3" },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: { fontSize: 19, fontWeight: "800", color: colors.ink },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 2 },
  lockHint: { color: colors.muted, fontSize: 13, marginTop: 6, lineHeight: 20 },
  completedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  completedBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  progressContainer: {
    marginTop: 18,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    color: colors.ink,
  },
  progressBar: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  progressStep: { alignItems: "center" },
  progressDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.track,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  progressDotText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  progressLabel: { fontSize: 12, color: colors.muted },
  progressLine: {
    height: 3,
    width: 36,
    backgroundColor: colors.track,
    marginHorizontal: 8,
    marginBottom: 22,
  },
  adminNotice: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.accentTint,
    borderRadius: 12,
  },
  adminText: { color: colors.ink, fontSize: 14, textAlign: "center", lineHeight: 22 },
});
