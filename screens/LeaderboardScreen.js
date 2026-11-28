// LeaderboardScreen.js - ranking of players by points.
// ROUTE PARAMS: user (current logged in user, used to highlight "me" and for BottomNav).
// TALKS TO: utils/api.js (getLeaderboard returns rows with id, name, rank, points, levels).
// UI PARTS: header, "your rank" card (list header), list of players, empty message, BottomNav (tab "leaderboard").
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import FadeInUp from "../components/FadeInUp";
import { getLeaderboard } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, fonts, shadow } from "../utils/theme";

// Top 3 use peacock, violet and green (no gold/red palette)
// Badge colors for rank 1, 2, 3.
const PODIUM = [colors.accent, colors.primary, colors.success];

export default function LeaderboardScreen({ navigation, route }) {
  // State group: rows = leaderboard data, loading = show spinner.
  const { user } = route.params || {};
  const { t } = useLang();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper: fetch the leaderboard from utils/api.js.
  const load = useCallback(async () => {
    setLoading(true);
    setRows(await getLeaderboard());
    setLoading(false);
  }, []);

  // Effect: load on open and again every time this screen gets focus (so points are fresh after a quiz).
  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [navigation, load]);

  // My own row (used for the "your rank" card).
  const mine = rows.find((r) => r.id === user?.id);

  // FlatList row renderer: one player row. Top 3 get a trophy badge, my row is highlighted.
  const renderItem = ({ item, index }) => {
    const isMe = item.id === user?.id;
    const top = item.rank <= 3;
    return (
      <FadeInUp index={Math.min(index, 8)} style={styles.rowWrap}>
        <View style={[styles.row, isMe && styles.rowMe]}>
          <View style={[styles.rankBadge, { backgroundColor: top ? PODIUM[item.rank - 1] : colors.tint }]}>
            {top ? (
              <Ionicons name="trophy" size={18} color="#FFFFFF" />
            ) : (
              <Text style={styles.rankText}>{item.rank}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}{isMe ? `  (${t("you")})` : ""}
            </Text>
            <Text style={styles.sub}>
              {t("levelsPassed", { n: item.levels })}
              {item.challengeWins > 0 ? `  ·  ${t("challengeWinsShort", { n: item.challengeWins })}` : ""}
            </Text>
          </View>
          <Text style={styles.points}>{t("pointsLabel", { n: item.points })}</Text>
        </View>
      </FadeInUp>
    );
  };

  // Render: header, then spinner or list, then bottom navigation.
  return (
    <View style={styles.container}>
      <Header title={t("leaderboard")} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        // List only shows players with points > 0. The list header (your rank card + notes) and the empty message are passed as props below.
        <FlatList
          data={rows.filter((r) => r.points > 0)}
          keyExtractor={(r) => String(r.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View style={styles.headerBox}>
              {mine && mine.points > 0 ? (
                <View style={styles.myCard}>
                  <Text style={styles.myLabel}>{t("yourRank")}</Text>
                  <Text style={styles.myRank}>#{mine.rank}</Text>
                  <Text style={styles.myPoints}>{t("pointsLabel", { n: mine.points })}</Text>
                </View>
              ) : null}
              <Text style={styles.formula}>{t("leaderboardSub")}</Text>
              <Text style={styles.note}>{t("leaderboardNote")}</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="trophy-outline" size={52} color={colors.muted} />
              <Text style={styles.emptyTitle}>{t("leaderboardEmpty")}</Text>
              <Text style={styles.emptySub}>{t("leaderboardEmptySub")}</Text>
            </View>
          }
        />
      )}
      <BottomNav navigation={navigation} user={user} activeTab="leaderboard" />
    </View>
  );
}

// Styles.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 24 },
  headerBox: { padding: 16 },
  myCard: {
    backgroundColor: colors.primary, borderRadius: 24, padding: 20, alignItems: "center", marginBottom: 12, ...shadow,
  },
  myLabel: { color: colors.onPrimary, fontSize: 14 },
  myRank: { color: "#FFFFFF", fontSize: 44, fontFamily: fonts.heading },
  myPoints: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" },
  formula: { fontSize: 13, color: colors.muted, textAlign: "center", lineHeight: 20 },
  note: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 2 },
  rowWrap: { paddingHorizontal: 16, marginBottom: 10 },
  row: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 18, padding: 14,
    borderWidth: 2, borderColor: "transparent", ...shadow,
  },
  rowMe: { borderColor: colors.primary, backgroundColor: colors.tint },
  rankBadge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginRight: 12 },
  rankText: { color: colors.primary, fontWeight: "800", fontSize: 15 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  points: { fontSize: 15, fontWeight: "800", color: colors.primary },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: 12 },
  emptySub: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: "center" },
});
