import React from "react";
import { View, Text, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../components/PressableScale";
import { useLang } from "../utils/i18n";
import { colors, fonts } from "../utils/theme";
import { PLAY_STORE_URL } from "../utils/config";

// Shown instead of the app when the admin raised "Minimum app version" above this install's version.
export default function UpdateRequiredScreen() {
  const { t } = useLang();
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-download-outline" size={72} color={colors.primary} />
      <Text style={styles.title}>{t("updateRequiredTitle")}</Text>
      <Text style={styles.message}>{t("updateRequiredMsg")}</Text>
      <PressableScale style={styles.button} onPress={() => Linking.openURL(PLAY_STORE_URL).catch(() => {})}>
        <Text style={styles.buttonText}>{t("updateNow")}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.bg },
  title: { fontSize: 24, fontFamily: fonts?.heading, fontWeight: "800", color: colors.ink, marginTop: 20, textAlign: "center" },
  message: { fontSize: 16, color: colors.muted, marginTop: 10, textAlign: "center", lineHeight: 24 },
  button: { marginTop: 28, backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
