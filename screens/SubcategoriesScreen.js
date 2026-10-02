import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import { getUserProgress, getAllCategories } from "../utils/storage";

export default function SubcategoriesScreen({ navigation, route }) {
  const { category, user } = route.params;
  const [progress, setProgress] = useState({});

  useEffect(() => {
    loadUserProgress();
  }, []);

  const loadUserProgress = async () => {
    if (user?.id) {
      try {
        const userProgress = await getUserProgress(user.id);
        setProgress(userProgress || {});
      } catch (error) {
        console.error("Error loading progress:", error);
      }
    }
  };

  const handleSubcategoryPress = async (subcategoryName) => {
    try {
      const categories = await getAllCategories();
      const categoryObj = categories.find((c) => c.name === category.name);

      if (categoryObj && categoryObj.subjects && typeof categoryObj.subjects === "object") {
        // Navigate to Subjects screen
        navigation.navigate("Subjects", {
          category: category.name,
          subcategory: subcategoryName,
          user: user,
        });
      } else {
        // Navigate directly to Difficulty screen
        const subcategoryProgress = getSubcategoryProgress(subcategoryName);
        navigation.navigate("Difficulty", {
          category: category.name,
          subcategory: subcategoryName,
          user: user,
          progress: subcategoryProgress,
        });
      }
    } catch (error) {
      console.error("Error handling subcategory press:", error);
      // fallback to Difficulty screen
      const subcategoryProgress = getSubcategoryProgress(subcategoryName);
      navigation.navigate("Difficulty", {
        category: category.name,
        subcategory: subcategoryName,
        user: user,
        progress: subcategoryProgress,
      });
    }
  };

  const getSubcategoryProgress = (subcategoryName) => {
    const key = `${category.name}_${subcategoryName}`;
    return progress[key] || { easy: false, medium: false, hard: false };
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={category.name} onBack={() => navigation.goBack()} />

      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={category.subcategories || []}
        keyExtractor={(item) => item}
        renderItem={({ item: subcategoryName }) => {
          const subcategoryProgress = getSubcategoryProgress(subcategoryName);
          const completedCount = Object.values(subcategoryProgress).filter(Boolean).length;

          return (
            <TouchableOpacity
              style={styles.subcategoryCard}
              onPress={() => handleSubcategoryPress(subcategoryName)}
            >
              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.subcategoryName}>{subcategoryName}</Text>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.difficultyRow}>
                    {["easy", "medium", "hard"].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.difficultyBadge,
                          subcategoryProgress[level] && styles.completedBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.difficultyText,
                            subcategoryProgress[level] && styles.completedText,
                          ]}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.progressText}>{completedCount}/3 completed</Text>
                </View>
              </View>

              <View style={styles.arrow}>
                <Text style={styles.arrowText}>›</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No subcategories available</Text>
            <Text style={styles.emptySubtext}>
              This category doesnt have any subcategories yet
            </Text>
          </View>
        }
      />
      <BottomNav navigation={navigation} user={user} activeTab="categories" />
    </View>
  );
}

const styles = StyleSheet.create({
  subcategoryCard: {
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  subcategoryName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  progressContainer: {
    marginTop: 4,
  },
  difficultyRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  difficultyBadge: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  completedBadge: {
    backgroundColor: "#6366F1",
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  completedText: {
    color: "#fff",
  },
  progressText: {
    fontSize: 12,
    color: "#888",
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
});
