// LoginScreen.js - login and sign up screen (one form, two buttons).
// ROUTE PARAMS: none.
// TALKS TO: utils/api.js (authenticateUser, registerUser, loginUserSession, USE_SERVER), utils/i18n.js (t), utils/theme.js.
// NAVIGATES TO: "Categories" after login ("Admin" for a local-mode admin), "ForgotPassword" (only when USE_SERVER is true).
// We use navigation.reset so the user cannot press Back to return to the login screen.
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authenticateUser, registerUser, loginUserSession, USE_SERVER } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, fonts, shadow } from "../utils/theme";
import LanguageToggle from "../components/LanguageToggle";
import PressableScale from "../components/PressableScale";
import FadeInUp from "../components/FadeInUp";

export default function LoginScreen({ navigation }) {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  // State group: form values and busy flag (busy disables the buttons while a request is running).
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Helper: simple email format check (text@text.text). Same check is used in ForgotPasswordScreen.
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  // Handler: login button. Validate input, call authenticateUser (utils/api.js), save session, then go to the home screen.
  // Wrong password or unknown user returns null from authenticateUser.
  const login = async () => {
    if (!email || !password) return Alert.alert(t("error"), t("errEnterBoth"));
    if (!isValidEmail(email)) return Alert.alert(t("error"), t("errInvalidEmail"));

    setBusy(true);
    try {
      const user = await authenticateUser(email, password);

      if (!user) {
        Alert.alert(t("errInvalidCredsTitle"), t("errInvalidCreds"));
        return;
      }

      // Save the session so SplashScreen can auto-login next time.
      await loginUserSession(user);

      // Local admin goes to Admin screen. With a server, admin screen is opened from Categories/Settings instead.
      if (user.isAdmin && !USE_SERVER) {
        navigation.reset({ index: 0, routes: [{ name: "Admin", params: { user } }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: "Categories", params: { user } }] });
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert(t("error"), t("loginFailed"));
    } finally {
      setBusy(false);
    }
  };

  // Handler: sign up button. Validate input (password min 6 chars), then registerUser (utils/api.js). User must press Login after sign up.
  const signup = async () => {
    if (!email || !password) return Alert.alert(t("error"), t("errEnterBoth"));
    if (!isValidEmail(email)) return Alert.alert(t("error"), t("errInvalidEmail"));
    if (password.length < 6) return Alert.alert(t("errWeakTitle"), t("errWeak"));

    setBusy(true);
    try {
      const result = await registerUser(email, password);

      if (!result.ok) {
        Alert.alert(t("userExistsTitle"), t("userExists"));
        return;
      }

      Alert.alert(t("success"), t("signupOk"));
      setPassword("");
    } catch (error) {
      console.warn("Signup error:", error);
      Alert.alert(t("error"), t("signupFailed"));
    } finally {
      setBusy(false);
    }
  };

  // Render: banner on top, form card, then features info box.
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        {/* Top banner: logo, language toggle, tagline */}
        <View style={[styles.banner, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
          <View style={styles.bannerTop}>
            <Text style={styles.logo}>Quiz-IN</Text>
            <LanguageToggle variant="onPrimary" />
          </View>
          <Text style={styles.tagline}>{t("tagline")}</Text>
        </View>

        {/* Form card: email, password, login, sign up, forgot password link */}
        <FadeInUp style={styles.formContainer}>
          <TextInput
            placeholder={t("email")}
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            placeholder={t("password")}
            placeholderTextColor={colors.muted}
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <PressableScale style={styles.btn} onPress={login} disabled={busy}>
            <Text style={styles.btnText}>{busy ? t("pleaseWait") : t("login")}</Text>
          </PressableScale>

          <PressableScale style={[styles.btn, styles.secondary]} onPress={signup} disabled={busy}>
            <Text style={styles.secondaryText}>{t("signup")}</Text>
          </PressableScale>

          {/* Forgot password link is only shown when a server is used (reset code is sent by server) */}
          {USE_SERVER && (
            <PressableScale style={styles.linkBtn} onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() })} disabled={busy}>
              <Text style={styles.linkText}>{t("forgotLink")}</Text>
            </PressableScale>
          )}
        </FadeInUp>

        {/* Features info box (texts from i18n: feature1..3) */}
        <FadeInUp index={2} style={styles.infoContainer}>
          <Text style={styles.infoTitle}>{t("featuresTitle")}</Text>
          <Text style={styles.infoText}>• {t("feature1")}</Text>
          <Text style={styles.infoText}>• {t("feature2")}</Text>
          <Text style={styles.infoText}>• {t("feature3")}</Text>
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Styles. Colors come from utils/theme.js.
const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  bannerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    fontFamily: fonts.heading,
    fontSize: 34,
    color: colors.onPrimary,
  },
  tagline: {
    fontSize: 16,
    color: colors.onPrimary,
    opacity: 0.92,
    marginTop: 18,
  },
  formContainer: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginTop: -16,
    padding: 22,
    borderRadius: 20,
    ...shadow,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.ink,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: 12,
    marginBottom: 14,
    fontSize: 16,
  },
  btn: {
    backgroundColor: colors.primary,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  btnText: {
    color: colors.onPrimary,
    fontWeight: "700",
    fontSize: 17,
  },
  secondary: {
    backgroundColor: colors.tint,
    marginBottom: 0,
  },
  secondaryText: {
    color: colors.primaryDark,
    fontWeight: "700",
    fontSize: 17,
  },
  linkBtn: { alignItems: "center", paddingTop: 16, paddingBottom: 4 },
  linkText: { color: colors.primaryDark, fontWeight: "700", fontSize: 15 },
  infoContainer: {
    backgroundColor: colors.accentTint,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 14,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 22,
  },
});
