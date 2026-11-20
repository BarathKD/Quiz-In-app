import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/header";
import FadeInUp from "../components/FadeInUp";
import PressableScale from "../components/PressableScale";
import { QUESTIONS_PER_LEVEL, getDailyStatus } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, fonts, shadow } from "../utils/theme";

const DIFF_KEYS = { easy: "difficultyEasy", medium: "difficultyMedium", hard: "difficultyHard" };

export default function QuizSummaryScreen({ route, navigation }) {
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
    mode,
  } = params;
  const isCustom = !!mode;
  const [daily, setDaily] = useState(null);

  useEffect(() => {
    if (mode === "daily" && user?.id) getDailyStatus(user.id).then(setDaily);
  }, [mode, user?.id]);

  const actualTotalQuestions = totalQuestions || questions.length || 0;
  const percentage = actualTotalQuestions > 0 ? Math.round((score / actualTotalQuestions) * 100) : 0;

  const goHome = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: user ? "Categories" : "Login", params: user ? { user } : {} }],
    });

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

  // Score tone: green / peacock / violet (never red or yellow)
  const scoreColor = percentage >= 70 ? colors.success : percentage >= 50 ? colors.primary : colors.accent;
  const scoreIcon = percentage >= 90 ? "trophy" : percentage >= 70 ? "ribbon" : percentage >= 50 ? "happy-outline" : "fitness-outline";
  const scoreMessage =
    percentage >= 90 ? t("msgExcellent") : percentage >= 70 ? t("msgGreat") : percentage >= 50 ? t("msgGood") : t("msgKeepTrying");

  const handleRetry = () => {
    navigation.replace("Quiz", { category, subcategory, subject, difficulty, user, levelStart, levelEnd, levelNumber });
  };

  const hasNextLevel = !!levelNumber && levelNumber < totalLevels;

  const handleNextLevel = () => {
    navigation.replace("Quiz", {
      category,
      subcategory,
      subject,
      difficulty,
      user,
      levelStart: levelNumber * QUESTIONS_PER_LEVEL,
      levelEnd: (levelNumber + 1) * QUESTIONS_PER_LEVEL,
      levelNumber: levelNumber + 1,
    });
  };

  const handleNextDifficulty = () => {
    let nextDifficulty = "";
    if (difficulty === "easy") nextDifficulty = "medium";
    else if (difficulty === "medium") nextDifficulty = "hard";
    if (nextDifficulty) {
      // Go through the Levels screen so the quiz always gets a level range
      navigation.replace("Levels", { category, subcategory, subject, difficulty: nextDifficulty, user });
    }
  };

  const nextDifficultyKey = difficulty === "easy" ? "tryMedium" : difficulty === "medium" ? "tryHard" : null;
  const showNextDifficulty = passed && !hasNextLevel && difficultyCompleted && !!nextDifficultyKey;

  return (
    <View style={styles.container}>
      <Header title={isCustom ? t(mode === "daily" ? "dailyChallenge" : "practiceTitle") : t("quizComplete")} onBack={goHome} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <FadeInUp index={0}>
          <View style={styles.scoreCard}>
            <Ionicons name={scoreIcon} size={60} color={scoreColor} />
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {score}/{actualTotalQuestions}
            </Text>
            <Text style={[styles.percentageText, { color: scoreColor }]}>{percentage}%</Text>
            <Text style={styles.messageText}>{scoreMessage}</Text>

            {passed && (
              <View style={styles.passedBadge}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.passedText}>{t("passed")}</Text>
              </View>
            )}
          </View>
        </FadeInUp>

        <FadeInUp index={1}>
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
          <View style={styles.actions}>
            {!isCustom && (
              <PressableScale style={styles.primaryBtn} onPress={handleRetry}>
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{t("tryAgain")}</Text>
              </PressableScale>
            )}

            {passed && hasNextLevel && (
              <PressableScale style={styles.accentBtn} onPress={handleNextLevel}>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{t("nextLevel", { n: levelNumber + 1 })}</Text>
              </PressableScale>
            )}

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

function InfoRow({ label, value, accent }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

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
