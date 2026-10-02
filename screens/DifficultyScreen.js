import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import { getUserProgress } from "../utils/storage";

export default function DifficultyScreen({ navigation, route }) {
  const { category, subcategory, subject, user, progress: initialProgress } = route.params;
  const [progress, setProgress] = useState(initialProgress || { easy: false, medium: false, hard: false });

  useEffect(() => {
    loadProgress();
  }, [user?.id, category, subcategory, subject]);

  const loadProgress = async () => {
    if (user?.id) {
      try {
        const userProgress = await getUserProgress(user.id);
        let key;
        
        if (subject) {
          key = `${category}_${subcategory}_${subject}`;
        } else {
          key = `${category}_${subcategory}`;
        }
        
        const itemProgress = userProgress[key] || { easy: false, medium: false, hard: false };
        setProgress(itemProgress);
      } catch (error) {
        console.error("Error loading progress:", error);
      }
    }
  };

  const getDifficultyStatus = (difficulty) => {
    if (user?.isAdmin) return "unlocked"; // Admin can access all
    
    switch (difficulty) {
      case "easy":
        return "unlocked"; // Easy is always unlocked
      case "medium":
        return progress.easy ? "unlocked" : "locked"; // Medium unlocks after easy
      case "hard":
        return progress.medium ? "unlocked" : "locked"; // Hard unlocks after medium
      default:
        return "locked";
    }
  };

  const getDifficultyStyle = (difficulty) => {
    const status = getDifficultyStatus(difficulty);
    const isCompleted = progress[difficulty];
    
    if (status === "locked") {
      return {
        card: [styles.card, styles.lockedCard],
        text: [styles.text, styles.lockedText],
        sub: [styles.sub, styles.lockedText]
      };
    } else if (isCompleted) {
      return {
        card: [styles.card, styles.completedCard],
        text: [styles.text, styles.completedText],
        sub: [styles.sub, styles.completedText]
      };
    } else {
      return {
        card: [styles.card, styles.availableCard],
        text: [styles.text],
        sub: [styles.sub]
      };
    }
  };

  const handleDifficultyPress = (difficulty) => {
    const status = getDifficultyStatus(difficulty);
    
    if (status === "locked") {
      // Show the custom message for locked difficulties
      Alert.alert(
        "🧠 Locked Level",
        "You are not smart enough! Complete the previous difficulty level first.",
        [{ text: "OK, I'll get smarter!" }]
      );
      return;
    }
    
    if (status === "unlocked") {
      // Navigate to Levels screen first - questions split into 50/level
      navigation.navigate("Levels", { 
        category, 
        subcategory, 
        subject,
        difficulty,
        user 
      });
    }
  };

  const getDifficultyIcon = (difficulty) => {
    const status = getDifficultyStatus(difficulty);
    const isCompleted = progress[difficulty];
    
    if (isCompleted) return "✅";
    if (status === "locked") return "🔒";
    return "▶️";
  };

  const getDifficultyDescription = (difficulty) => {
    const status = getDifficultyStatus(difficulty);
    const isCompleted = progress[difficulty];
    
    if (isCompleted) return "Completed! Tap to replay";
    if (status === "locked") {
      switch (difficulty) {
        case "medium":
          return "Complete Easy level to unlock";
        case "hard":
          return "Complete Medium level to unlock";
        default:
          return "Locked";
      }
    }
    return "Tap to start";
  };

  return (
    <View style={styles.container}>
      <Header 
        title={`${subcategory}${subject ? ` - ${subject}` : ''} - Select Difficulty`}
        onBack={() => navigation.goBack()} 
      />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.categoryInfo}>
          {category} › {subcategory}{subject ? ` › ${subject}` : ''}
        </Text>
        
        {["easy", "medium", "hard"].map(difficulty => {
          const difficultyStyles = getDifficultyStyle(difficulty);
          const status = getDifficultyStatus(difficulty);
          const icon = getDifficultyIcon(difficulty);
          const description = getDifficultyDescription(difficulty);
          
          return (
            <TouchableOpacity 
              key={difficulty}
              style={difficultyStyles.card} 
              onPress={() => handleDifficultyPress(difficulty)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <Text style={difficultyStyles.text}>
                  {icon} {difficulty.toUpperCase()}
                </Text>
                {progress[difficulty] && (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>COMPLETED</Text>
                  </View>
                )}
              </View>
              <Text style={difficultyStyles.sub}>{description}</Text>
              
              {status === "locked" && (
                <View style={styles.lockWarning}>
                  <Text style={styles.lockWarningText}>
                    🧠 You need to be smarter to unlock this level!
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        
        <View style={styles.progressContainer}>
          <Text style={styles.progressTitle}>Your Progress</Text>
          <View style={styles.progressBar}>
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot, 
                progress.easy && styles.progressDotCompleted
              ]}>
                <Text style={[
                  styles.progressDotText,
                  progress.easy && styles.progressDotTextCompleted
                ]}>1</Text>
              </View>
              <Text style={styles.progressLabel}>Easy</Text>
            </View>
            
            <View style={[
              styles.progressLine, 
              progress.easy && styles.progressLineCompleted
            ]} />
            
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot, 
                progress.medium && styles.progressDotCompleted
              ]}>
                <Text style={[
                  styles.progressDotText,
                  progress.medium && styles.progressDotTextCompleted
                ]}>2</Text>
              </View>
              <Text style={styles.progressLabel}>Medium</Text>
            </View>
            
            <View style={[
              styles.progressLine, 
              progress.medium && styles.progressLineCompleted
            ]} />
            
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot, 
                progress.hard && styles.progressDotCompleted
              ]}>
                <Text style={[
                  styles.progressDotText,
                  progress.hard && styles.progressDotTextCompleted
                ]}>3</Text>
              </View>
              <Text style={styles.progressLabel}>Hard</Text>
            </View>
          </View>
        </View>
        
        {user?.isAdmin && (
          <View style={styles.adminNotice}>
            <Text style={styles.adminText}>
              👑 Admin Mode: All difficulties are unlocked
            </Text>
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
  content: {
    flex: 1,
    padding: 16
  },
  categoryInfo: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    textAlign: "center"
  },
  card: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { 
      width: 0, 
      height: 2 
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  availableCard: {
    backgroundColor: "#e8f5e8",
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1"
  },
  completedCard: {
    backgroundColor: "#f0f8ff",
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1"
  },
  lockedCard: {
    backgroundColor: "#fff0f0",
    borderLeftWidth: 4,
    borderLeftColor: "#f44336"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  text: {
    fontSize: 18,
    fontWeight: "800",
    color: "#333"
  },
  lockedText: {
    color: "#999"
  },
  completedText: {
    color: "#6366F1"
  },
  sub: {
    color: "#555",
    fontSize: 14,
    lineHeight: 18
  },
  lockWarning: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#ffebee",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#f44336"
  },
  lockWarningText: {
    color: "#d32f2f",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center"
  },
  completedBadge: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  completedBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600"
  },
  progressContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { 
      width: 0, 
      height: 1 
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
    color: "#333"
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  progressStep: {
    alignItems: "center"
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8
  },
  progressDotCompleted: {
    backgroundColor: "#6366F1"
  },
  progressDotText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666"
  },
  progressDotTextCompleted: {
    color: "#fff"
  },
  progressLabel: {
    fontSize: 12,
    color: "#666"
  },
  progressLine: {
    height: 2,
    width: 40,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 8
  },
  progressLineCompleted: {
    backgroundColor: "#6366F1"
  },
  adminNotice: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#fff3cd",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107"
  },
  adminText: {
    color: "#856404",
    fontSize: 14,
    textAlign: "center"
  }
});