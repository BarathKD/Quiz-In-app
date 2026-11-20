import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../utils/i18n';
import { colors } from '../utils/theme';

export default function BottomNav({ navigation, user, activeTab }) {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const homeActive = activeTab === "categories";
  const profileActive = activeTab === "profile";
  const boardActive = activeTab === "leaderboard";

  return (
    <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
