import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import FadeInUp from "../components/FadeInUp";
import { getAchievements } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, shadow } from "../utils/theme";

export default function AchievementsScreen({ navigation, route }) {
  const { user } = route.params || {};
  const { t } = useLang();
  const [badges, setBadges] = useState([]);

  const load = useCallback(async () => {
    if (user?.id) setBadges(await getAchievements(user.id));
  }, [user?.id]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [navigation, load]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <View style={styles.container}>
      <Header title={t("achievements")} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.summary}>{t("achievementsSub", { a: unlockedCount, b: badges.length })}</Text>
        <View style={styles.grid}>
          {badges.map((b, index) => (
            <FadeInUp key={b.id} index={index} style={styles.cell}>
              <View style={[styles.badge, !b.unlocked && styles.badgeLocked]}>
                <View style={[styles.iconCircle, { backgroundColor: b.unlocked ? colors.accent : colors.locked }]}>
                  <Ionicons name={b.unlocked ? b.icon : "lock-closed"} size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.title}>{t(`badge_${b.id}`)}</Text>
                <Text style={styles.desc}>{t(`badge_${b.id}_d`)}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(b.value / b.target) * 100}%` }]} />
                </View>
                <Text style={styles.count}>{b.value} / {b.target}</Text>
              </View>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>
      <BottomNav navigation={navigation} user={user} activeTab="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 28 },
  summary: { fontSize: 15, color: colors.muted, textAlign: "center", marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  cell: { width: "50%", padding: 6 },
  badge: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, alignItems: "center", minHeight: 210, ...shadow },
  badgeLocked: { opacity: 0.8 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink, textAlign: "center" },
  desc: { fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 18, marginTop: 4, flex: 1 },
  track: { height: 6, alignSelf: "stretch", backgroundColor: colors.track, borderRadius: 3, overflow: "hidden", marginTop: 8 },
  fill: { height: "100%", backgroundColor: colors.accent, borderRadius: 3 },
  count: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
