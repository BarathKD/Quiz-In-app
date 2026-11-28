/*
  QuizScreen.js - the question screen. Used for all quiz types: level practice, daily, mistakes, bookmarks, challenge.
  Route params: category, subcategory, subject, difficulty, user, levelStart, levelEnd, levelNumber,
    mode (undefined = normal level practice, or "daily" | "mistakes" | "bookmarks" | "challenge").
  Comes from: LevelsScreen (levels) or the home screen (daily, mistakes, bookmarks).
  Goes to: QuizSummaryScreen (navigation.replace), so Back from the summary does not return to the quiz.
  Data: only from utils/api.js (server or local, chosen there by USE_SERVER). Texts: t() from utils/i18n.js.
  Where is X done?
    loading questions      loadQuestions()        timer countdown   the effect with setInterval
    answer click           onSelect()             next / revive     handleExplanationClose()
    pass or fail, saving   handleQuizComplete()   report question   submitReport()
    bookmark star          handleBookmark()       screen layout     mainContent and the final return
*/
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

// shuffleArray(arr): returns a new array in random order. The original array is not changed.
/** Utility shuffle (Fisher-Yates) */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// QuizScreen: receives navigation and route from React Navigation.
export default function QuizScreen({ navigation, route }) {
  // --- Route params and mode flags ---
  // mode: undefined = normal level quiz; "daily" | "mistakes" | "bookmarks" = custom practice
  const { category, subcategory, difficulty, user, subject, levelStart, levelEnd, levelNumber, mode } = route.params;
  // isCustom: any mode except normal level practice. isChallenge: the timed challenge (rounds, revives).
  const isCustom = !!mode;
  const isChallenge = mode === "challenge";
  // --- Refs (values that do not cause re-render and are never stale inside timers and alerts) ---
  const revivesRef = useRef(0); // wrong answers forgiven by watching an ad (challenge only)
  // --- State: bookmark star and report modal ---
  const [bookmarked, setBookmarked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // t(): translate a text key to the current language (utils/i18n.js).
  const { t } = useLang();
  // shake: animated value for the shake effect on a wrong answer (see playShake).
  const shake = useRef(new Animated.Value(0)).current;
  // --- State: questions and progress ---
  // pool = all questions of this quiz (used to restart). questions = the shuffled list shown now. index = current question.
  const [pool, setPool] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  // answers = {questionId: chosen option id}. score = number of correct answers so far.
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  // --- State: timer (seconds). timeLeft stays null until the time is known, so the countdown does not start too early ---
  const [timeLeft, setTimeLeft] = useState(null); // Wait for category data to set time
  const [totalTime, setTotalTime] = useState(300); // Default to 5 minutes
  // --- State: answer popup (explanation modal) ---
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  // totalAvailableQuestions: count of questions for this category and difficulty. Used to find how many levels exist.
  const [totalAvailableQuestions, setTotalAvailableQuestions] = useState(0);
  // isLoading: true while loadQuestions() is running.
  const [isLoading, setIsLoading] = useState(true);
  
  // --- State: category background image (not used in custom modes) ---
  // New state for background image
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.3);
  const [categoryData, setCategoryData] = useState(null);
  
  // timerRef holds the setInterval id so we can stop the countdown from any function.
  const timerRef = useRef(null);

  // On first open: load the questions and the background. On close: stop the timer so it does not keep running.
  useEffect(() => {
    loadQuestions();
    if (!isCustom) loadCategoryBackground();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

 // loadCategoryBackground(): gets the category (utils/api.js), then its image, opacity and quiz time. Sets the timer for normal level quizzes.
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

  // loadQuestions(): builds the list of questions for this quiz.
  // Custom modes: daily, challenge, mistakes, bookmarks. Normal mode: filter by category/subcategory/subject/difficulty, then cut the level range.
  // Load questions with proper subject filtering
  const loadQuestions = async () => {
    try {
      setIsLoading(true);

      // Custom modes (daily, challenge, mistakes, bookmarks)
      if (isCustom) {
        let list = [];
        // Daily: questions and time come from api.js getDailyQuestions and gameSettings.dailyTimerMinutes.
        if (mode === "daily") {
          list = await getDailyQuestions();
          const dailySeconds = gameSettings.dailyTimerMinutes * 60;
          setTotalTime(dailySeconds);
          setTimeLeft(dailySeconds);
        } else if (isChallenge) {
          // Challenge rules: total time = number of questions x seconds per question (by difficulty).

          // Random questions out of this level's questions: rounds x questions per round (fewer if the level is small)
          const levelQs = (await getQuestionsByFilter(category, subcategory, subject || null, difficulty))
            .slice(levelStart, levelEnd);
          const wanted = gameSettings.challengeRounds * gameSettings.challengeQuestionsPerRound;
          list = shuffleArray(levelQs).slice(0, wanted);
          const seconds = Math.max(1, list.length) * challengeSecondsFor(difficulty);
          setTotalTime(seconds);
          setTimeLeft(seconds);
        } else {
          // Mistakes or bookmarks: load saved question ids, then the questions. No timer (practice).

          const ids = mode === "mistakes" ? await getMistakeIds(user?.id) : await getBookmarkIds(user?.id);
          list = shuffleArray(await getQuestionsByIds(ids)); // practice is untimed
        }
        // No questions: tell the user and go back.
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

      // Normal level quiz: load all questions, then filter.
      const all = await getAllQuestions();
      
      console.log("=== QUIZ LOADING DEBUG ===");
      console.log("Total questions in database:", all.length);
      console.log("Looking for:", { category, subcategory, subject, difficulty });
      console.log("Level range:", { levelStart, levelEnd, levelNumber });
      
      // Question must match category, subcategory, difficulty and subject. No subject given = only questions without subject.
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

      // A level is a slice of the filtered list (levelStart to levelEnd). Same slice is used in LevelsScreen.
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

      // Shuffle so the order is different each time. pool keeps the original level list for resetSession().
      // Shuffle the level's questions
      setPool(filtered);
      const sessionQs = shuffleArray(filtered);
      setQuestions(sessionQs);
      setIndex(0);
      setAnswers({});
      setScore(0);
      // Removed setTimeLeft(300) so it uses the fetched category timer
      
      console.log(`Quiz session created with ${sessionQs.length} questions`);
    // Any error: show a message and go back.
    } catch (error) {
      console.error("Error loading questions:", error);
      Alert.alert(t("error"), t("failedLoadQuestions"), [
        { text: t("lockedOk"), onPress: () => navigation.goBack() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // isTimerInitialized: true after the time was set (category timer or custom mode time).
  const isTimerInitialized = timeLeft !== null;
  
  // Timer effect: starts a 1 second countdown. It pauses while the answer popup is open or while loading, and restarts for each question.
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

  // q = the current question object.
  const q = questions[index];

  // Bookmark effect: for each new question, check if it is already bookmarked. 'active' stops a late result from an old question.
  useEffect(() => {
    let active = true;
    setBookmarked(false);
    if (q?.id && user?.id) {
      getBookmarkIds(user.id).then((ids) => active && setBookmarked(ids.includes(q.id)));
    }
    return () => { active = false; };
  }, [q?.id, user?.id]);

  // Reasons shown in the report modal. key = text key in i18n.js, id = value sent to the server.
  const REPORT_REASONS = [
    { id: "wrong_answer", key: "reportWrongAnswer" },
    { id: "typo", key: "reportTypo" },
    { id: "unclear", key: "reportUnclear" },
    { id: "other", key: "reportOther" },
  ];

  // submitReport(reason): sends a report about the current question to the server (api.js reportQuestion). Shows a thank-you or error.
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

  // handleBookmark(): toggles the star for this question (needs a logged-in user). Saved by api.js toggleBookmark.
  const handleBookmark = async () => {
    if (!user?.id || !q) return;
    setBookmarked(await toggleBookmark(user.id, q.id));
  };

  // handleQuizComplete(finalScore): the end of the quiz. Decides pass or fail, saves progress, then opens QuizSummary.
  // finalScore is passed in (not read from state) so we never use an old score.
  const handleQuizComplete = async (finalScore) => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Pass rules are below. They are different for each mode.
    // Practice: pass with enough correct answers (pass mark by difficulty). Challenge: no mistakes
    // (wrong answers forgiven by a revive count as correct). Daily / mistakes / bookmarks: all correct.
    let passed;
    if (isChallenge) passed = questions.length > 0 && finalScore + revivesRef.current === questions.length;
    else if (isCustom) passed = questions.length > 0 && finalScore === questions.length;
    else passed = questions.length > 0 && finalScore / questions.length >= passMarkFor(difficulty);

    // Custom modes: save the daily result or challenge win, then go to the summary.
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

    // Normal level quiz: calculate the number of levels and save progress (markLevelPassed) if passed.
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

    // Go to the summary. The last answer is added here because setAnswers may not be finished yet.
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

  // handleTimeout(): time is over. Show an alert, then finish the quiz with the current score.
  const handleTimeout = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    Alert.alert(t("timeUpTitle"), t("timeUpMsg"), [
      { text: t("viewResults"), onPress: () => handleQuizComplete(score) }
    ]);
  };

  // timeoutHandledRef: makes sure the time-up alert is shown only once.
  // Fire the timeout exactly once when the countdown reaches zero
  const timeoutHandledRef = useRef(false);
  useEffect(() => {
    if (timeLeft === 0 && questions.length > 0 && !timeoutHandledRef.current) {
      timeoutHandledRef.current = true;
      handleTimeout();
    }
  }, [timeLeft]);


  // --- Early returns: loading, no questions, no current question ---
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

  // resetSession(): reshuffle the pool and start again from the first question. Time is set back to the full time.
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

  // playShake(): short left-right animation when the answer is wrong.
  const playShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // onSelect(optId): user taps an option. Stops the timer, checks the answer, saves it (api.js recordAnswer), updates score, opens the answer popup.
  // Tap is ignored if the popup is already open (double tap).
  const onSelect = (optId) => {
    if (showExplanation) return;

    if (timerRef.current) clearInterval(timerRef.current);

    const correct = q.correctOptionId;
    const isAnswerCorrect = optId === correct;

    // 4th value = true only for normal, daily and challenge modes. Mistakes and bookmarks practice do not change the mistake list.
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

  // handleExplanationClose(): user taps the button in the answer popup. Goes to the next question, or finishes, or (challenge) asks for a revive.
  const handleExplanationClose = () => {
    setShowExplanation(false);

    // advance(): show the next question.
    const advance = () => {
      setIndex(i => i + 1);
      setSelectedAnswer(null);
      setIsCorrect(false);
    };
    // goNext(): finish if this was the last question, show a round break in challenge mode, or advance.
    const goNext = () => {
      if (index >= questions.length - 1) {
        handleQuizComplete(score);
        return;
      }
      // Challenge has rounds. After each round (every challengeQuestionsPerRound questions) show a short alert.
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

    // Correct answer, or practice mode: just continue.
    if (isCorrect || !isChallenge) {
      // Correct answer, or any answer outside challenge mode (practice just keeps going and is graded at the end)
      goNext();
      return;
    }

    // Challenge revive logic: a wrong answer ends the challenge unless a revive is left. A revive needs a rewarded ad (utils/ads.js).
    // revivesRef counts revives used. If the ad is not completed, the challenge fails.
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

  // handleFinish(): user taps Finish. Asks to confirm, then calls handleQuizComplete.
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

  // --- Helpers for rendering ---
  // Timer colour: changes when 60 seconds or less are left.
  // Timer shifts blue -> violet as time runs low (no red/yellow brand colors)
  const timeColor = timeLeft <= 60 ? colors.accent : colors.primary;
  const timeBg = timeLeft <= 60 ? colors.accentTint : colors.tint;

  // formatTime(seconds): 125 becomes "2:05".
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // optionState(optionId): colour state of an option: idle (before answer), correct, wrong (the one the user chose), neutral (others).
  const optionState = (optionId) => {
    if (!showExplanation) return "idle";
    if (optionId === q.correctOptionId) return "correct";
    if (optionId === selectedAnswer) return "wrong";
    return "neutral";
  };

  // percent: progress bar value. Counts the current question as done.
  const percent = Math.round(((index + 1) / questions.length) * 100);

  // mainContent: the quiz area (counter, timer, progress, question, options, score, finish button). Shown inside the background.
  const mainContent = (
    <View style={styles.container}>
      {/* Top row: question number, report button (server mode only), bookmark star, timer */}
      <View style={styles.headerInfo}>
        <View style={styles.counterRow}>
          <Text style={styles.questionCounter}>
            {t("questionOf", { a: index + 1, b: questions.length })}
          </Text>
          {/* Report flag: only in server mode and for logged-in users */}
          {USE_SERVER && !!user?.id && (
            <PressableScale onPress={() => setReportOpen(true)} style={styles.starBtn} accessibilityLabel={t("reportQuestion")}>
              <Ionicons name="flag-outline" size={22} color={colors.muted} />
            </PressableScale>
          )}
          {/* Bookmark star */}
          <PressableScale onPress={handleBookmark} style={styles.starBtn} accessibilityLabel={t("bookmarks")}>
            <Ionicons
              name={bookmarked ? "star" : "star-outline"}
              size={24}
              color={bookmarked ? colors.accent : colors.muted}
            />
          </PressableScale>
        </View>
        {/* Timer pill: hidden while the answer popup is open */}
        {!showExplanation && timeLeft !== null && (
          <View style={[styles.timerPill, { backgroundColor: timeBg }]}>
            <Ionicons name="time-outline" size={16} color={timeColor} />
            <Text style={[styles.timer, { color: timeColor }]}>{formatTime(timeLeft)}</Text>
          </View>
        )}
      </View>

      {/* Report question modal: user picks a reason, then submitReport() runs */}
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

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.progressText}>{t("percentComplete", { n: percent })}</Text>
      </View>

      {/* Question text and options. The question box shakes on a wrong answer */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.questionContainer,
            { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] },
          ]}
        >
          <Text style={styles.questionText}>{q.questionText}</Text>
        </Animated.View>

        {/* Option buttons. Tap calls onSelect(); style comes from optionState() */}
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

      {/* Bottom: score, accuracy, hint text, finish button */}
      <View style={styles.bottomSection}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{t("scoreLabel", { a: score, b: questions.length })}</Text>
          <Text style={styles.accuracyText}>
            {t("accuracyLabel", { n: index > 0 ? Math.round((score / (index + 1)) * 100) : 0 })}
          </Text>
        </View>
        {/* Hint: normal level quiz shows the pass rule; daily shows a note that all questions must be answered */}
        {!isCustom ? <Text style={styles.hintText}>{t("oneWrongHint")}</Text> : mode === "daily" ? <Text style={styles.hintText}>{t("dailyAllNote")}</Text> : null}

        {!showExplanation && (
          <PressableScale onPress={handleFinish} style={styles.finishButton}>
            <Text style={styles.finishButtonText}>{t("finishQuiz")}</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );

  // --- Values for the answer popup ---
  const correctText = q.options?.find(opt => opt.id === q.correctOptionId)?.text || "N/A";
  const resultColor = isCorrect ? colors.success : colors.danger;

  // --- Final screen layout: header, background with mainContent, answer popup ---
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header with title and back button. Back also stops the timer */}
      <Header
        title={isCustom ? t(mode === "daily" ? "dailyChallenge" : mode) : `${subcategory}${subject ? ` - ${subject}` : ''} | ${difficulty}${levelNumber ? ` | L${levelNumber}` : ''}`}
        onBack={() => {
          if (timerRef.current) clearInterval(timerRef.current);
          navigation.goBack();
        }}
      />

      {/* Background: category image with a light overlay, or a plain colour if there is no image */}
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

      {/* Answer popup: shows right or wrong, the correct answer and the explanation. Cannot be closed with the phone back button */}
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

// Styles. Order: layout, report modal, header, progress, question and options, bottom, answer popup.
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
