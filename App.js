import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

// Import screens
import AdminScreen from "./screens/AdminScreen";
import CategoriesScreen from "./screens/CategoriesScreen";
import SubcategoriesScreen from "./screens/SubcategoriesScreen";
import SubjectsScreen from "./screens/SubjectsScreen";
import ClassesScreen from "./screens/ClassesScreen";
import DifficultyScreen from "./screens/DifficultyScreen";
import LoginScreen from "./screens/LoginScreen";
import LevelsScreen from "./screens/LevelsScreen";
import QuizScreen from "./screens/QuizScreen";
import QuizSummaryScreen from "./screens/QuizSummaryScreen";
import SplashScreen from "./screens/SplashScreen";
import { initStorageWithSample } from "./utils/storage";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

const Stack = createNativeStackNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initStorageWithSample();
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

  // Show a simple spinner while storage initialises.
  // We do NOT render <SplashScreen /> here because it would be outside the
  // Stack.Navigator, so navigation.replace("Admin") etc. would fail.
  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />
        <NavigationContainer>
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
            
            {/* Category-based flow */}
            <Stack.Screen name="Categories" component={CategoriesScreen} />
            <Stack.Screen name="Subcategories" component={SubcategoriesScreen} />
            <Stack.Screen name="Subjects" component={SubjectsScreen} />
            
            {/* Legacy Class-based flow */}
            <Stack.Screen name="Classes" component={ClassesScreen} />
            
            {/* Common screens */}
            <Stack.Screen name="Difficulty" component={DifficultyScreen} />
            <Stack.Screen name="Levels" component={LevelsScreen} />
            <Stack.Screen name="Quiz" component={QuizScreen} />
            <Stack.Screen name="QuizSummary" component={QuizSummaryScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7f7f7"
  }
});
