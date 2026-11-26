import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/header";
import PressableScale from "../components/PressableScale";
import { getQuestionsByFilter, recordAnswer, submitExam, gameSettings } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, fonts, shadow } from "../utils/theme";

const pad = (n) => String(n).padStart(2, "0");
const clock = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const round2 = (n) => Math.round(n * 100) / 100;

// Mock test: random questions of every difficulty, one timer, negative marking, answers shown only at the end.
export default function ExamScreen({ navigation, route }) {
  const { category, subcategory, subject, user } = route.params;
  const { t } = useLang();

  const [phase, setPhase] = useState("loading"); // loading | empty | intro | test | result
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // questionId -> optionId
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [result, setResult] = useState(null);

  const phaseRef = useRef("loading");
  const answersRef = useRef({});
  const questionsRef = useRef([]);
  const endAtRef = useRef(0);
  const startedRef = useRef(0);
  const submittedRef = useRef(false);

  const goPhase = (p) => { phaseRef.current = p; setPhase(p); };

  const prepare = useCallback(async () => {
    goPhase("loading");
    try {
      const all = await getQuestionsByFilter(category, subcategory, subject || null);
      const picked = shuffle(all).slice(0, gameSettings.examQuestionCount);
      questionsRef.current = picked;
      setQuestions(picked);
      goPhase(picked.length === 0 ? "empty" : "intro");
    } catch (error) {
      console.warn("Exam load failed:", error);
      questionsRef.current = [];
      setQuestions([]);
      goPhase("empty");
    }
  }, [category, subcategory, subject]);

  useEffect(() => { prepare(); }, [prepare]);

  const start = () => {
    answersRef.current = {};
    setAnswers({});
    setIndex(0);
    setResult(null);
    submittedRef.current = false;
    startedRef.current = Date.now();
    endAtRef.current = Date.now() + gameSettings.examMinutes * 60 * 1000;
    setRemaining(gameSettings.examMinutes * 60);
    goPhase("test");
  };

  const finish = useCallback(async (timeUp) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setPaletteOpen(false);

    const list = questionsRef.current;
    const given = answersRef.current;
    let correct = 0;
    let wrong = 0;
    for (const q of list) {
      if (!given[q.id]) continue;
      if (given[q.id] === q.correctOptionId) correct += 1; else wrong += 1;
    }
    const total = list.length;
    const score = Math.max(0, round2(correct - (wrong * gameSettings.examNegativePercent) / 100));
    const percent = total ? Math.round((score * 100) / total) : 0;
    const seconds = Math.round((Date.now() - startedRef.current) / 1000);
    setResult({
      total, correct, wrong, unanswered: total - correct - wrong, score, percent,
      passed: percent >= gameSettings.examPassMark, seconds, rank: null, participants: null, timeUp: !!timeUp,
    });
    goPhase("result");
    if (timeUp) Alert.alert(t("examTimeUpTitle"), t("examTimeUp"));

    // Save to the account (rank comes back from the server). Works offline: the result is queued.
    if (user?.id) {
      try {
        const server = await submitExam(
          user.id,
          list.map((q) => ({ questionId: q.id, optionId: given[q.id] || null })),
          seconds,
        );
        if (server) {
          setResult((r) => ({ ...r, score: server.score, percent: server.percent, passed: server.passed, rank: server.rank, participants: server.participants }));
        }
      } catch (error) {
        console.warn("Exam submit failed:", error);
      }
      // Missed questions go to "My mistakes"; right ones come off it
      for (const q of list) {
        if (!given[q.id]) continue;
        await recordAnswer(user.id, q.id, given[q.id] === q.correctOptionId);
      }
    }
  }, [t, user?.id]);

  // Clock: based on the end time, so it stays right if the app sleeps in the background.
  useEffect(() => {
    if (phase !== "test") return undefined;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) finish(true);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, finish]);

  // Leaving in the middle of a test asks first
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (phaseRef.current !== "test" || submittedRef.current) return;
      e.preventDefault();
      Alert.alert(t("examLeaveTitle"), t("examLeaveMsg"), [
        { text: t("examStay"), style: "cancel" },
        { text: t("examLeave"), style: "destructive", onPress: () => { submittedRef.current = true; navigation.dispatch(e.data.action); } },
      ]);
    });
    return unsubscribe;
  }, [navigation, t]);

  const pick = (q, optionId) => {
    const next = { ...answersRef.current };
    if (next[q.id] === optionId) delete next[q.id]; else next[q.id] = optionId;
    answersRef.current = next;
    setAnswers(next);
  };

  const askSubmit = () => {
    const left = questions.length - Object.keys(answersRef.current).length;
    Alert.alert(t("examSubmit"), left > 0 ? t("examSubmitLeft", { n: left }) : t("examSubmitAll"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("examSubmit"), onPress: () => finish(false) },
    ]);
  };

  const title = `${subcategory}${subject ? ` - ${subject}` : ""}`;

  // ---------- screens ----------
  if (phase === "loading") {
    return (
      <View style={styles.container}>
        <Header title={t("examTitle")} onBack={() => navigation.goBack()} />
        <View style={styles.center}><Text style={styles.muted}>{t("pleaseWait")}</Text></View>
      </View>
    );
  }

  if (phase === "empty") {
    return (
      <View style={styles.container}>
        <Header title={t("examTitle")} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={56} color={colors.muted} />
          <Text style={[styles.muted, { marginTop: 10 }]}>{t("examNoQuestions")}</Text>
        </View>
      </View>
    );
  }

  if (phase === "intro") {
    const rows = [
      ["help-circle-outline", t("examInfoQuestions", { n: questions.length })],
      ["time-outline", t("examInfoTime", { n: gameSettings.examMinutes })],
      ["remove-circle-outline", gameSettings.examNegativePercent > 0 ? t("examInfoNegative", { p: gameSettings.examNegativePercent }) : t("examInfoNoNegative")],
      ["ribbon-outline", t("examInfoPass", { p: gameSettings.examPassMark })],
      ["eye-off-outline", t("examInfoNoAnswers")],
    ];
    return (
      <View style={styles.container}>
        <Header title={t("examTitle")} onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Ionicons name="school" size={52} color="#FFFFFF" />
            <Text style={styles.heroTitle}>{t("examTitle")}</Text>
            <Text style={styles.heroSub}>{title}</Text>
          </View>
          <View style={styles.card}>
            {rows.map(([icon, text]) => (
              <View key={icon} style={styles.infoRow}>
                <Ionicons name={icon} size={22} color={colors.primary} />
                <Text style={styles.infoText}>{text}</Text>
              </View>
            ))}
          </View>
          <PressableScale style={styles.primaryBtn} onPress={start}>
            <Ionicons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.primaryText}>{t("examStart")}</Text>
          </PressableScale>
        </ScrollView>
      </View>
    );
  }

  if (phase === "test") {
    const q = questions[index];
    const low = remaining <= 60;
    return (
      <View style={styles.container}>
        <Header title={t("examTitle")} onBack={() => navigation.goBack()} />
        <View style={styles.topBar}>
          <Text style={styles.qCount}>{t("examQ", { n: index + 1, total: questions.length })}</Text>
          <View style={[styles.timer, low && styles.timerLow]}>
            <Ionicons name="time-outline" size={16} color={low ? colors.danger : colors.primaryDark} />
            <Text style={[styles.timerText, low && { color: colors.danger }]}>{clock(remaining)}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.question}>{q.questionText}</Text>
          </View>
          {q.options.map((o, i) => {
            const chosen = answers[q.id] === o.id;
            return (
              <PressableScale key={o.id} style={[styles.option, chosen && styles.optionOn]} onPress={() => pick(q, o.id)}>
                <View style={[styles.letter, chosen && styles.letterOn]}>
                  <Text style={[styles.letterText, chosen && { color: "#FFFFFF" }]}>{String.fromCharCode(65 + i)}</Text>
                </View>
                <Text style={[styles.optionText, chosen && { fontWeight: "700" }]}>{o.text}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
        <View style={styles.bottom}>
          <PressableScale style={[styles.navBtn, index === 0 && { opacity: 0.4 }]} onPress={() => index > 0 && setIndex(index - 1)}>
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          </PressableScale>
          <PressableScale style={styles.navBtn} onPress={() => setPaletteOpen(true)}>
            <Ionicons name="grid-outline" size={22} color={colors.primaryDark} />
            <Text style={styles.navText}>{Object.keys(answers).length}/{questions.length}</Text>
          </PressableScale>
          {index < questions.length - 1 ? (
            <PressableScale style={[styles.navBtn, styles.navBtnMain]} onPress={() => setIndex(index + 1)}>
              <Text style={styles.navTextMain}>{t("examNext")}</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </PressableScale>
          ) : (
            <PressableScale style={[styles.navBtn, styles.navBtnMain]} onPress={askSubmit}>
              <Text style={styles.navTextMain}>{t("examSubmit")}</Text>
            </PressableScale>
          )}
        </View>

        <Modal visible={paletteOpen} transparent animationType="slide" onRequestClose={() => setPaletteOpen(false)}>
          <View style={styles.modalBack}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t("examPalette")}</Text>
              <ScrollView contentContainerStyle={styles.grid}>
                {questions.map((qq, i) => (
                  <PressableScale
                    key={qq.id}
                    style={[styles.cell, answers[qq.id] && styles.cellDone, i === index && styles.cellNow]}
                    onPress={() => { setIndex(i); setPaletteOpen(false); }}
                  >
                    <Text style={[styles.cellText, answers[qq.id] && { color: "#FFFFFF" }]}>{i + 1}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
              <View style={styles.modalActions}>
                <PressableScale style={styles.secondaryBtn} onPress={() => setPaletteOpen(false)}>
                  <Text style={styles.secondaryText}>{t("examBackToTest")}</Text>
                </PressableScale>
                <PressableScale style={styles.primaryBtnSmall} onPress={() => { setPaletteOpen(false); askSubmit(); }}>
                  <Text style={styles.primaryText}>{t("examSubmit")}</Text>
                </PressableScale>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // result
  const r = result;
  return (
    <View style={styles.container}>
      <Header title={t("examResult")} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: r.passed ? colors.success : colors.primaryDark }]}>
          <Ionicons name={r.passed ? "trophy" : "ribbon"} size={50} color="#FFFFFF" />
          <Text style={styles.heroTitle}>{r.passed ? t("examPassed") : t("examFailed")}</Text>
          <Text style={styles.bigScore}>{r.score} / {r.total}</Text>
          <Text style={styles.heroSub}>{r.percent}%</Text>
          {r.rank ? <Text style={styles.rank}>{t("examRank", { r: r.rank, n: r.participants })}</Text> : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={[styles.statNum, { color: colors.success }]}>{r.correct}</Text><Text style={styles.statLabel}>{t("examCorrect")}</Text></View>
          <View style={styles.stat}><Text style={[styles.statNum, { color: colors.danger }]}>{r.wrong}</Text><Text style={styles.statLabel}>{t("examWrong")}</Text></View>
          <View style={styles.stat}><Text style={styles.statNum}>{r.unanswered}</Text><Text style={styles.statLabel}>{t("examSkipped")}</Text></View>
          <View style={styles.stat}><Text style={styles.statNum}>{clock(r.seconds)}</Text><Text style={styles.statLabel}>{t("examTimeTaken")}</Text></View>
        </View>

        <Text style={styles.sectionTitle}>{t("examReview")}</Text>
        {questions.map((q, i) => {
          const mine = answers[q.id];
          const right = mine === q.correctOptionId;
          const mineText = q.options.find((o) => o.id === mine)?.text;
          const correctText = q.options.find((o) => o.id === q.correctOptionId)?.text;
          return (
            <View key={q.id} style={[styles.reviewCard, { borderLeftColor: !mine ? colors.locked : right ? colors.success : colors.danger }]}>
              <Text style={styles.reviewQ}>{i + 1}. {q.questionText}</Text>
              <Text style={[styles.reviewA, { color: !mine ? colors.muted : right ? colors.success : colors.danger }]}>
                {mine ? `${t("examYourAnswer")}: ${mineText}` : t("examNotAnswered")}
              </Text>
              {!right ? <Text style={[styles.reviewA, { color: colors.success }]}>{t("examCorrectAnswer")}: {correctText}</Text> : null}
              {q.explanation ? <Text style={styles.reviewExp}>{q.explanation}</Text> : null}
            </View>
          );
        })}

        <PressableScale style={styles.primaryBtn} onPress={prepare}>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.primaryText}>{t("examAgain")}</Text>
        </PressableScale>
        <PressableScale style={[styles.secondaryBtn, { marginTop: 10 }]} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryText}>{t("examBack")}</Text>
        </PressableScale>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { color: colors.muted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  content: { padding: 16 },
  hero: { backgroundColor: colors.accent, borderRadius: 24, padding: 24, alignItems: "center", marginBottom: 14, ...shadow },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontFamily: fonts.heading, marginTop: 6 },
  heroSub: { color: "#FFFFFF", opacity: 0.92, fontSize: 15, marginTop: 2, textAlign: "center" },
  bigScore: { color: "#FFFFFF", fontSize: 40, fontFamily: fonts.heading, marginTop: 4 },
  rank: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginTop: 8, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 18, marginBottom: 12, ...shadow },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  infoText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 22 },
  primaryBtn: { flexDirection: "row", gap: 8, backgroundColor: colors.primary, minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  primaryBtnSmall: { flex: 1, backgroundColor: colors.primary, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 17 },
  secondaryBtn: { flex: 1, backgroundColor: colors.tint, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.primaryDark, fontWeight: "700", fontSize: 16 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  qCount: { color: colors.muted, fontWeight: "700", fontSize: 15 },
  timer: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.tint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  timerLow: { backgroundColor: colors.dangerTint },
  timerText: { color: colors.primaryDark, fontWeight: "800", fontSize: 16 },
  question: { color: colors.ink, fontSize: 18, lineHeight: 27, fontWeight: "600" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: colors.border },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.tint },
  letter: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.track, alignItems: "center", justifyContent: "center" },
  letterOn: { backgroundColor: colors.primary },
  letterText: { color: colors.primaryDark, fontWeight: "800" },
  optionText: { flex: 1, color: colors.ink, fontSize: 16, lineHeight: 23 },
  bottom: { flexDirection: "row", gap: 10, padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  navBtn: { flexDirection: "row", gap: 6, minHeight: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" },
  navBtnMain: { flex: 1, backgroundColor: colors.primary },
  navText: { color: colors.primaryDark, fontWeight: "700" },
  navTextMain: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  modalBack: { flex: 1, backgroundColor: "rgba(6,47,58,0.55)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: "75%" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 12 },
  cell: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.track, alignItems: "center", justifyContent: "center" },
  cellDone: { backgroundColor: colors.primary },
  cellNow: { borderWidth: 3, borderColor: colors.accent },
  cellText: { color: colors.primaryDark, fontWeight: "800", fontSize: 16 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  statsRow: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 18, padding: 14, marginBottom: 14, ...shadow },
  stat: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontFamily: fonts.heading, color: colors.ink },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2, textAlign: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.muted, marginBottom: 10, letterSpacing: 0.5 },
  reviewCard: { backgroundColor: colors.surface, borderRadius: 14, borderLeftWidth: 5, padding: 14, marginBottom: 10 },
  reviewQ: { color: colors.ink, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  reviewA: { fontSize: 14, marginTop: 6, lineHeight: 21 },
  reviewExp: { color: colors.muted, fontSize: 13, marginTop: 6, lineHeight: 20, fontStyle: "italic" },
});
