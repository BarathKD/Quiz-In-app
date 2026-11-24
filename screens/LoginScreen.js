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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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

      await loginUserSession(user);

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
      console.error("Signup error:", error);
      Alert.alert(t("error"), t("signupFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={[styles.banner, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
          <View style={styles.bannerTop}>
            <Text style={styles.logo}>Quiz-IN</Text>
            <LanguageToggle variant="onPrimary" />
          </View>
          <Text style={styles.tagline}>{t("tagline")}</Text>
        </View>

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

          {USE_SERVER && (
            <PressableScale style={styles.linkBtn} onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() })} disabled={busy}>
              <Text style={styles.linkText}>{t("forgotLink")}</Text>
            </PressableScale>
          )}
        </FadeInUp>

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
