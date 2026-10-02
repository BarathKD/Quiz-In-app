import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import Header from "../components/header";

export default function QuizSummaryScreen({ route, navigation }) {
  // Safely extract route params with defaults
  const params = route?.params || {};
  const { 
    score = 0, 
    totalQuestions = 0,
    questions = [],
    passed = false,
    category = "",
    subcategory = "",
    subject = null,
    difficulty = "",
    user = null
  } = params;
  
  // Calculate totalQuestions from questions array if not provided
  const actualTotalQuestions = totalQuestions || questions.length || 0;
  const percentage = actualTotalQuestions > 0 ? Math.round((score / actualTotalQuestions) * 100) : 0;

  // Ensure we have valid data
  if (!category || !subcategory || !difficulty) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Invalid quiz data</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.reset({
            index: 0,
            routes: [{ name: user ? "Categories" : "Login", params: user ? { user } : {} }]
          })}
        >
          <Text style={styles.backButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getScoreColor = () => {
    if (percentage >= 70) return "#6366F1"; // Green
    if (percentage >= 50) return "#ff9800"; // Orange  
    return "#f44336"; // Red
  };

  const getScoreEmoji = () => {
    if (percentage >= 90) return "🏆";
    if (percentage >= 70) return "🎉";
    if (percentage >= 50) return "😊";
    return "😞";
  };

  const getScoreMessage = () => {
    if (percentage >= 90) return "Excellent! Perfect performance!";
    if (percentage >= 70) return "Great job! You passed!";
    if (percentage >= 50) return "Good effort! Keep practicing!";
    return "Keep trying! You'll get better!";
  };

  const handleRetry = () => {
    navigation.replace("Quiz", {
      category,
      subcategory,
      subject,
      difficulty,
      user
    });
  };

  // FIXED: Ensure user object is properly passed
  const handleBackToCategories = () => {
    if (user) {
      navigation.reset({
        index: 0,
        routes: [{ name: "Categories", params: { user } }]
      });
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }]
      });
    }
  };

  const handleNextDifficulty = () => {
    let nextDifficulty = "";
    if (difficulty === "easy") nextDifficulty = "medium";
    else if (difficulty === "medium") nextDifficulty = "hard";
    
    if (nextDifficulty) {
      navigation.replace("Quiz", {
        category,
        subcategory,
        subject,
        difficulty: nextDifficulty,
        user
      });
    }
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Quiz Complete!" 
        onBack={handleBackToCategories} 
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score Card */}
        <View style={styles.scoreCard}>
          <Text style={styles.emoji}>{getScoreEmoji()}</Text>
          <Text style={[styles.scoreText, { color: getScoreColor() }]}>
            {score}/{actualTotalQuestions}
          </Text>
          <Text style={[styles.percentageText, { color: getScoreColor() }]}>
            {percentage}%
          </Text>
          <Text style={styles.messageText}>{getScoreMessage()}</Text>
          
          {passed && (
            <View style={styles.passedBadge}>
              <Text style={styles.passedText}>✓ PASSED</Text>
            </View>
          )}
        </View>

        {/* Quiz Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Quiz Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category:</Text>
            <Text style={styles.infoValue}>{category}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Subject:</Text>
            <Text style={styles.infoValue}>{subcategory}{subject ? ` - ${subject}` : ''}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Difficulty:</Text>
            <Text style={[styles.infoValue, styles.difficultyText]}>
              {difficulty ? difficulty.toUpperCase() : 'N/A'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Questions Answered:</Text>
            <Text style={styles.infoValue}>{score} correct out of {actualTotalQuestions}</Text>
          </View>
        </View>

        {/* Performance Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Performance</Text>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{score}</Text>
              <Text style={styles.statLabel}>Correct</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#f44336" }]}>
                {actualTotalQuestions - score}
              </Text>
              <Text style={styles.statLabel}>Wrong</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: getScoreColor() }]}>
                {percentage}%
              </Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
          </View>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${percentage}%`, backgroundColor: getScoreColor() }
                ]} 
              />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={handleRetry}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>🔄 Try Again</Text>
          </TouchableOpacity>

          {passed && difficulty === "easy" && (
            <TouchableOpacity 
              style={styles.nextButton} 
              onPress={handleNextDifficulty}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>➡️ Try Medium</Text>
            </TouchableOpacity>
          )}

          {passed && difficulty === "medium" && (
            <TouchableOpacity 
              style={styles.nextButton} 
              onPress={handleNextDifficulty}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>➡️ Try Hard</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.homeButton} 
            onPress={handleBackToCategories}
            activeOpacity={0.8}
          >
            <Text style={styles.homeButtonText}>🏠 Back to Categories</Text>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Tips for Next Time:</Text>
          <Text style={styles.tipText}>• Read each question carefully</Text>
          <Text style={styles.tipText}>• Take your time - you have 5 minutes per question</Text>
          <Text style={styles.tipText}>• Remember: One wrong answer restarts the quiz</Text>
          <Text style={styles.tipText}>• Practice regularly to improve your knowledge</Text>
          {passed && (
            <Text style={[styles.tipText, styles.successTip]}>
              • Great job! You have unlocked the next level! 🎉
            </Text>
          )}
        </View>
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  errorText: {
    fontSize: 18,
    color: "#f44336",
    marginBottom: 20,
    textAlign: "center"
  },
  backButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  scoreCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { 
      width: 0, 
      height: 4 
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16
  },
  scoreText: {
    fontSize: 48,
    fontWeight: "bold",
    marginBottom: 8
  },
  percentageText: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16
  },
  messageText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginBottom: 16
  },
  passedBadge: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20
  },
  passedText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold"
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { 
      width: 0, 
      height: 2 
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    flex: 1
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    textAlign: "right"
  },
  difficultyText: {
    color: "#6366F1"
  },
  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { 
      width: 0, 
      height: 2 
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center"
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20
  },
  statItem: {
    alignItems: "center",
    flex: 1
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#6366F1"
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4
  },
  progressContainer: {
    marginTop: 8
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 4
  },
  actionsContainer: {
    marginBottom: 16
  },
  retryButton: {
    backgroundColor: "#6366F1",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold"
  },
  nextButton: {
    backgroundColor: "#6366F1",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold"
  },
  homeButton: {
    backgroundColor: "#666",
    padding: 16,
    borderRadius: 12,
    alignItems: "center"
  },
  homeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold"
  },
  tipsCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
    marginBottom: 32
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12
  },
  tipText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6,
    paddingLeft: 8,
    lineHeight: 20
  },
  successTip: {
    color: "#6366F1",
    fontWeight: "600"
  }
});