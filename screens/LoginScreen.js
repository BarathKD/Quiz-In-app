import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { authenticateUser, registerUser, loginUserSession } from "../utils/api";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const login = async () => {
    if (!email || !password) return Alert.alert("Error", "Enter email and password");
    if (!isValidEmail(email)) return Alert.alert("Error", "Enter a valid email address");

    setBusy(true);
    try {
      const user = await authenticateUser(email, password);

      if (!user) {
        Alert.alert("Invalid credentials", "Check your email and password, or create an account.");
        return;
      }

      await loginUserSession(user);

      if (user.isAdmin) {
        navigation.reset({ index: 0, routes: [{ name: "Admin", params: { user } }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: "Categories", params: { user } }] });
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const signup = async () => {
    if (!email || !password) return Alert.alert("Error", "Enter email and password");
    if (!isValidEmail(email)) return Alert.alert("Error", "Enter a valid email address");
    if (password.length < 6) return Alert.alert("Weak password", "Password must be at least 6 characters");

    setBusy(true);
    try {
      const result = await registerUser(email, password);

      if (!result.ok) {
        Alert.alert("User exists", "This email is already registered. Try login instead.");
        return;
      }

      Alert.alert("Success", "Account created. Please login.");
      setPassword("");
    } catch (error) {
      console.error("Signup error:", error);
      Alert.alert("Error", "Account creation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Quiz-IN</Text>
      <Text style={styles.subtitle}>Hardest Game Ever</Text>

      <View style={styles.formContainer}>
        <TextInput
          placeholder="Email"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          placeholder="Password"
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.btn} onPress={login} disabled={busy}>
          <Text style={styles.btnText}>{busy ? "Please wait..." : "Login"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={signup} disabled={busy}>
          <Text style={styles.secondaryText}>Sign up</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Features:</Text>
        <Text style={styles.infoText}>• Category-based quiz system</Text>
        <Text style={styles.infoText}>• Progressive level unlocking</Text>
        <Text style={styles.infoText}>• Track your progress</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f8f9fa"
  },
  logo: {
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
    color: "#534bae"
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 40
  },
  formContainer: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  input: {
    borderWidth: 1,
    borderColor: "#f0f0f0",
    backgroundColor: "#f5f5f5",
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16
  },
  btn: {
    backgroundColor: "#534bae",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  },
  secondary: {
    backgroundColor: "#eef0fb"
  },
  secondaryText: {
    color: "#534bae",
    fontWeight: "700",
    fontSize: 16
  },
  infoContainer: {
    backgroundColor: "#f0f8ff",
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1"
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1976d2",
    marginBottom: 8
  },
  infoText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2
  }
});
