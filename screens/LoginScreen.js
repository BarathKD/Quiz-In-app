import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { getUserByEmail, addUser, loginUserSession } from "../utils/storage";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    if (!email || !password) return Alert.alert("Error", "Enter email and password");
    
    try {
      const user = await getUserByEmail(email);
      if (user && user.password === password) {
        // Persist session
        await loginUserSession(user);
        
        // Check if user is admin and redirect accordingly
        if (user.isAdmin) {
          navigation.reset({ 
            index: 0, 
            routes: [{ name: "Admin", params: { user: user } }] 
          });
        } else {
          // Navigate to Categories screen for regular users
          navigation.reset({ 
            index: 0, 
            routes: [{ name: "Categories", params: { user: user } }] 
          });
        }
      } else {
        Alert.alert("Invalid credentials", "You can create an account if you don't have one.");
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Login failed. Please try again.");
    }
  };

  const signup = async () => {
    if (!email || !password) return Alert.alert("Error", "Enter email and password");
    
    try {
      const userExists = await getUserByEmail(email);
      if (userExists) return Alert.alert("User exists", "Try login instead.");
      
      await addUser({ 
        id: Date.now().toString(),
        email, 
        password, 
        isAdmin: false 
      });
      Alert.alert("Success", "Account created. Please login.");
      
      // Clear form
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Signup error:", error);
      Alert.alert("Error", "Account creation failed. Please try again.");
    }
  };

  const loginAsDemo = async () => {
    // Quick demo login
    const demoUser = {
      id: "demo",
      email: "demo@quiz.com", 
      password: "demo",
      isAdmin: false
    };
    
    await loginUserSession(demoUser);
    
    navigation.reset({ 
      index: 0, 
      routes: [{ name: "Categories", params: { user: demoUser } }] 
    });
  };

  const loginAsAdmin = async () => {
    // Quick admin login
    const adminUser = {
      id: "admin",
      email: "admin@quiz.com", 
      password: "admin123",
      isAdmin: true
    };
    
    await loginUserSession(adminUser);
    
    navigation.reset({ 
      index: 0, 
      routes: [{ name: "Admin", params: { user: adminUser } }] 
    });
  };

  const googleLogin = async () => {
    // Mock Google Login
    const googleUser = {
      id: "google_" + Date.now(),
      email: "user@gmail.com", 
      password: "google_oauth_mock",
      isAdmin: false,
      name: "Google User"
    };
    
    Alert.alert("Google Sign-In", "Mocking Google Sign-In. You need to configure Client IDs for a real integration.");
    
    await loginUserSession(googleUser);
    
    navigation.reset({ 
      index: 0, 
      routes: [{ name: "Categories", params: { user: googleUser } }] 
    });
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
        
        <TouchableOpacity style={styles.btn} onPress={login}>
          <Text style={styles.btnText}>Login</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={signup}>
          <Text style={styles.secondaryText}>Sign up</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.googleBtn]} onPress={googleLogin}>
          <Text style={styles.googleBtnText}>🌐 Sign in with Google</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.demoContainer}>
        <Text style={styles.demoTitle}>Quick Access (Demo)</Text>
        
        <TouchableOpacity style={styles.demoBtn} onPress={loginAsDemo}>
          <Text style={styles.demoBtnText}>👤 Login as Student</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.adminBtn} onPress={loginAsAdmin}>
          <Text style={styles.adminBtnText}>👑 Login as Admin</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Features:</Text>
        <Text style={styles.infoText}>• Category-based quiz system</Text>
        <Text style={styles.infoText}>• Progressive difficulty unlocking</Text>
        <Text style={styles.infoText}>• Track your progress</Text>
        <Text style={styles.infoText}>• Admin panel to manage content</Text>
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
    color: "#534bae" // Purple-ish blue
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
    elevation: 3,
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
  googleBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    marginTop: 8
  },
  googleBtnText: {
    color: "#333",
    fontWeight: "600",
    fontSize: 16
  },
  demoContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  demoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
    textAlign: "center"
  },
  demoBtn: {
    backgroundColor: "#00bfa5", // Green
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8
  },
  demoBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14
  },
  adminBtn: {
    backgroundColor: "#ff9800",
    padding: 12,
    borderRadius: 8,
    alignItems: "center"
  },
  adminBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14
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