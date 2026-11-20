import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "./PressableScale";
import { colors, shadow } from "../utils/theme";

// One tappable list row: icon tile, title, optional subtitle, optional badge, chevron.
export default function MenuRow({ icon, title, subtitle, badge, onPress, danger, right }) {
  const tone = danger ? colors.danger : colors.primary;
  return (
    <PressableScale style={styles.row} onPress={onPress}>
      <View style={[styles.tile, { backgroundColor: danger ? colors.dangerTint : colors.tint }]}>
        <Ionicons name={icon} size={24} color={tone} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {badge !== undefined && badge !== null ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {right || <Ionicons name="chevron-forward" size={20} color={colors.muted} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    ...shadow,
  },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 14 },
  texts: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink, lineHeight: 24 },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  badge: {
    backgroundColor: colors.accentTint, borderRadius: 999, minWidth: 28, paddingHorizontal: 8, paddingVertical: 3,
    alignItems: "center", marginRight: 8,
  },
  badgeText: { color: colors.accent, fontWeight: "800", fontSize: 13 },
});
