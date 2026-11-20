import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLang } from "../utils/i18n";
import { colors } from "../utils/theme";

// தமிழ் | EN switch. Use variant="onPrimary" on the maroon banner, "light" on ivory.
export default function LanguageToggle({ variant = "light" }) {
  const { lang, setLang } = useLang();
  const onPrimary = variant === "onPrimary";

  const pillStyle = (active) => [
    styles.pill,
    active && { backgroundColor: onPrimary ? colors.accent : colors.primary },
  ];
  const textStyle = (active) => [
    styles.pillText,
    {
      color: active
        ? onPrimary ? colors.onAccent : colors.onPrimary
        : onPrimary ? colors.onPrimary : colors.muted,
    },
  ];

  return (
    <View
      style={[
        styles.wrap,
        onPrimary
          ? { backgroundColor: "rgba(255,248,236,0.16)" }
          : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={pillStyle(lang === "ta")}
        onPress={() => setLang("ta")}
        accessibilityRole="button"
        accessibilityLabel="தமிழ்"
      >
        <Text style={textStyle(lang === "ta")}>தமிழ்</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={pillStyle(lang === "en")}
        onPress={() => setLang("en")}
        accessibilityRole="button"
        accessibilityLabel="English"
      >
        <Text style={textStyle(lang === "en")}>EN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", borderRadius: 999, padding: 3 },
  pill: {
    minHeight: 40,
    minWidth: 52,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontSize: 14, fontWeight: "700" },
});
