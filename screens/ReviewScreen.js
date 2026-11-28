// ReviewScreen.js - list of saved questions the user wants to review: wrong answers ("mistakes") or bookmarked questions ("bookmarks").
// ROUTE PARAMS: user (needs user.id), mode = "mistakes" (default) or "bookmarks".
// TALKS TO: utils/api.js (getMistakeIds, getBookmarkIds, getQuestionsByIds, removeMistake, removeBookmark).
// NAVIGATES TO: "Quiz" with { mode, user } for practice (QuizScreen reads the same mode). BottomNav tab: profile.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import FadeInUp from "../components/FadeInUp";
import PressableScale from "../components/PressableScale";
import {
  getMistakeIds, getBookmarkIds, getQuestionsByIds, removeMistake, removeBookmark,
} from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, shadow } from "../utils/theme";

// mode "mistakes" or "bookmarks": list the saved questions and practise them.
export default function ReviewScreen({ navigation, route }) {
  const { user, mode = "mistakes" } = route.params || {};
  const { t } = useLang();
  // State: the saved questions to show.
  const [items, setItems] = useState([]);

  // Helper: get saved question ids for this mode, then load the full questions.
  const load = useCallback(async () => {
    if (!user?.id) return;
    const ids = mode === "mistakes" ? await getMistakeIds(user.id) : await getBookmarkIds(user.id);
    setItems(await getQuestionsByIds(ids));
  }, [user?.id, mode]);

  // Effect: load on open and on every focus (a question may be saved or removed in the quiz).
  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [navigation, load]);

  // Handler: remove one question from the saved list (api), then remove it from the screen without reloading.
  const remove = async (q) => {
    if (mode === "mistakes") await removeMistake(user.id, q.id);
    else await removeBookmark(user.id, q.id);
    setItems((prev) => prev.filter((x) => x.id !== q.id));
  };

  // FlatList row renderer: question, correct answer, optional explanation, remove button.
  const renderItem = ({ item, index }) => {
    // Find the text of the correct option (shows N/A if not found).
    const answer = item.options?.find((o) => o.id === item.correctOptionId)?.text;
    return (
      <FadeInUp index={Math.min(index, 8)} style={styles.rowWrap}>
        <View style={styles.card}>
          <Text style={styles.question}>{item.questionText}</Text>
          <View style={styles.answerBox}>
            <Text style={styles.answerLabel}>{t("correctAnswer")}</Text>
            <Text style={styles.answerText}>{answer || "N/A"}</Text>
          </View>
          {item.explanation ? <Text style={styles.explanation}>{item.explanation}</Text> : null}
          <PressableScale style={styles.removeBtn} onPress={() => remove(item)}>
            <Ionicons name="trash-outline" size={16} color={colors.muted} />
            <Text style={styles.removeText}>{t("remove")}</Text>
          </PressableScale>
        </View>
      </FadeInUp>
    );
  };

  // Render: header, list (with empty message), practice button, bottom nav.
  return (
    <View style={styles.container}>
      <Header title={t(mode)} onBack={() => navigation.goBack()} />
      <FlatList
        data={items}
        keyExtractor={(q) => String(q.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={mode === "mistakes" ? "alert-circle-outline" : "star-outline"} size={52} color={colors.muted} />
            <Text style={styles.emptyTitle}>{t("reviewEmpty")}</Text>
            <Text style={styles.emptySub}>{t(mode === "mistakes" ? "mistakesEmptySub" : "bookmarksEmptySub")}</Text>
          </View>
        }
      />
      {/* Practice bar: only shown when there is something to practise */}
      {items.length > 0 ? (
        <View style={styles.practiceBar}>
          <PressableScale style={styles.practiceBtn} onPress={() => navigation.navigate("Quiz", { mode, user })}>
            <Ionicons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.practiceText}>{t("practiceNow")}</Text>
          </PressableScale>
        </View>
      ) : null}
      <BottomNav navigation={navigation} user={user} activeTab="profile" />
    </View>
  );
}

// Styles.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  rowWrap: { paddingHorizontal: 16, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, ...shadow },
  question: { fontSize: 16, fontWeight: "700", color: colors.ink, lineHeight: 26 },
  answerBox: { backgroundColor: colors.successTint, borderRadius: 12, padding: 12, marginTop: 10 },
  answerLabel: { fontSize: 12, fontWeight: "700", color: colors.success, marginBottom: 2 },
  answerText: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  explanation: { fontSize: 14, color: colors.muted, lineHeight: 22, marginTop: 8 },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", marginTop: 10, padding: 4 },
  removeText: { fontSize: 13, color: colors.muted },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: 12 },
  emptySub: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: "center", lineHeight: 22 },
  practiceBar: { padding: 12, backgroundColor: colors.bg },
  practiceBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 999,
  },
  practiceText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
