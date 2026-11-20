import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from "../utils/theme";

// Banner header: peacock blue with rounded bottom corners.
export default function Header({ title, right, onBack }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      ) : <View style={{ width: 44 }} />}

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <View style={styles.rightContainer}>
        {right || <View style={{ width: 44 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 18,
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.headingSemi,
    color: colors.onPrimary,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 44,
    justifyContent: "flex-end",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(244,249,248,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
});
