// components/BottomNav.js - bottom tab bar with 3 tabs: Home, Leaderboard, Profile.
// PROPS: navigation (from the screen), user (passed on to the next screen), activeTab ("categories" | "leaderboard" | "profile" - which tab looks selected).
// NAVIGATES TO: "Categories" (Home and Profile tabs - the Profile tab is the same screen opened with initialTab: "profile"), "Leaderboard".
// To add a tab: add one more TouchableOpacity below and a new activeTab flag.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../utils/i18n';
import { colors } from '../utils/theme';

export default function BottomNav({ navigation, user, activeTab }) {
  const { t } = useLang();
  // Bottom padding = phone gesture bar height (at least 12).
  const insets = useSafeAreaInsets();
  // Which tab is active (highlighted).
  const homeActive = activeTab === "categories";
  const profileActive = activeTab === "profile";
  const boardActive = activeTab === "leaderboard";

  // Render: three equal tabs.
  return (
    <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {/* Tab 1: Home */}
      <TouchableOpacity
        style={styles.bottomNavTab}
        onPress={() => navigation.navigate("Categories", { user, initialTab: "categories" })}
        accessibilityRole="button"
      >
        <Ionicons
          name={homeActive ? "home" : "home-outline"}
          size={24}
          color={homeActive ? colors.primary : colors.muted}
        />
        <Text style={[styles.bottomNavText, homeActive && styles.activeBottomNavText]}>
          {t("navHome")}
        </Text>
      </TouchableOpacity>

      {/* Tab 2: Leaderboard */}
      <TouchableOpacity
        style={styles.bottomNavTab}
        onPress={() => navigation.navigate("Leaderboard", { user })}
        accessibilityRole="button"
      >
        <Ionicons
          name={boardActive ? "trophy" : "trophy-outline"}
          size={24}
          color={boardActive ? colors.primary : colors.muted}
        />
        <Text style={[styles.bottomNavText, boardActive && styles.activeBottomNavText]}>
          {t("navLeaderboard")}
        </Text>
      </TouchableOpacity>

      {/* Tab 3: Profile */}
      <TouchableOpacity
        style={styles.bottomNavTab}
        onPress={() => navigation.navigate("Categories", { user, initialTab: "profile" })}
        accessibilityRole="button"
      >
        <Ionicons
          name={profileActive ? "person" : "person-outline"}
          size={24}
          color={profileActive ? colors.primary : colors.muted}
        />
        <Text style={[styles.bottomNavText, profileActive && styles.activeBottomNavText]}>
          {t("navProfile")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Styles.
const styles = StyleSheet.create({
  bottomNavContainer: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  bottomNavTab: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomNavText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  activeBottomNavText: {
    color: colors.primary,
    fontWeight: "700",
  },
});
