import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BottomNav({ navigation, user, activeTab }) {
  return (
    <View style={styles.bottomNavContainer}>
      <TouchableOpacity 
        style={styles.bottomNavTab}
        onPress={() => {
          if (activeTab === "categories") {
            navigation.navigate("Categories", { user, initialTab: "categories" });
          } else {
            navigation.navigate("Categories", { user, initialTab: "categories" });
          }
        }}
      >
        <Ionicons name="folder" size={24} color={activeTab === "categories" ? "#6366F1" : "#888"} />
        <Text style={[styles.bottomNavText, activeTab === "categories" && styles.activeBottomNavText]}>
          Categories
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.bottomNavTab}
        onPress={() => {
          navigation.navigate("Categories", { user, initialTab: "profile" });
        }}
      >
        <Ionicons name="person" size={24} color={activeTab === "profile" ? "#6366F1" : "#888"} />
        <Text style={[styles.bottomNavText, activeTab === "profile" && styles.activeBottomNavText]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingBottom: 20, // for safe area
    paddingTop: 8,
  },
  bottomNavTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomNavText: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  activeBottomNavText: {
    color: "#6366F1",
    fontWeight: "600"
  }
});
