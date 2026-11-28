/*
  QuizSummaryScreen.js - result screen shown after a quiz ends (practice level, daily, mistakes, bookmarks, challenge).
  Route params (all sent by QuizScreen.handleQuizComplete): score, totalQuestions, questions, passed, category, subcategory,
    subject, difficulty, user, levelStart, levelEnd, levelNumber, totalLevels, difficultyCompleted, passMark, mode.
  It only shows the result. Saving progress is already done in QuizScreen (markLevelPassed, completeDaily, recordChallengeWin).
  Goes to: Quiz (retry or next level), Levels (next difficulty), Categories or Login (home).
  Where is X done? score and colour: percentage, scoreColor   buttons: handleRetry, handleNextLevel, handleNextDifficulty
*/
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/header";
import FadeInUp from "../components/FadeInUp";
import PressableScale from "../components/PressableScale";
import { gameSettings, getDailyStatus } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, fonts, shadow } from "../utils/theme";

// DIFF_KEYS: difficulty value to text key in utils/i18n.js.
const DIFF_KEYS = { easy: "difficultyEasy", medium: "difficultyMedium", hard: "difficultyHard" };

// QuizSummaryScreen: shows score, details and the next-step buttons.
export default function QuizSummaryScreen({ route, navigation }) {
  // --- Route params with safe defaults (the screen must not crash if a param is missing) ---
  const { t } = useLang();
  const params = route?.params || {};
  const {
    score = 0,
    totalQuestions = 0,
    questions = [],
    passed = false,
    category = "",
    subcategory = "",
    subject = null,
    difficulty = "",
    user = null,
    levelStart,
    levelEnd,
    levelNumber,
    totalLevels = 1,
    difficultyCompleted = false,
    passMark,
    mode,
  } = params;
  // isCustom: daily, mistakes, bookmarks or challenge (not a normal level).
  const isCustom = !!mode;
  // daily: today's daily status (streak) from api.js getDailyStatus. Only loaded in daily mode.
  const [daily, setDaily] = useState(null);

  // Load the daily streak after a daily quiz.
  useEffect(() => {
    if (mode === "daily" && user?.id) getDailyStatus(user.id).then(setDaily);
  }, [mode, user?.id]);

  // --- Score numbers. Total falls back to the question count. Percentage is rounded and safe when total is 0 ---
  const actualTotalQuestions = totalQuestions || questions.length || 0;
  const percentage = actualTotalQuestions > 0 ? Math.round((score / actualTotalQuestions) * 100) : 0;

  // goHome(): reset the navigation stack and open Categories (or Login if there is no user). Reset means Back cannot return to the quiz.
  const goHome = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: user ? "Categories" : "Login", params: user ? { user } : {} }],
    });

  // Guard: a normal level result without category data is invalid. Show an error and a home button.
  if (!isCustom && (!category || !subcategory || !difficulty)) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t("invalidQuiz")}</Text>
        <PressableScale style={styles.primaryBtn} onPress={goHome}>
          <Text style={styles.primaryBtnText}>{t("backToHome")}</Text>
        </PressableScale>
      </View>
    );
  }

  // --- Score level: 90+ trophy, 70+ ribbon, 50+ happy, below that encouragement ---
  // Score tone: green / peacock / violet (never red or yellow)
  const scoreColor = percentage >= 70 ? colors.success : percentage >= 50 ? colors.primary : colors.accent;
  const scoreIcon = percentage >= 90 ? "trophy" : percentage >= 70 ? "ribbon" : percentage >= 50 ? "happy-outline" : "fitness-outline";
  const scoreMessage =
    percentage >= 90 ? t("msgExcellent") : percentage >= 70 ? t("msgGreat") : percentage >= 50 ? t("msgGood") : t("msgKeepTrying");

  // handleRetry(): open the same quiz again (same level). Challenge keeps its mode.
  const handleRetry = () => {
    navigation.replace("Quiz", {
      category, subcategory, subject, difficulty, user, levelStart, levelEnd, levelNumber,
      ...(mode === "challenge" ? { mode } : {}),
    });
  };

  // hasNextLevel: true if this is a normal level and a higher level exists (levelNumber < totalLevels).
  const hasNextLevel = !isCustom && !!levelNumber && levelNumber < totalLevels;

  // handleNextLevel(): open the next level. The question range moves by questionsPerLevel (gameSettings).
  const handleNextLevel = () => {
    navigation.replace("Quiz", {
      category,
      subcategory,
      subject,
      difficulty,
      user,
      levelStart: levelNumber * gameSettings.questionsPerLevel,
      levelEnd: (levelNumber + 1) * gameSettings.questionsPerLevel,
      levelNumber: levelNumber + 1,
    });
  };

  // handleNextDifficulty(): easy goes to medium, medium goes to hard (hard has no next).
  const handleNextDifficulty = () => {
    let nextDifficulty = "";
    if (difficulty === "easy") nextDifficulty = "medium";
    else if (difficulty === "medium") nextDifficulty = "hard";
    if (nextDifficulty) {
      // Go through the Levels screen so the quiz always gets a level range
      navigation.replace("Levels", { category, subcategory, subject, difficulty: nextDifficulty, user });
    }
  };

  // Next difficulty button is shown only if passed, there is no next level, this difficulty is fully completed (difficultyCompleted from markLevelPassed) and a next one exists.
  const nextDifficultyKey = difficulty === "easy" ? "tryMedium" : difficulty === "medium" ? "tryHard" : null;
  const showNextDifficulty = passed && !hasNextLevel && difficultyCompleted && !!nextDifficultyKey;

  // --- Screen layout ---
  return (
    <View style={styles.container}>
      {/* Header: title depends on the mode. Back button goes home */}
      <Header title={isCustom ? t(mode === "daily" ? "dailyChallenge" : mode === "challenge" ? "challengeTitle" : "practiceTitle") : t("quizComplete")} onBack={goHome} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <FadeInUp index={0}>
          {/* Score card: big score, percentage, message, passed badge or the pass mark needed */}
          <View style={styles.scoreCard}>
            <Ionicons name={scoreIcon} size={60} color={scoreColor} />
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {score}/{actualTotalQuestions}
            </Text>
            <Text style={[styles.percentageText, { color: scoreColor }]}>{percentage}%</Text>
            <Text style={styles.messageText}>{scoreMessage}</Text>

            {/* Passed badge (challenge shows a won text) */}
            {passed && (
              <View style={styles.passedBadge}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.passedText}>{mode === "challenge" ? t("challengeWon") : t("passed")}</Text>
              </View>
            )}
            {/* Failed in a normal level: show the pass mark needed */}
            {!passed && !isCustom && !!passMark && (
              <Text style={styles.messageText}>{t("passMarkNeed", { p: Math.round(passMark * 100) })}</Text>
            )}
          </View>
        </FadeInUp>

        <FadeInUp index={1}>
          {/* Quiz details card: category, subject, difficulty, daily streak, correct count */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("quizDetails")}</Text>
            {isCustom ? null : (
              <>
                <InfoRow label={t("categoryLabel")} value={category} />
                <InfoRow label={t("subjectLabel")} value={`${subcategory}${subject ? ` - ${subject}` : ""}`} />
                <InfoRow label={t("difficultyLabel")} value={t(DIFF_KEYS[difficulty] || "difficultyEasy")} accent />
              </>
            )}
            {daily ? <InfoRow label={t("dailyChallenge")} value={t("dailyStreak", { n: daily.streak })} accent /> : null}
            <InfoRow label={t("answeredLabel")} value={t("correctOutOf", { a: score, b: actualTotalQuestions })} />
          </View>
        </FadeInUp>

        <FadeInUp index={2}>
          {/* Performance card: correct, wrong, accuracy and a progress bar */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("performance")}</Text>
            <View style={styles.statRow}>
              <Stat value={score} label={t("correctStat")} color={colors.success} />
              <Stat value={actualTotalQuestions - score} label={t("wrongStat")} color={colors.danger} />
              <Stat value={`${percentage}%`} label={t("accuracyStat")} color={scoreColor} />
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: scoreColor }]} />
            </View>
          </View>
        </FadeInUp>

        <FadeInUp index={3}>
          {/* Action buttons: try again, next level, next difficulty, back to categories */}
          <View style={styles.actions}>
            {/* Try again: for normal levels and challenge only */}
            {(!isCustom || mode === "challenge") && (
              <PressableScale style={styles.primaryBtn} onPress={handleRetry}>
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{t("tryAgain")}</Text>
              </PressableScale>
            )}

            {/* Next level: only if passed */}
            {passed && hasNextLevel && (
              <PressableScale style={styles.accentBtn} onPress={handleNextLevel}>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{t("nextLevel", { n: levelNumber + 1 })}</Text>
              </PressableScale>
            )}

            {/* Next difficulty: only when this difficulty is finished */}
            {showNextDifficulty && (
              <PressableScale style={styles.accentBtn} onPress={handleNextDifficulty}>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{t(nextDifficultyKey)}</Text>
              </PressableScale>
            )}

            <PressableScale style={styles.outlineBtn} onPress={goHome}>
              <Ionicons name="home-outline" size={20} color={colors.primary} />
              <Text style={styles.outlineBtnText}>{t("backToCategories")}</Text>
            </PressableScale>
          </View>
        </FadeInUp>

        {/* Study tips card (normal levels only) */}
        {!isCustom && (
        <FadeInUp index={4}>
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Ionicons name="bulb-outline" size={20} color={colors.accent} />
              <Text style={styles.tipsTitle}>{t("tipsTitle")}</Text>
            </View>
            {["tip1", "tip2", "tip3", "tip4"].map((k) => (
              <Text key={k} style={styles.tipText}>• {t(k)}</Text>
            ))}
            {passed && hasNextLevel && (
              <Text style={[styles.tipText, styles.successTip]}>• {t("unlockedNext")}</Text>
            )}
          </View>
        </FadeInUp>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// InfoRow: one label and value line in the details card. accent = highlighted value.
function InfoRow({ label, value, accent }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

// Stat: one number with a label (correct, wrong, accuracy).
function Stat({ value, label, color }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: 16 },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: colors.bg },
  errorText: { fontSize: 18, color: colors.danger, marginBottom: 20, textAlign: "center" },
  scoreCard: {
    backgroundColor: colors.surface, borderRadius: 24, padding: 28, alignItems: "center", marginBottom: 14, ...shadow,
  },
  scoreText: { fontSize: 48, marginTop: 8, fontFamily: fonts.heading },
  percentageText: { fontSize: 24, fontWeight: "600", marginBottom: 10 },
  messageText: { fontSize: 18, color: colors.muted, textAlign: "center", marginBottom: 14, lineHeight: 28 },
  passedBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.success,
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999,
  },
  passedText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 18, marginBottom: 14, ...shadow },
  cardTitle: { fontSize: 18, color: colors.ink, marginBottom: 14, fontFamily: fonts.headingSemi },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 },
  infoLabel: { fontSize: 14, color: colors.muted, flex: 1 },
  infoValue: { fontSize: 14, fontWeight: "600", color: colors.ink, flex: 1, textAlign: "right" },
  statRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 14 },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 26, fontWeight: "bold" },
  statLabel: { fontSize: 13, color: colors.muted, marginTop: 2 },
  progressBar: { height: 8, backgroundColor: colors.track, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  actions: { gap: 10, marginBottom: 14 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999,
  },
  accentBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  outlineBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary,
    paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999,
  },
  outlineBtnText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  tipsCard: { backgroundColor: colors.accentTint, borderRadius: 18, padding: 18 },
  tipsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  tipsTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  tipText: { fontSize: 14, color: colors.ink, lineHeight: 24 },
  successTip: { color: colors.success, fontWeight: "700", marginTop: 4 },
});
