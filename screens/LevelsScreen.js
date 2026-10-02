import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import { getQuestionsByFilter } from "../utils/storage";

const QUESTIONS_PER_LEVEL = 50;

export default function LevelsScreen({ navigation, route }) {
  const { category, subcategory, subject, difficulty, user } = route.params;
  const [levels, setLevels] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLevels();
  }, [category, subcategory, subject, difficulty]);

  const loadLevels = async () => {
    try {
      setIsLoading(true);
      // Fetch all questions for this combination
      const filteredQuestions = await getQuestionsByFilter(
        category,
        subcategory,
        subject || undefined,  // undefined = no subject filter; subject string = match that subject
        difficulty
      );

      const total = filteredQuestions.length;
      setTotalQuestions(total);

      if (total === 0) {
        setLevels([]);
        setIsLoading(false);
        return;
      }

      // Calculate levels - each level = 50 questions
      const numLevels = Math.ceil(total / QUESTIONS_PER_LEVEL);
      const generatedLevels = [];

      for (let i = 0; i < numLevels; i++) {
        const start = i * QUESTIONS_PER_LEVEL;
        const end = Math.min(start + QUESTIONS_PER_LEVEL, total);
        generatedLevels.push({
          id: `level_${i + 1}`,
          levelNumber: i + 1,
          start,
          end,
          count: end - start
        });
      }

      setLevels(generatedLevels);
    } catch (error) {
      console.error("Error loading levels:", error);
      Alert.alert("Error", "Failed to load levels. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLevelPress = (level) => {
    navigation.navigate("Quiz", {
      category,
      subcategory,
      subject,
      difficulty,
      user,
      levelStart: level.start,
      levelEnd: level.end,
      levelNumber: level.levelNumber
    });
  };

  const getDifficultyColor = () => {
    switch (difficulty) {
      case "easy": return "#6366F1";
      case "medium": return "#ff9800";
      case "hard": return "#f44336";
      default: return "#4F46E5";
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading levels...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={`${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} - Select Level`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.breadcrumb}>
          {category} › {subcategory}{subject ? ` › ${subject}` : ""}
        </Text>

        <View style={[styles.summaryCard, { borderLeftColor: getDifficultyColor() }]}>
          <Text style={styles.summaryTitle}>📊 Quiz Info</Text>
          <Text style={styles.summaryText}>Total Questions: <Text style={styles.summaryBold}>{totalQuestions}</Text></Text>
          <Text style={styles.summaryText}>Levels Available: <Text style={styles.summaryBold}>{levels.length}</Text></Text>
          <Text style={styles.summaryText}>Questions per Level: <Text style={styles.summaryBold}>up to {QUESTIONS_PER_LEVEL}</Text></Text>
        </View>

        {levels.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚀</Text>
            <Text style={styles.emptyTitle}>Coming Soon</Text>
            <Text style={styles.emptySubtitle}>
              Content for {difficulty} difficulty is currently being updated.{"\n"}Please check back later!
            </Text>
          </View>
        ) : (
          <View style={styles.levelsContainer}>
            {levels.map((level) => (
              <TouchableOpacity
                key={level.id}
                style={[styles.levelCard, { borderLeftColor: getDifficultyColor() }]}
                onPress={() => handleLevelPress(level)}
                activeOpacity={0.8}
              >
                <View style={[styles.levelBadge, { backgroundColor: getDifficultyColor() }]}>
                  <Text style={styles.levelBadgeText}>{level.levelNumber}</Text>
                </View>

                <View style={styles.levelInfo}>
                  <Text style={styles.levelTitle}>Level {level.levelNumber}</Text>
                  <Text style={styles.levelSubtitle}>
                    {level.count} Questions  (Q{level.start + 1} – Q{level.end})
                  </Text>
                </View>

                <Text style={styles.levelArrow}>▶</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      <BottomNav navigation={navigation} user={user} activeTab="categories" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa"
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666"
  },
  content: {
    flex: 1,
    padding: 16
  },
  breadcrumb: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16
  },
  summaryCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8
  },
  summaryText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 3
  },
  summaryBold: {
    fontWeight: "700",
    color: "#333"
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22
  },
  levelsContainer: {
    gap: 12,
    paddingBottom: 40
  },
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    borderLeftWidth: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3
  },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16
  },
  levelBadgeText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff"
  },
  levelInfo: {
    flex: 1
  },
  levelTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4
  },
  levelSubtitle: {
    fontSize: 13,
    color: "#777"
  },
  levelArrow: {
    fontSize: 16,
    color: "#aaa",
    marginLeft: 10
  }
});
