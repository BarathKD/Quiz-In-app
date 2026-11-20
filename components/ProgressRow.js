import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FadeInUp from "./FadeInUp";
import PressableScale from "./PressableScale";
import { useLang } from "../utils/i18n";
import { colors, difficultyColors, shadow } from "../utils/theme";

const LEVELS = ["easy", "medium", "hard"];
const LEVEL_KEYS = { easy: "difficultyEasy", medium: "difficultyMedium", hard: "difficultyHard" };

// One list row for Subcategories and Subjects: name + Easy/Medium/Hard progress badges.
export default function ProgressRow({ title, progress, onPress, index = 0 }) {
  const { t } = useLang();
  const done = progress || {};
  const completedCount = LEVELS.filter((level) => done[level]).length;

  return (
    <FadeInUp index={index} style={styles.rowWrap}>
      <PressableScale style={styles.card} onPress={onPress}>
        <View style={styles.iconTile}>
          <Ionicons name="library-outline" size={26} color={colors.primary} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>

          <View style={styles.badgeRow}>
            {LEVELS.map((level) => (
              <View
                key={level}
                style={[styles.badge, done[level] && { backgroundColor: difficultyColors[level] }]}
              >
                {done[level] ? (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" style={{ marginRight: 2 }} />
                ) : null}
                <Text style={[styles.badgeText, done[level] && { color: "#FFFFFF" }]}>
                  {t(LEVEL_KEYS[level])}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.count}>{t("completedCount", { n: completedCount })}</Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color={colors.muted} />
      </PressableScale>
    </FadeInUp>
  );
}

const styles = StyleSheet.create({
  rowWrap: { paddingHorizontal: 16, marginBottom: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    ...shadow,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  content: { flex: 1 },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink, lineHeight: 26 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.track,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  count: { fontSize: 12, color: colors.muted, marginTop: 6 },
});
