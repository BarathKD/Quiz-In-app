import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Alert, Modal, ImageBackground, Animated, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/header";
import PressableScale from "../components/PressableScale";
import { useLang } from "../utils/i18n";
import { colors, fonts, shadow } from "../utils/theme";
import {
  getAllQuestions, markLevelPassed, getCategoryByName, getCategoryImage, gameSettings, challengeSecondsFor,
  getDailyQuestions, getMistakeIds, getBookmarkIds, getQuestionsByIds, toggleBookmark,
  recordAnswer, completeDaily, getQuestionsByFilter, passMarkFor, reportQuestion, USE_SERVER,
  recordChallengeWin,
} from "../utils/api";
import { showRewardedAd } from "../utils/ads";

/** Utility shuffle (Fisher-Yates) */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizScreen({ navigation, route }) {
  // mode: undefined = normal level quiz; "daily" | "mistakes" | "bookmarks" = custom practice
  const { category, subcategory, difficulty, user, subject, levelStart, levelEnd, levelNumber, mode } = route.params;
  const isCustom = !!mode;
  const isChallenge = mode === "challenge";
  const revivesRef = useRef(0); // wrong answers forgiven by watching an ad (challenge only)
  const [bookmarked, setBookmarked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { t } = useLang();
  const shake = useRef(new Animated.Value(0)).current;
  const [pool, setPool] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null); // Wait for category data to set time
  const [totalTime, setTotalTime] = useState(300); // Default to 5 minutes
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [totalAvailableQuestions, setTotalAvailableQuestions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // New state for background image
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.3);
  const [categoryData, setCategoryData] = useState(null);
  
  const timerRef = useRef(null);

  useEffect(() => {
    loadQuestions();
    if (!isCustom) loadCategoryBackground();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

 // Load category background image and opacity
  const loadCategoryBackground = async () => {
    try {
      console.log("=== LOADING BACKGROUND IMAGE ===");
      console.log("Looking for category:", category);
      
      const categoryInfo = await getCategoryByName(category);
      console.log("Category info found:", categoryInfo);
      
      if (categoryInfo) {
        setCategoryData(categoryInfo);
        
        // Load background image URI
        if (categoryInfo.id) {
          const imageUri = await getCategoryImage(categoryInfo.id);
          console.log("Image URI retrieved:", imageUri);
          
          if (imageUri) {
            setBackgroundImage(imageUri);
            console.log("✅ Background image set successfully");
          } else {
            console.log("❌ No image URI found");
          }
        }
        
        // Set opacity
        if (categoryInfo.backgroundOpacity !== undefined) {
          setBackgroundOpacity(categoryInfo.backgroundOpacity);
          console.log("Opacity set to:", categoryInfo.backgroundOpacity);
        }

        // Timer initialization logic (in minutes -> to seconds)
        let quizTimeInMinutes = categoryInfo.timer || 5; // Default 5 mins
        if (subject && categoryInfo.subjectTimers && categoryInfo.subjectTimers[subject]) {
          quizTimeInMinutes = categoryInfo.subjectTimers[subject];
        }
        const timeInSeconds = quizTimeInMinutes * 60;
        setTotalTime(timeInSeconds);
        setTimeLeft(timeInSeconds);
        console.log("Timer initialized to:", timeInSeconds, "seconds");

      } else {
        console.log("❌ Category not found");
      }
    } catch (error) {
      console.error("Error loading category background:", error);
    }
  };

  // Load questions with proper subject filtering
  const loadQuestions = async () => {
    try {
      setIsLoading(true);

      if (isCustom) {
        let list = [];
        if (mode === "daily") {
          list = await getDailyQuestions();
          const dailySeconds = gameSettings.dailyTimerMinutes * 60;
          setTotalTime(dailySeconds);
          setTimeLeft(dailySeconds);
        } else if (isChallenge) {
          // Random questions out of this level's questions: rounds x questions per round (fewer if the level is small)
          const levelQs = (await getQuestionsByFilter(category, subcategory, subject || null, difficulty))
            .slice(levelStart, levelEnd);
          const wanted = gameSettings.challengeRounds * gameSettings.challengeQuestionsPerRound;
          list = shuffleArray(levelQs).slice(0, wanted);
          const seconds = Math.max(1, list.length) * challengeSecondsFor(difficulty);
          setTotalTime(seconds);
          setTimeLeft(seconds);
        } else {
          const ids = mode === "mistakes" ? await getMistakeIds(user?.id) : await getBookmarkIds(user?.id);
          list = shuffleArray(await getQuestionsByIds(ids)); // practice is untimed
        }
        if (list.length === 0) {
          Alert.alert(t("comingSoon"), t("dailyNoQuestions"), [
            { text: t("lockedOk"), onPress: () => navigation.goBack() },
          ]);
          return;
        }
        setTotalAvailableQuestions(list.length);
        setPool(list);
        setQuestions(list);
        setIndex(0);
        setAnswers({});
        setScore(0);
        return;
      }

      const all = await getAllQuestions();
      
      console.log("=== QUIZ LOADING DEBUG ===");
      console.log("Total questions in database:", all.length);
      console.log("Looking for:", { category, subcategory, subject, difficulty });
      console.log("Level range:", { levelStart, levelEnd, levelNumber });
      
      // Filtering logic
      let filtered = all.filter(q => {
        const categoryMatch = q.category === category;
        const subcategoryMatch = q.subcategory === subcategory;
        const difficultyMatch = q.difficulty === difficulty;
        
        let subjectMatch = false;
        
        if (subject) {
          // If subject is provided, question must have that exact subject
          subjectMatch = (q.subject === subject);
        } else {
          // If no subject provided, accept questions without subject field or empty subject
          subjectMatch = (!q.subject || q.subject === "" || q.subject === null || q.subject === undefined);
        }
        
        return categoryMatch && subcategoryMatch && difficultyMatch && subjectMatch;
      });

      console.log("Filtered questions count:", filtered.length);
      setTotalAvailableQuestions(filtered.length);

      // Apply level slicing if levelStart & levelEnd are provided
      if (typeof levelStart === "number" && typeof levelEnd === "number") {
        filtered = filtered.slice(levelStart, levelEnd);
        console.log(`Level ${levelNumber}: showing Q${levelStart + 1}–Q${levelEnd} (${filtered.length} questions)`);
      }

      if (filtered.length === 0) {
        Alert.alert(
          t("comingSoon"),
          t("comingSoonSub"),
          [{ text: t("lockedOk"), onPress: () => navigation.goBack() }]
        );
        return;
      }

      // Shuffle the level's questions
      setPool(filtered);
      const sessionQs = shuffleArray(filtered);
      setQuestions(sessionQs);
      setIndex(0);
      setAnswers({});
      setScore(0);
      // Removed setTimeLeft(300) so it uses the fetched category timer
      
      console.log(`Quiz session created with ${sessionQs.length} questions`);
    } catch (error) {
      console.error("Error loading questions:", error);
      Alert.alert(t("error"), t("failedLoadQuestions"), [
        { text: t("lockedOk"), onPress: () => navigation.goBack() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const isTimerInitialized = timeLeft !== null;
  
  useEffect(() => {
    // Timer management
    if (!questions || questions.length === 0 || showExplanation || isLoading || !isTimerInitialized) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Only count down here. The timeout itself is handled in the effect below,
    // because side effects must not run inside a state updater.
    timerRef.current = setInterval(() => {
      setTimeLeft(s => (s <= 1 ? 0 : s - 1));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [index, questions, showExplanation, isLoading, isTimerInitialized]);

  const q = questions[index];

  useEffect(() => {
    let active = true;
    setBookmarked(false);
    if (q?.id && user?.id) {
      getBookmarkIds(user.id).then((ids) => active && setBookmarked(ids.includes(q.id)));
    }
    return () => { active = false; };
  }, [q?.id, user?.id]);

  const REPORT_REASONS = [
    { id: "wrong_answer", key: "reportWrongAnswer" },
    { id: "typo", key: "reportTypo" },
    { id: "unclear", key: "reportUnclear" },
    { id: "other", key: "reportOther" },
  ];

  const submitReport = async (reason) => {
    setReportOpen(false);
    try {
      await reportQuestion(q.id, reason, undefined, user?.id);
      Alert.alert(t("reportThanks"));
    } catch (error) {
      console.error("Report failed:", error);
      Alert.alert(t("reportFailed"));
    }
  };

  const handleBookmark = async () => {
    if (!user?.id || !q) return;
    setBookmarked(await toggleBookmark(user.id, q.id));
  };

  const handleQuizComplete = async (finalScore) => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Practice: pass with enough correct answers (pass mark by difficulty). Challenge: no mistakes
    // (wrong answers forgiven by a revive count as correct). Daily / mistakes / bookmarks: all correct.
    let passed;
    if (isChallenge) passed = questions.length > 0 && finalScore + revivesRef.current === questions.length;
    else if (isCustom) passed = questions.length > 0 && finalScore === questions.length;
    else passed = questions.length > 0 && finalScore / questions.length >= passMarkFor(difficulty);

    if (isCustom) {
      // Daily streak only counts when every question was answered (no skipping to farm streaks)
      if (mode === "daily" && user?.id && Object.keys(answers).length >= questions.length) {
        try { await completeDaily(user.id, finalScore, questions.length); } catch (e) { console.error(e); }
      }
      if (isChallenge && passed && user?.id) {
        try { await recordChallengeWin(user.id); } catch (e) { console.error(e); }
      }
      navigation.replace("QuizSummary", {
        mode,
        questions,
        answers: { ...answers, [q?.id]: selectedAnswer },
        score: finalScore,
        passed,
        user,
        totalQuestions: questions.length,
        category, subcategory, subject, difficulty, levelStart, levelEnd, levelNumber,
      });
      return;
    }

    const totalLevels = Math.max(1, Math.ceil(totalAvailableQuestions / gameSettings.questionsPerLevel));
    let difficultyCompleted = false;

    if (passed && user?.id) {
      try {
        const result = await markLevelPassed(
          user.id,
          category,
          subcategory,
          subject,
          difficulty,
          levelNumber || 1,
          totalLevels
        );
        difficultyCompleted = result.difficultyCompleted;
      } catch (error) {
        console.error("Error updating progress:", error);
      }
    }

    navigation.replace("QuizSummary", {
      questions,
      answers: { ...answers, [q?.id]: selectedAnswer },
      score: finalScore,
      passed,
      category,
      subcategory,
      subject,
      difficulty,
      user,
      totalQuestions: questions.length,
      levelStart,
      levelEnd,
      levelNumber,
      totalLevels,
      difficultyCompleted,
      passMark: passMarkFor(difficulty),
    });
  };

  const handleTimeout = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    Alert.alert(t("timeUpTitle"), t("timeUpMsg"), [
      { text: t("viewResults"), onPress: () => handleQuizComplete(score) }
    ]);
  };

  // Fire the timeout exactly once when the countdown reaches zero
  const timeoutHandledRef = useRef(false);
  useEffect(() => {
    if (timeLeft === 0 && questions.length > 0 && !timeoutHandledRef.current) {
      timeoutHandledRef.current = true;
      handleTimeout();
    }
  }, [timeLeft]);


  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t("loadingQuestions")}</Text>
      </View>
    );
  }

  if (!questions.length) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t("noQuestions")}</Text>
        <PressableScale style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{t("goBack")}</Text>
        </PressableScale>
      </View>
    );
  }

  if (!q) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t("noQuestions")}</Text>
      </View>
    );
  }

  const resetSession = () => {
    // Reshuffle pool and restart
    const newSession = shuffleArray(pool);
    setQuestions(newSession);
    setIndex(0);
    setAnswers({});
    setScore(0);
    setTimeLeft(totalTime);
    setShowExplanation(false);
    setSelectedAnswer(null);
    setIsCorrect(false);
  };

  const playShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const onSelect = (optId) => {
    if (showExplanation) return;

    if (timerRef.current) clearInterval(timerRef.current);

    const correct = q.correctOptionId;
    const isAnswerCorrect = optId === correct;

    recordAnswer(user?.id, q.id, isAnswerCorrect, mode !== "mistakes" && mode !== "bookmarks");

    setSelectedAnswer(optId);
    setIsCorrect(isAnswerCorrect);
    setAnswers(prev => ({ ...prev, [q.id]: optId }));

    if (isAnswerCorrect) {
      setScore(prev => prev + 1);
    } else {
      playShake();
    }

    setShowExplanation(true);
  };

  const handleExplanationClose = () => {
    setShowExplanation(false);

    const advance = () => {
      setIndex(i => i + 1);
      setSelectedAnswer(null);
      setIsCorrect(false);
    };
    const goNext = () => {
      if (index >= questions.length - 1) {
        handleQuizComplete(score);
        return;
      }
      // Challenge: a short pause between rounds
      const perRound = gameSettings.challengeQuestionsPerRound;
      if (isChallenge && (index + 1) % perRound === 0) {
        const round = (index + 1) / perRound;
        const rounds = Math.ceil(questions.length / perRound);
        Alert.alert(t("roundDoneTitle", { n: round }), t("roundDoneMsg", { n: round + 1, total: rounds }),
          [{ text: t("nextRound"), onPress: advance }], { cancelable: false });
        return;
      }
      advance();
    };

    if (isCorrect || !isChallenge) {
      // Correct answer, or any answer outside challenge mode (practice just keeps going and is graded at the end)
      goNext();
      return;
    }

    // Challenge: a wrong answer ends it, unless the player revives (max gameSettings.challengeRevives per challenge)
    const left = gameSettings.challengeRevives - revivesRef.current;
    const fail = () => handleQuizComplete(score);
    if (left <= 0) {
      Alert.alert(t("challengeFailTitle"), t("challengeFailMsg"), [{ text: t("viewResults"), onPress: fail }], { cancelable: false });
      return;
    }
    Alert.alert(
      t("reviveTitle"),
      t("reviveMsg", { n: left }),
      [
        { text: t("giveUp"), style: "cancel", onPress: fail },
        {
          text: t("reviveWatch"),
          onPress: async () => {
            const earned = await showRewardedAd();
            if (!earned) { fail(); return; }
            revivesRef.current += 1;
            goNext();
          },
        },
      ],
      { cancelable: false }
    );
  };

  const handleFinish = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    Alert.alert(
      t("finishConfirmTitle"),
      t("finishConfirmMsg", { a: index + 1, b: questions.length }),
      [
        { text: t("continueQuiz"), style: "cancel" },
        { text: t("finish"), onPress: () => handleQuizComplete(score) }
      ]
    );
  };

  // Timer shifts blue -> violet as time runs low (no red/yellow brand colors)
  const timeColor = timeLeft <= 60 ? colors.accent : colors.primary;
  const timeBg = timeLeft <= 60 ? colors.accentTint : colors.tint;

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const optionState = (optionId) => {
    if (!showExplanation) return "idle";
    if (optionId === q.correctOptionId) return "correct";
    if (optionId === selectedAnswer) return "wrong";
    return "neutral";
  };

  const percent = Math.round(((index + 1) / questions.length) * 100);

  const mainContent = (
    <View style={styles.container}>
      <View style={styles.headerInfo}>
        <View style={styles.counterRow}>
          <Text style={styles.questionCounter}>
            {t("questionOf", { a: index + 1, b: questions.length })}
          </Text>
          {USE_SERVER && !!user?.id && (
            <PressableScale onPress={() => setReportOpen(true)} style={styles.starBtn} accessibilityLabel={t("reportQuestion")}>
              <Ionicons name="flag-outline" size={22} color={colors.muted} />
            </PressableScale>
          )}
          <PressableScale onPress={handleBookmark} style={styles.starBtn} accessibilityLabel={t("bookmarks")}>
            <Ionicons
              name={bookmarked ? "star" : "star-outline"}
              size={24}
              color={bookmarked ? colors.accent : colors.muted}
            />
          </PressableScale>
        </View>
        {!showExplanation && timeLeft !== null && (
          <View style={[styles.timerPill, { backgroundColor: timeBg }]}>
            <Ionicons name="time-outline" size={16} color={timeColor} />
            <Text style={[styles.timer, { color: timeColor }]}>{formatTime(timeLeft)}</Text>
          </View>
        )}
      </View>

      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <View style={styles.reportBackdrop}>
          <View style={styles.reportSheet}>
            <Text style={styles.reportTitle}>{t("reportTitle")}</Text>
            {REPORT_REASONS.map((r) => (
              <PressableScale key={r.id} style={styles.reportOption} onPress={() => submitReport(r.id)}>
                <Text style={styles.reportOptionText}>{t(r.key)}</Text>
              </PressableScale>
            ))}
            <PressableScale style={styles.reportCancel} onPress={() => setReportOpen(false)}>
              <Text style={styles.reportCancelText}>{t("cancel")}</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.progressText}>{t("percentComplete", { n: percent })}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.questionContainer,
            { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] },
          ]}
        >
          <Text style={styles.questionText}>{q.questionText}</Text>
        </Animated.View>

        <View style={styles.optionsContainer}>
          {q.options && q.options.map && q.options.map(option => {
            const state = optionState(option.id);
            return (
              <PressableScale
                key={option.id}
                onPress={() => onSelect(option.id)}
                disabled={showExplanation}
                style={[
                  styles.optionButton,
                  state === "correct" && styles.correctOption,
                  state === "wrong" && styles.wrongOption,
                  state === "neutral" && styles.neutralOption,
                ]}
              >
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionId,
                      state === "correct" && { backgroundColor: colors.success, color: "#FFFFFF" },
                      state === "wrong" && { backgroundColor: colors.danger, color: "#FFFFFF" },
                    ]}
                  >
                    {option.id.toUpperCase()}
                  </Text>
                  <Text style={styles.optionText}>{option.text}</Text>
                  {state === "correct" && <Ionicons name="checkmark-circle" size={24} color={colors.success} />}
                  {state === "wrong" && <Ionicons name="close-circle" size={24} color={colors.danger} />}
                </View>
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bottomSection}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{t("scoreLabel", { a: score, b: questions.length })}</Text>
          <Text style={styles.accuracyText}>
            {t("accuracyLabel", { n: index > 0 ? Math.round((score / (index + 1)) * 100) : 0 })}
          </Text>
        </View>
        {!isCustom ? <Text style={styles.hintText}>{t("oneWrongHint")}</Text> : mode === "daily" ? <Text style={styles.hintText}>{t("dailyAllNote")}</Text> : null}

        {!showExplanation && (
          <PressableScale onPress={handleFinish} style={styles.finishButton}>
            <Text style={styles.finishButtonText}>{t("finishQuiz")}</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );

  const correctText = q.options?.find(opt => opt.id === q.correctOptionId)?.text || "N/A";
  const resultColor = isCorrect ? colors.success : colors.danger;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title={isCustom ? t(mode === "daily" ? "dailyChallenge" : mode) : `${subcategory}${subject ? ` - ${subject}` : ''} | ${difficulty}${levelNumber ? ` | L${levelNumber}` : ''}`}
        onBack={() => {
          if (timerRef.current) clearInterval(timerRef.current);
          navigation.goBack();
        }}
      />

      {backgroundImage ? (
        <ImageBackground
          source={{ uri: backgroundImage }}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View
            style={[
              styles.backgroundOverlay,
              { backgroundColor: `rgba(244, 249, 248, ${backgroundOpacity || 0.85})` }
            ]}
          />
          {mainContent}
        </ImageBackground>
      ) : (
        <View style={styles.defaultBackground}>{mainContent}</View>
      )}

      <Modal
        visible={showExplanation}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}} // Prevent closing with back button
      >
        <View style={styles.modalOverlay}>
          <View style={styles.explanationModal}>
            <View style={styles.resultHeader}>
              <Ionicons
                name={isCorrect ? "checkmark-circle" : "close-circle"}
                size={56}
                color={resultColor}
              />
              <Text style={[styles.resultText, { color: resultColor }]}>
                {isCorrect ? t("correctTitle") : t("wrongTitle")}
              </Text>
            </View>

            <View style={styles.correctAnswerContainer}>
              <Text style={styles.correctAnswerLabel}>{t("correctAnswer")}</Text>
              <Text style={styles.correctAnswerText}>{correctText}</Text>
            </View>

            {q.explanation && (
              <View style={styles.explanationContainer}>
                <Text style={styles.explanationLabel}>{t("explanation")}</Text>
                <Text style={styles.explanationText}>{q.explanation}</Text>
              </View>
            )}

            <PressableScale
              style={[styles.continueButton, { backgroundColor: isCorrect || isCustom ? colors.primary : colors.danger }]}
              onPress={handleExplanationClose}
            >
              <Text style={styles.continueButtonText}>
                {isCorrect || isCustom ? (index < questions.length - 1 ? t("nextQuestion") : t("completeQuiz")) : t("tryAgain")}
              </Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, zIndex: 2 },
  defaultBackground: { flex: 1, backgroundColor: colors.bg },
  backgroundImage: { flex: 1, width: "100%", height: "100%" },
  backgroundOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  loadingContainer: {
    flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: colors.bg,
  },
  loadingText: { fontSize: 16, color: colors.muted, marginBottom: 20 },
  backButton: { backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
  backButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  headerInfo: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, zIndex: 2,
  },
  questionCounter: { fontSize: 16, fontWeight: "700", color: colors.ink },
  counterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  starBtn: { padding: 4 },
  reportBackdrop: { flex: 1, backgroundColor: "rgba(11,42,51,0.5)", justifyContent: "center", padding: 24 },
  reportSheet: { backgroundColor: colors.surface, borderRadius: 18, padding: 20 },
  reportTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 12, textAlign: "center" },
  reportOption: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.bg, marginBottom: 8 },
  reportOptionText: { fontSize: 16, color: colors.ink, fontWeight: "600" },
  reportCancel: { paddingVertical: 12, alignItems: "center", marginTop: 4 },
  reportCancelText: { fontSize: 16, color: colors.muted, fontWeight: "600" },
  timerPill: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  timer: { fontSize: 17, fontWeight: "700" },
  progressBarContainer: { marginBottom: 16, zIndex: 2 },
  progressBar: { height: 8, backgroundColor: colors.track, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
  progressText: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 4 },
  questionContainer: {
    backgroundColor: colors.surface, padding: 20, borderRadius: 18, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border, ...shadow,
  },
  questionText: { fontSize: 19, lineHeight: 30, color: colors.ink, textAlign: "center", fontFamily: fonts.headingSemi },
  optionsContainer: { paddingBottom: 8 },
  optionButton: {
    backgroundColor: colors.surface, borderRadius: 16, marginBottom: 10, padding: 14,
    borderWidth: 2, borderColor: colors.border, ...shadow,
  },
  correctOption: { borderColor: colors.success, backgroundColor: colors.successTint },
  wrongOption: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  neutralOption: { opacity: 0.55 },
  optionContent: { flexDirection: "row", alignItems: "center" },
  optionId: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tint, color: colors.primary,
    textAlign: "center", lineHeight: 34, fontSize: 16, fontWeight: "bold", marginRight: 12, overflow: "hidden",
  },
  optionText: { flex: 1, fontSize: 16, color: colors.ink, lineHeight: 24 },
  bottomSection: { paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, zIndex: 2 },
  scoreContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  scoreText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  accuracyText: { fontSize: 15, fontWeight: "600", color: colors.muted },
  hintText: { fontSize: 12, color: colors.muted, marginBottom: 10 },
  finishButton: {
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary,
    padding: 13, borderRadius: 999, alignItems: "center",
  },
  finishButtonText: { color: colors.primary, fontSize: 16, fontWeight: "bold" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(11, 42, 51, 0.55)", justifyContent: "center", alignItems: "center", padding: 20,
  },
  explanationModal: {
    backgroundColor: colors.surface, borderRadius: 24, padding: 24, width: "100%", maxWidth: 400, ...shadow, elevation: 8,
  },
  resultHeader: { alignItems: "center", marginBottom: 18 },
  resultText: { fontSize: 24, marginTop: 6, fontFamily: fonts.heading },
  correctAnswerContainer: {
    backgroundColor: colors.tint, padding: 16, borderRadius: 14, marginBottom: 14,
    borderLeftWidth: 4, borderLeftColor: colors.primary,
  },
  correctAnswerLabel: { fontSize: 14, fontWeight: "700", color: colors.primary, marginBottom: 4 },
  correctAnswerText: { fontSize: 16, color: colors.ink, lineHeight: 24 },
  explanationContainer: { backgroundColor: colors.bg, padding: 16, borderRadius: 14, marginBottom: 18 },
  explanationLabel: { fontSize: 14, fontWeight: "700", color: colors.muted, marginBottom: 8 },
  explanationText: { fontSize: 15, color: colors.ink, lineHeight: 24 },
  continueButton: { padding: 15, borderRadius: 999, alignItems: "center" },
  continueButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});
