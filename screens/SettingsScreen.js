// SettingsScreen.js - app settings and account: language, privacy policy, app version, logout, delete account.
// ROUTE PARAMS: user (used for email, admin check and delete).
// TALKS TO: utils/api.js (logoutUserSession, deleteUserAccount), utils/config.js (PRIVACY_POLICY_URL), components MenuRow and LanguageToggle.
// NAVIGATES TO: "Login" (navigation.reset) after logout or account delete. BottomNav tab: profile.
import React from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from "react-native";
import Constants from "expo-constants";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import LanguageToggle from "../components/LanguageToggle";
import MenuRow from "../components/MenuRow";
import { deleteUserAccount, logoutUserSession } from "../utils/api";
import { PRIVACY_POLICY_URL } from "../utils/config";
import { useLang } from "../utils/i18n";
import { colors } from "../utils/theme";

export default function SettingsScreen({ navigation, route }) {
  const { user } = route.params || {};
  const { t } = useLang();
  // App version from app.json (via expo-constants). The force-update check in App.js uses the same value.
  const version = Constants.expoConfig?.version || "1.0.0";
  // Handler: open privacy policy link in the browser. If the URL is empty in utils/config.js, show a "coming soon" message.
  const openPrivacy = async () => {
    if (!PRIVACY_POLICY_URL) {
      Alert.alert(t("privacyPolicy"), t("privacyComingSoon"));
      return;
    }
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      Alert.alert(t("error"), t("privacyComingSoon"));
    }
  };

  // Handler: ask for confirmation, clear the session (api), then reset navigation to Login so Back does not return here.
  const logout = () => {
    Alert.alert(t("logout"), t("logoutConfirm"), [
      { text: t("cancel") },
      {
        text: t("logout"),
        style: "destructive",
        onPress: async () => {
          await logoutUserSession();
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        },
      },
    ]);
  };

  // Handler: delete account with a confirmation popup. api.deleteUserAccount returns true/false. Admin users never see this button.
  const confirmDelete = () => {
    Alert.alert(t("deleteConfirmTitle"), t("deleteConfirmMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("deleteConfirmBtn"),
        style: "destructive",
        onPress: async () => {
          const ok = await deleteUserAccount(user?.id);
          if (ok) {
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          } else {
            Alert.alert(t("error"), t("deleteFailed"));
          }
        },
      },
    ]);
  };

  // Render: header, two sections (App, Account), bottom nav.
  return (
    <View style={styles.container}>
      <Header title={t("settings")} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section 1: app settings (language, privacy, about) */}
        <Text style={styles.section}>{t("settingsApp")}</Text>
        <MenuRow icon="language-outline" title={t("language")} right={<LanguageToggle variant="light" />} />
        <MenuRow icon="shield-checkmark-outline" title={t("privacyPolicy")} onPress={openPrivacy} />
        <MenuRow icon="information-circle-outline" title={t("aboutApp")} subtitle={`Quiz-IN  •  ${t("versionLabel", { v: version })}`} />

        {/* Section 2: account (email, logout, delete account for normal users only) */}
        <Text style={styles.section}>{t("settingsAccount")}</Text>
        {user?.email ? <MenuRow icon="person-circle-outline" title={user.email} /> : null}
        <MenuRow icon="log-out-outline" title={t("logout")} subtitle={t("logoutSub")} onPress={logout} />
        {user && !user.isAdmin ? (
          <MenuRow
            icon="trash-outline"
            title={t("deleteAccount")}
            subtitle={t("deleteAccountSub")}
            onPress={confirmDelete}
            danger
          />
        ) : null}
        <View style={{ height: 24 }} />
      </ScrollView>
      <BottomNav navigation={navigation} user={user} activeTab="profile" />
    </View>
  );
}

// Styles.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  section: { fontSize: 14, fontWeight: "800", color: colors.muted, marginTop: 8, marginBottom: 10, letterSpacing: 0.5 },
});
