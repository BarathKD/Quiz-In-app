// App.js - app entry point (Expo root component).
// WHAT: sets up fonts, language provider, safe area, gesture root and the navigation stack.
// STARTUP ORDER (look at initializeApp below if the app hangs on the spinner):
//   1. initStorageWithSample()  - prepare local storage (utils/api.js)
//   2. loadGameSettings()       - read game settings from server/local (utils/api.js)
//   3. compareVersions()        - force-update gate: if app version < gameSettings.minAppVersion, show UpdateRequiredScreen only
//   4. flushPendingWrites()     - send offline saved writes (see the second useEffect)
// SCREENS: every screen is registered in Stack.Navigator at the bottom of this file. First screen is Splash.
// To add a new screen: import it above and add a Stack.Screen line.
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, AppState } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useFonts, BalooThambi2_600SemiBold, BalooThambi2_800ExtraBold } from "@expo-google-fonts/baloo-thambi-2";
import { LanguageProvider, useLang } from "./utils/i18n";
import { syncReminder } from "./utils/reminder";

import { colors } from "./utils/theme";

// All screens are imported here and registered later in Stack.Navigator.
// Import screens
import AdminScreen from "./screens/AdminScreen";
import CategoriesScreen from "./screens/CategoriesScreen";
import SubcategoriesScreen from "./screens/SubcategoriesScreen";
import SubjectsScreen from "./screens/SubjectsScreen";
import DifficultyScreen from "./screens/DifficultyScreen";
import LoginScreen from "./screens/LoginScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ExamScreen from "./screens/ExamScreen";
import LevelsScreen from "./screens/LevelsScreen";
import QuizScreen from "./screens/QuizScreen";
import QuizSummaryScreen from "./screens/QuizSummaryScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import SettingsScreen from "./screens/SettingsScreen";
import DailyChallengeScreen from "./screens/DailyChallengeScreen";
import ReviewScreen from "./screens/ReviewScreen";
import AchievementsScreen from "./screens/AchievementsScreen";
import SplashScreen from "./screens/SplashScreen";
import Constants from "expo-constants";
import { initStorageWithSample, loadGameSettings, gameSettings, flushPendingWrites } from "./utils/api";
import { compareVersions } from "./utils/version";
import UpdateRequiredScreen from "./screens/UpdateRequiredScreen";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// The stack navigator object. Stack.Screen names are used in navigation.navigate("Name") in all screens.
const Stack = createNativeStackNavigator();

// Keeps the daily reminder in line with the admin settings (time, text) and the app language, each time the app opens.
// Helper component: renders nothing. It must be inside LanguageProvider because it needs useLang().
function ReminderSync() {
  const { lang } = useLang();
  useEffect(() => { syncReminder(lang); }, [lang]);
  return null;
}

// Main App component.
export default function App() {
  // State group: isReady = storage and settings finished loading; updateRequired = installed app is too old (force update).
  const [isReady, setIsReady] = useState(false);
  const [updateRequired, setUpdateRequired] = useState(false);
  // Load custom fonts. Names here must match fonts in utils/theme.js.
  const [fontsLoaded, fontError] = useFonts({ BalooThambi2_600SemiBold, BalooThambi2_800ExtraBold });

  useEffect(() => {
    // Effect 1 (runs once): load storage and game settings, then check the minimum app version.
    // If something breaks at startup, check the console message "Storage initialization error".
    const initializeApp = async () => {
      try {
        await initStorageWithSample();
        await loadGameSettings();
        setUpdateRequired(compareVersions(Constants.expoConfig?.version, gameSettings.minAppVersion) < 0);
      } catch (error) {
        console.error("Storage initialization error:", error);
      } finally {
        // Always mark ready so the Stack.Navigator mounts and SplashScreen
        // can do its own session check inside the navigator context
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  // Offline queue: send saved writes when the app opens, comes back to the foreground, and every minute.
  useEffect(() => {
    const flush = () => flushPendingWrites().catch(() => {});
    flush();
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") flush(); });
    const timer = setInterval(flush, 60000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);

  // Show a simple spinner while storage initialises.
  // We do NOT render <SplashScreen /> here because it would be outside the
  // Stack.Navigator, so navigation.replace("Admin") etc. would fail.
  // Gate 1: show spinner until storage and fonts are ready (a font error does not block the app).
  if (!isReady || (!fontsLoaded && !fontError)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Gate 2: force-update. Only the update screen is shown, no navigation, so the user cannot use the old app.
  if (updateRequired) {
    return (
      <LanguageProvider>
        <UpdateRequiredScreen />
      </LanguageProvider>
    );
  }

  return (
    // Normal app. Provider order: gesture root > safe area > language > navigation. Reminder sync and status bar sit inside the language provider.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
        <ReminderSync />
        <StatusBar style="light" backgroundColor={colors.primary} translucent={false} />
        <NavigationContainer>
          // Navigation stack. Header is hidden because screens draw their own header (components/header.js).
          <Stack.Navigator 
            initialRouteName="Splash" 
            screenOptions={{ 
              headerShown: false,
              animation: 'slide_from_right'
            }}
          >
            {/* Splash handles session check & navigates to Login or home */}
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            
            {/* Category-based flow */}
            <Stack.Screen name="Categories" component={CategoriesScreen} />
            <Stack.Screen name="Subcategories" component={SubcategoriesScreen} />
            <Stack.Screen name="Subjects" component={SubjectsScreen} />
            
            
            {/* Common screens */}
            <Stack.Screen name="Difficulty" component={DifficultyScreen} />
            <Stack.Screen name="Levels" component={LevelsScreen} />
            <Stack.Screen name="Exam" component={ExamScreen} />
            <Stack.Screen name="Quiz" component={QuizScreen} />
            <Stack.Screen name="QuizSummary" component={QuizSummaryScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="DailyChallenge" component={DailyChallengeScreen} />
            <Stack.Screen name="Review" component={ReviewScreen} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg
  }
});
