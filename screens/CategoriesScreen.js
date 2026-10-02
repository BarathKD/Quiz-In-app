import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import { getAllCategories, logoutUserSession } from "../utils/storage";

export default function CategoriesScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState(route.params?.initialTab || "categories");
  const [categories, setCategories] = useState([]);
  const user = route?.params?.user;

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const loadCategories = async () => {
    try {
      const cats = await getAllCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleCategoryPress = (category) => {
    // Navigate to subcategories (subjects) within this category
    navigation.navigate("Subcategories", { 
      category: category,
      user: user 
    });
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel" },
      { 
        text: "Logout", 
        style: "destructive",
        onPress: async () => {
          await logoutUserSession();
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }]
          });
        }
      }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <View style={styles.headerContainer}>
        <Header title={activeTab === "categories" ? "Select Category" : "Profile"} />
      </View>
      
      {activeTab === "categories" ? (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => handleCategoryPress(item)}
          >
            <View style={styles.cardContent}>
              <Text style={styles.categoryName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.categoryDescription}>{item.description}</Text>
              )}
              <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                  {item.subcategories?.length || 0} subjects
                </Text>
              </View>
            </View>
            <View style={styles.arrow}>
              <Text style={styles.arrowText}>›</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No categories available</Text>
            <Text style={styles.emptySubtext}>
              Categories will appear here once they are available.
            </Text>
          </View>
        }
      />
      ) : (
        <View style={styles.userProfileContainer}>
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{user?.email?.charAt(0).toUpperCase() || 'U'}</Text>
            </View>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <Text style={styles.profileRole}>Student</Text>
          </View>

          <TouchableOpacity style={styles.logoutCardBtn} onPress={handleLogout}>
            <View style={styles.logoutIconContainer}>
              <Ionicons name="log-out-outline" size={24} color="#f44336" />
            </View>
            <View style={styles.logoutTextContainer}>
              <Text style={styles.logoutCardTitle}>Logout</Text>
              <Text style={styles.logoutCardSub}>Sign out of your account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Navigation */}
      <BottomNav navigation={navigation} user={user} activeTab={activeTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  categoryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: "row",
  },
  statsText: {
    fontSize: 12,
    color: "#888",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  arrow: {
    marginLeft: 12,
  },
  arrowText: {
    fontSize: 24,
    color: "#ccc",
    fontWeight: "300",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
  },
  headerContainer: {
    backgroundColor: "#f8f9fa",
    paddingBottom: 8
  },
  userProfileContainer: {
    padding: 16,
    flex: 1,
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "bold",
  },
  profileEmail: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: "#666",
  },
  logoutCardBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  logoutIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffebee",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  logoutTextContainer: {
    flex: 1,
  },
  logoutCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  logoutCardSub: {
    fontSize: 13,
    color: "#888",
  },
});