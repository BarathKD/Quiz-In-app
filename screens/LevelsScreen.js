/*
 * LevelsScreen
 * What: splits the questions of the chosen subject + difficulty into levels
 *       (gameSettings.questionsPerLevel questions each) and lets the user open one.
 *       Level 1 is open; level N opens after level N-1 is passed (admin: all open).
 * Route params: { category, subcategory, subject, difficulty, user }
 * Data: utils/api.js -> getQuestionsByFilter (count of questions), getUserProgress (passed levels),
 *       passMarkFor (pass percent shown in the mode dialog), gameSettings (level size, challenge flag).
 * Texts: t() from utils/i18n.js. Colors: utils/theme.js.
 * Next screen: "Quiz" with levelStart, levelEnd, levelNumber.
 *   Practice mode = no "mode" param. Challenge mode = mode: "challenge" (only if gameSettings.challengeEnabled).
 * The quiz itself only gets the question range (start/end); QuizScreen loads and slices the questions.
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import FadeInUp from "../components/FadeInUp";
import PressableScale from "../components/PressableScale";
import { getQuestionsByFilter, getUserProgress, passMarkFor, gameSettings } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, difficultyColors, shadow } from "../utils/theme";

// Maps a difficulty to its text key in utils/i18n.js.
const LABEL_KEYS = { easy: "difficultyEasy", medium: "difficultyMedium", hard: "difficultyHard" };

export default function LevelsScreen({ navigation, route }) {
  // Values sent by the previous screen (DifficultyScreen).
  const { category, subcategory, subject, difficulty, user } = route.params;
  const { t } = useLang();
  // State: levels = generated level list ({ levelNumber, start, end, count }).
  // passedLevels = { [levelNumber]: true } for levels the user passed.
  // totalQuestions = number of questions found. isLoading = show spinner while loading.
  const [levels, setLevels] = useState([]);
  const [passedLevels, setPassedLevels] = useState({});
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Reload when coming back from a quiz so newly passed levels show up
  useEffect(() => {
    loadLevels();
    const unsubscribe = navigation.addListener("focus", loadLevels);
    return unsubscribe;
  }, [category, subcategory, subject, difficulty, user?.id]);

  // Helper: loads passed levels + question count, then builds the level list.
  // Also runs on every "focus" event (see effect above).
  const loadLevels = async () => {
    try {
      setIsLoading(true);

      // Passed levels for this user
      if (user?.id) {
        const userProgress = await getUserProgress(user.id);
        const key = subject ? `${category}_${subcategory}_${subject}` : `${category}_${subcategory}`;
        setPassedLevels(userProgress[key]?.levels?.[difficulty] || {});
      }

      // Same filter the Quiz screen uses: with no subject, only questions
      // that have no subject (null), never "all subjects" (undefined).
      const filteredQuestions = await getQuestionsByFilter(
        category,
        subcategory,
        subject || null,
        difficulty
      );

      const total = filteredQuestions.length;
      setTotalQuestions(total);

      if (total === 0) {
        setLevels([]);
        return;
      }

      // Each level = up to 50 questions
      const numLevels = Math.ceil(total / gameSettings.questionsPerLevel);
      const generatedLevels = [];

      for (let i = 0; i < numLevels; i++) {
        const start = i * gameSettings.questionsPerLevel;
        const end = Math.min(start + gameSettings.questionsPerLevel, total);
        generatedLevels.push({
          id: `level_${i + 1}`,
          levelNumber: i + 1,
          start,
          end,
          count: end - start,
        });
      }

      setLevels(generatedLevels);
    } catch (error) {
      console.error("Error loading levels:", error);
      Alert.alert(t("error"), t("levelsLoadError"));
    } finally {
      setIsLoading(false);
    }
  };

  // Level 1 is always open; the next level opens after the previous one is passed.
  const isLevelUnlocked = (level) => {
    if (user?.isAdmin) return true;
    if (level.levelNumber === 1) return true;
    return !!passedLevels[level.levelNumber - 1];
  };

  // Handler: tap on a level card.
  //  - locked -> alert only
  //  - challenge mode off -> go straight to Quiz (practice)
  //  - challenge mode on -> ask the user: Practice or Challenge (pass mark from passMarkFor in utils/api.js)
  // QuizScreen decides its rules from the "mode" param.
  const handleLevelPress = (level) => {
    if (!isLevelUnlocked(level)) {
      Alert.alert(t("levelLockedTitle"), t("levelLockedMsg", { n: level.levelNumber - 1 }));
      return;
    }
    const params = {
      category,
      subcategory,
      subject,
      difficulty,
      user,
      levelStart: level.start,
      levelEnd: level.end,
      levelNumber: level.levelNumber,
    };
    if (!gameSettings.challengeEnabled) {
      navigation.navigate("Quiz", params);
      return;
    }
    Alert.alert(
      t("chooseModeTitle"),
      t("modeHint", { p: Math.round(passMarkFor(difficulty) * 100) }),
      [
        { text: t("modePractice", { n: level.levelNumber }), onPress: () => navigation.navigate("Quiz", params) },
        { text: t("modeChallenge"), onPress: () => navigation.navigate("Quiz", { ...params, mode: "challenge" }) },
        { text: t("cancel"), style: "cancel" },
      ]
    );
  };

  // Theme color for this difficulty (fallback: primary color).
  const color = difficultyColors[difficulty] || colors.primary;

  // Render section 1: loading spinner while data is being fetched.
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t("loadingLevels")}</Text>
      </View>
    );
  }

  // Render section 2: header, info card, level list (or "coming soon"), bottom nav.
  return (
    <View style={styles.container}>
      <Header
        title={`${t(LABEL_KEYS[difficulty] || "difficultyEasy")} - ${t("selectLevel")}`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.breadcrumb}>
          {category} › {subcategory}{subject ? ` › ${subject}` : ""}
        </Text>

        {/* Info card: total questions, number of levels, questions per level */}
        <View style={[styles.summaryCard, { borderLeftColor: color }]}>
          <Text style={styles.summaryTitle}>{t("quizInfo")}</Text>
          <Text style={styles.summaryText}>
            {t("totalQuestions")}: <Text style={styles.summaryBold}>{totalQuestions}</Text>
          </Text>
          <Text style={styles.summaryText}>
            {t("levelsAvailable")}: <Text style={styles.summaryBold}>{levels.length}</Text>
          </Text>
          <Text style={styles.summaryText}>
            {t("perLevel")}: <Text style={styles.summaryBold}>{t("upTo", { n: gameSettings.questionsPerLevel })}</Text>
          </Text>
        </View>

        {/* Level list. If there are no questions yet, show the "coming soon" message instead.
            Each level badge shows: check = passed, number = open, lock = locked. */}
        {levels.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="hourglass-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>{t("comingSoon")}</Text>
            <Text style={styles.emptySubtitle}>{t("comingSoonSub")}</Text>
          </View>
        ) : (
          <View style={styles.levelsContainer}>
            {levels.map((level, index) => {
              const unlocked = isLevelUnlocked(level);
              const passed = !!passedLevels[level.levelNumber];

              return (
                <FadeInUp key={level.id} index={index}>
                  <PressableScale
                    style={[styles.levelCard, { borderLeftColor: unlocked ? color : colors.locked }]}
                    onPress={() => handleLevelPress(level)}
                  >
                    <View style={[styles.levelBadge, { backgroundColor: unlocked ? color : colors.locked }]}>
                      {passed ? (
                        <Ionicons name="checkmark" size={26} color="#FFFFFF" />
                      ) : unlocked ? (
                        <Text style={styles.levelBadgeText}>{level.levelNumber}</Text>
                      ) : (
                        <Ionicons name="lock-closed" size={22} color="#FFFFFF" />
                      )}
                    </View>

                    <View style={styles.levelInfo}>
                      <Text style={styles.levelTitle}>{t("levelLabel", { n: level.levelNumber })}</Text>
                      <Text style={styles.levelSubtitle}>
                        {t("questionsCount", { n: level.count })}  (Q{level.start + 1} – Q{level.end})
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={22} color={colors.muted} />
                  </PressableScale>
                </FadeInUp>
              );
            })}
          </View>
        )}
      </ScrollView>
      {/* Bottom tab bar; "categories" tab stays highlighted */}
      <BottomNav navigation={navigation} user={user} activeTab="categories" />
    </View>
  );
}

// Styles: colors come from utils/theme.js. The card border color is set inline per difficulty.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.muted },
  content: { flex: 1, padding: 16 },
  breadcrumb: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 18,
    marginBottom: 18,
    borderLeftWidth: 5,
    ...shadow,
  },
  summaryTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  summaryText: { fontSize: 15, color: colors.muted, marginBottom: 3, lineHeight: 23 },
  summaryBold: { fontWeight: "700", color: colors.ink },
  emptyContainer: { alignItems: "center", paddingVertical: 50 },
  emptyTitle: { fontSize: 19, fontWeight: "700", color: colors.ink, marginTop: 12, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 24 },
  levelsContainer: { gap: 12, paddingBottom: 32 },
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 18,
    borderLeftWidth: 5,
    ...shadow,
  },
  levelBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  levelBadgeText: { fontSize: 20, fontWeight: "bold", color: "#FFFFFF" },
  levelInfo: { flex: 1 },
  levelTitle: { fontSize: 17, fontWeight: "700", color: colors.ink, marginBottom: 2 },
  levelSubtitle: { fontSize: 13, color: colors.muted, lineHeight: 20 },
});
