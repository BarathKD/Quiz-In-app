// ForgotPasswordScreen.js - reset password in 2 steps (needs a server, opened from LoginScreen).
// ROUTE PARAMS: email (optional, copied from the login form).
// STEP 1: user enters email -> sendCode() asks the server to send a 6 digit code.
// STEP 2: user enters code + new password -> submit() resets the password, then goes back to Login.
// TALKS TO: utils/api.js (requestPasswordReset, resetPassword), utils/server.js (ApiError), utils/i18n.js (t).
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { requestPasswordReset, resetPassword } from "../utils/api";
import { ApiError } from "../utils/server";
import { useLang } from "../utils/i18n";
import { colors, fonts, shadow } from "../utils/theme";
import PressableScale from "../components/PressableScale";

export default function ForgotPasswordScreen({ navigation, route }) {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  // State group: step (1 = ask email, 2 = enter code and new password), form values, busy flag.
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(route?.params?.email || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Helper: simple email format check.
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  // Handler: send (or resend) the reset code. On success go to step 2. Server status 429 means too many requests.
  const sendCode = async () => {
    if (!isValidEmail(email)) return Alert.alert(t("error"), t("errInvalidEmail"));
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setStep(2);
      Alert.alert(t("success"), t("resetCodeSent"));
    } catch (error) {
      Alert.alert(t("error"), error instanceof ApiError && error.status === 429 ? t("resetTooMany") : t("resetNetwork"));
    } finally {
      setBusy(false);
    }
  };

  // Handler: check code (6 digits) and password (min 6), then call resetPassword.
  // Error mapping: 429 = too many tries, weak_password = password rejected by server, other ApiError = wrong/expired code, no ApiError = network problem.
  const submit = async () => {
    if (code.trim().length !== 6) return Alert.alert(t("error"), t("resetCodeInvalid"));
    if (password.length < 6) return Alert.alert(t("error"), t("resetWeak"));
    setBusy(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      Alert.alert(t("success"), t("resetDone"));
      navigation.goBack();
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) Alert.alert(t("error"), t("resetTooMany"));
      else if (error instanceof ApiError && error.body?.error === "weak_password") Alert.alert(t("error"), t("resetWeak"));
      else if (error instanceof ApiError) Alert.alert(t("error"), t("resetCodeInvalid"));
      else Alert.alert(t("error"), t("resetNetwork"));
    } finally {
      setBusy(false);
    }
  };

  // Render: one card. Email box is locked in step 2. Code and password boxes only show in step 2.
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 32 }}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("forgotTitle")}</Text>
          <Text style={styles.hint}>{step === 1 ? t("forgotHint") : t("forgotHint2")}</Text>

          <TextInput
            placeholder={t("email")}
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={step === 1}
            value={email}
            onChangeText={setEmail}
          />

          {/* Step 2 only: code and new password inputs */}
          {step === 2 && (
            <>
              <TextInput
                placeholder={t("resetCode")}
                placeholderTextColor={colors.muted}
                style={styles.input}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />
              <TextInput
                placeholder={t("newPassword")}
                placeholderTextColor={colors.muted}
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </>
          )}

          {/* Main button: sends code in step 1, resets password in step 2 */}
          <PressableScale style={styles.btn} onPress={step === 1 ? sendCode : submit} disabled={busy}>
            <Text style={styles.btnText}>{busy ? t("pleaseWait") : step === 1 ? t("sendCode") : t("resetPassword")}</Text>
          </PressableScale>

          {step === 2 && (
            <PressableScale style={[styles.btn, styles.secondary]} onPress={sendCode} disabled={busy}>
              <Text style={styles.secondaryText}>{t("resendCode")}</Text>
            </PressableScale>
          )}
          {/* Cancel button: go back to Login */}
          <PressableScale style={[styles.btn, styles.secondary, { marginTop: 12 }]} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryText}>{t("cancel")}</Text>
          </PressableScale>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Styles. Colors come from utils/theme.js.
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, marginHorizontal: 20, padding: 22, borderRadius: 20, ...shadow },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.primaryDark, marginBottom: 8 },
  hint: { fontSize: 14, color: colors.muted, lineHeight: 21, marginBottom: 18 },
  input: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, color: colors.ink,
    paddingHorizontal: 14, minHeight: 52, borderRadius: 12, marginBottom: 14, fontSize: 16,
  },
  btn: { backgroundColor: colors.primary, minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnText: { color: colors.onPrimary, fontWeight: "700", fontSize: 17 },
  secondary: { backgroundColor: colors.tint, marginTop: 12 },
  secondaryText: { color: colors.primaryDark, fontWeight: "700", fontSize: 17 },
});
