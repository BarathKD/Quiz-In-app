import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, ImageBackground } from "react-native";
import Header from "../components/header";
import { getAllQuestions, updateUserProgress, getCategoryByName,getCategoryImage } from "../utils/storage";

/** Utility shuffle (Fisher-Yates) */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizScreen({ navigation, route }) {
  const { category, subcategory, difficulty, user, subject, levelStart, levelEnd, levelNumber } = route.params;
  const [pool, setPool] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null); // Wait for category data to set time
  const [totalTime, setTotalTime] = useState(300); // Default to 5 minutes
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [totalAvailableQuestions, setTotalAvailableQuestions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // New state for background image
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.3);
  const [categoryData, setCategoryData] = useState(null);
  
  const timerRef = useRef(null);

  useEffect(() => {
    loadQuestions();
    loadCategoryBackground();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

 // Load category background image and opacity
  const loadCategoryBackground = async () => {
    try {
      console.log("=== LOADING BACKGROUND IMAGE ===");
      console.log("Looking for category:", category);
      
      const categoryInfo = await getCategoryByName(category);
      console.log("Category info found:", categoryInfo);
      
      if (categoryInfo) {
        setCategoryData(categoryInfo);
        
        // Load background image URI
        if (categoryInfo.id) {
          const imageUri = await getCategoryImage(categoryInfo.id);
          console.log("Image URI retrieved:", imageUri);
          
          if (imageUri) {
            setBackgroundImage(imageUri);
            console.log("✅ Background image set successfully");
          } else {
            console.log("❌ No image URI found");
          }
        }
        
        // Set opacity
        if (categoryInfo.backgroundOpacity !== undefined) {
          setBackgroundOpacity(categoryInfo.backgroundOpacity);
          console.log("Opacity set to:", categoryInfo.backgroundOpacity);
        }

        // Timer initialization logic (in minutes -> to seconds)
        let quizTimeInMinutes = categoryInfo.timer || 5; // Default 5 mins
        if (subject && categoryInfo.subjectTimers && categoryInfo.subjectTimers[subject]) {
          quizTimeInMinutes = categoryInfo.subjectTimers[subject];
        }
        const timeInSeconds = quizTimeInMinutes * 60;
        setTotalTime(timeInSeconds);
        setTimeLeft(timeInSeconds);
        console.log("Timer initialized to:", timeInSeconds, "seconds");

      } else {
        console.log("❌ Category not found");
      }
    } catch (error) {
      console.error("Error loading category background:", error);
    }
  };

  // Load questions with proper subject filtering
  const loadQuestions = async () => {
    try {
      setIsLoading(true);
      const all = await getAllQuestions();
      
      console.log("=== QUIZ LOADING DEBUG ===");
      console.log("Total questions in database:", all.length);
      console.log("Looking for:", { category, subcategory, subject, difficulty });
      console.log("Level range:", { levelStart, levelEnd, levelNumber });
      
      // Filtering logic
      let filtered = all.filter(q => {
        const categoryMatch = q.category === category;
        const subcategoryMatch = q.subcategory === subcategory;
        const difficultyMatch = q.difficulty === difficulty;
        
        let subjectMatch = false;
        
        if (subject) {
          // If subject is provided, question must have that exact subject
          subjectMatch = (q.subject === subject);
        } else {
          // If no subject provided, accept questions without subject field or empty subject
          subjectMatch = (!q.subject || q.subject === "" || q.subject === null || q.subject === undefined);
        }
        
        return categoryMatch && subcategoryMatch && difficultyMatch && subjectMatch;
      });

      console.log("Filtered questions count:", filtered.length);
      setTotalAvailableQuestions(filtered.length);

      // Apply level slicing if levelStart & levelEnd are provided
      if (typeof levelStart === "number" && typeof levelEnd === "number") {
        filtered = filtered.slice(levelStart, levelEnd);
        console.log(`Level ${levelNumber}: showing Q${levelStart + 1}–Q${levelEnd} (${filtered.length} questions)`);
      }

      if (filtered.length === 0) {
        Alert.alert(
          "Coming Soon!", 
          `Content for this section is currently being updated. Please check back later!`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
        return;
      }

      // Shuffle the level's questions
      setPool(filtered);
      const sessionQs = shuffleArray(filtered);
      setQuestions(sessionQs);
      setIndex(0);
      setAnswers({});
      setScore(0);
      // Removed setTimeLeft(300) so it uses the fetched category timer
      
      console.log(`Quiz session created with ${sessionQs.length} questions`);
    } catch (error) {
      console.error("Error loading questions:", error);
      Alert.alert("Error", "Failed to load questions", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const isTimerInitialized = timeLeft !== null;
  
  useEffect(() => {
    // Timer management
    if (!questions || questions.length === 0 || showExplanation || isLoading || !isTimerInitialized) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [index, questions, showExplanation, isLoading, isTimerInitialized]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    );
  }

  if (!questions.length) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No questions available</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const q = questions[index];
  if (!q) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Question not found</Text>
      </View>
    );
  }

  const handleTimeout = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    Alert.alert("Time's Up!", "Your time for this quiz has expired.", [
      { text: "View Results", onPress: () => handleQuizComplete(score) }
    ]);
  };

  const handleQuizComplete = async (finalScore) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Update progress if user completed successfully (70% or more)
    const percentage = (finalScore / questions.length) * 100;
    const passed = percentage >= 70;
    
    if (passed && user?.id) {
      try {
        await updateUserProgress(user.id, category, subcategory, difficulty, true, subject);
      } catch (error) {
        console.error("Error updating progress:", error);
      }
    }
    
    navigation.replace("QuizSummary", { 
      questions, 
      answers: { ...answers, [q.id]: selectedAnswer },
      score: finalScore,
      passed,
      category,
      subcategory,
      subject,
      difficulty,
      user,
      totalQuestions: questions.length
    });
  };

  const resetSession = () => {
    // Reshuffle pool and restart
    const newSession = shuffleArray(pool);
    setQuestions(newSession);
    setIndex(0);
    setAnswers({});
    setScore(0);
    setTimeLeft(totalTime);
    setShowExplanation(false);
    setSelectedAnswer(null);
    setIsCorrect(false);
  };

  const onSelect = (optId) => {
    if (showExplanation) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    const correct = q.correctOptionId;
    const isAnswerCorrect = optId === correct;
    
    setSelectedAnswer(optId);
    setIsCorrect(isAnswerCorrect);
    setAnswers(prev => ({ ...prev, [q.id]: optId }));
    
    if (isAnswerCorrect) {
      setScore(prev => prev + 1);
    }
    
    setShowExplanation(true);
  };

  const handleExplanationClose = () => {
    setShowExplanation(false);
    
    if (isCorrect) {
      // Correct answer - go to next question or complete quiz
      if (index < questions.length - 1) {
        setIndex(i => i + 1);
        setSelectedAnswer(null);
        setIsCorrect(false);
      } else {
        // Quiz completed successfully
        handleQuizComplete(score);
      }
    } else {
      // Wrong answer or timeout - show failure message and reset
      Alert.alert(
        "Study Well!", 
        "See you soon! The quiz will restart with new questions.", 
        [{ text: "Try Again", onPress: () => resetSession() }]
      );
    }
  };

  const handleFinish = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    Alert.alert(
      "Finish Quiz",
      `Are you sure you want to finish? You have answered ${index + 1} out of ${questions.length} questions.`,
      [
        { text: "Continue Quiz", style: "cancel" },
        { text: "Finish", onPress: () => handleQuizComplete(score) }
      ]
    );
  };

  const getTimeColor = () => {
    if (timeLeft <= 30) return "#f44336"; // Red - last 30 seconds
    if (timeLeft <= 60) return "#ff9800"; // Orange - last minute
    return "#6366F1"; // Green
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getOptionStyle = (optionId) => {
    if (!showExplanation) {
      return styles.optionButton;
    }
    
    if (optionId === q.correctOptionId) {
      return [styles.optionButton, styles.correctOption];
    }
    
    if (optionId === selectedAnswer && optionId !== q.correctOptionId) {
      return [styles.optionButton, styles.wrongOption];
    }
    
    return [styles.optionButton, styles.neutralOption];
  };

  // Create the main content component
  const MainContent = () => (
    <View style={styles.container}>
      <View style={styles.headerInfo}>
        <Text style={styles.questionCounter}>
          Question {index + 1} of {questions.length}
        </Text>
        <Text style={styles.totalQuestions}>
          Pool: {totalAvailableQuestions} questions
        </Text>
        {!showExplanation && timeLeft !== null && (
          <Text style={[styles.timer, { color: getTimeColor() }]}>
            ⏱️ {formatTime(timeLeft)}
          </Text>
        )}
      </View>

      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((index + 1) / questions.length) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(((index + 1) / questions.length) * 100)}% Complete
        </Text>
      </View>

      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{q.questionText}</Text>
      </View>

      <View style={styles.optionsContainer}>
        {q.options && q.options.map && q.options.map(option => (
          <TouchableOpacity 
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={getOptionStyle(option.id)}
            disabled={showExplanation}
          >
            <View style={styles.optionContent}>
              <Text style={styles.optionId}>{option.id.toUpperCase()}</Text>
              <Text style={styles.optionText}>{option.text}</Text>
              {showExplanation && option.id === q.correctOptionId && (
                <Text style={styles.correctMark}>✓</Text>
              )}
              {showExplanation && option.id === selectedAnswer && option.id !== q.correctOptionId && (
                <Text style={styles.wrongMark}>✗</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>Score: {score}/{questions.length}</Text>
          <Text style={styles.accuracyText}>
            Accuracy: {index > 0 ? Math.round((score / (index + 1)) * 100) : 0}%
          </Text>
        </View>

        {!showExplanation && (
          <TouchableOpacity 
            onPress={handleFinish} 
            style={styles.finishButton}
          >
            <Text style={styles.finishButtonText}>Finish Quiz</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Header 
        title={`${subcategory}${subject ? ` - ${subject}` : ''} | ${difficulty}${levelNumber ? ` | L${levelNumber}` : ''}`} 
        onBack={() => {
          if (timerRef.current) clearInterval(timerRef.current);
          navigation.goBack();
        }} 
      />
      
      {/* Conditional rendering: with or without background image */}
      {backgroundImage ? (
        <ImageBackground
          source={{ uri: backgroundImage }}
          style={styles.backgroundImage}
          imageStyle={styles.backgroundImageStyle}
          resizeMode="cover"
        >
          {/* Semi-transparent overlay for readability */}
          <View 
            style={[
              styles.backgroundOverlay, 
              { backgroundColor: `rgba(255, 255, 255, ${backgroundOpacity || 0.85})` }
            ]} 
          />
          <MainContent />
        </ImageBackground>
      ) : (
        <View style={styles.defaultBackground}>
          <MainContent />
        </View>
      )}

      {/* Explanation Modal */}
      <Modal
        visible={showExplanation}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}} // Prevent closing with back button
      >
        <View style={styles.modalOverlay}>
          <View style={styles.explanationModal}>
            <View style={styles.resultHeader}>
              <Text style={[
                styles.resultText,
                { color: isCorrect ? "#6366F1" : "#f44336" }
              ]}>
                {selectedAnswer === null ? "Time's Up!" : (isCorrect ? "Correct!" : "Wrong Answer")}
              </Text>
              <Text style={styles.resultIcon}>
                {selectedAnswer === null ? "⏰" : (isCorrect ? "🎉" : "😞")}
              </Text>
            </View>

            <View style={styles.correctAnswerContainer}>
              <Text style={styles.correctAnswerLabel}>Correct Answer:</Text>
              <Text style={styles.correctAnswerText}>
                {q.options?.find(opt => opt.id === q.correctOptionId)?.text || 'N/A'}
              </Text>
            </View>

            {q.explanation && (
              <View style={styles.explanationContainer}>
                <Text style={styles.explanationLabel}>Explanation:</Text>
                <Text style={styles.explanationText}>{q.explanation}</Text>
              </View>
            )}

            <TouchableOpacity 
              style={[
                styles.continueButton,
                { backgroundColor: isCorrect ? "#6366F1" : "#f44336" }
              ]}
              onPress={handleExplanationClose}
            >
              <Text style={styles.continueButtonText}>
                {isCorrect ? (index < questions.length - 1 ? "Next Question" : "Complete Quiz") : "Try Again"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    zIndex: 2
  },
  defaultBackground: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%"
  },
  backgroundImageStyle: {
  opacity: 1
},
  backgroundOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f9fa"
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20
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
  headerInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    zIndex: 2
  },
  questionCounter: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333"
  },
  totalQuestions: {
    fontSize: 12,
    color: "#666",
    backgroundColor: "rgba(227, 242, 253, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  timer: {
    fontSize: 18,
    fontWeight: "bold"
  },
  progressBarContainer: {
    marginBottom: 24,
    zIndex: 2
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(224, 224, 224, 0.8)",
    borderRadius: 4,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6366F1",
    borderRadius: 4
  },
  progressText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 4
  },
  questionContainer: {
  backgroundColor: "rgba(255, 255, 255, 0.98)",
  padding: 20,
  borderRadius: 12,
  marginBottom: 24,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 5,
  zIndex: 2,
  borderWidth: 1,
  borderColor: "rgba(0, 0, 0, 0.1)",
  backdropFilter: "blur(10px)"
},
  questionText: {
    fontSize: 18,
    lineHeight: 26,
    color: "#333",
    textAlign: "center"
  },
  optionsContainer: {
    flex: 1,
    zIndex: 2
  },
  optionButton: {
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  borderRadius: 12,
  marginBottom: 12,
  padding: 16,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 4,
  elevation: 3,
  borderWidth: 2,
  borderColor: "rgba(0, 0, 0, 0.08)"
},
  correctOption: {
    borderColor: "#6366F1",
    backgroundColor: "rgba(248, 255, 248, 0.98)"
  },
  wrongOption: {
    borderColor: "#f44336",
    backgroundColor: "rgba(255, 248, 248, 0.98)"
  },
  neutralOption: {
    opacity: 0.6
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center"
  },
  optionId: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e3f2fd",
    color: "#1976d2",
    textAlign: "center",
    lineHeight: 32,
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 12
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    lineHeight: 22
  },
  correctMark: {
    fontSize: 20,
    color: "#6366F1",
    fontWeight: "bold"
  },
  wrongMark: {
    fontSize: 20,
    color: "#f44336",
    fontWeight: "bold"
  },
  bottomSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(238, 238, 238, 0.8)",
    zIndex: 2
  },
  scoreContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333"
  },
  accuracyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666"
  },
  finishButton: {
    backgroundColor: "#f44336",
    padding: 16,
    borderRadius: 12,
    alignItems: "center"
  },
  finishButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  explanationModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8
  },
  resultHeader: {
    alignItems: "center",
    marginBottom: 20
  },
  resultText: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8
  },
  resultIcon: {
    fontSize: 40
  },
  correctAnswerContainer: {
    backgroundColor: "#f0f8ff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1"
  },
  correctAnswerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1976d2",
    marginBottom: 4
  },
  correctAnswerText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22
  },
  explanationContainer: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20
  },
  explanationLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8
  },
  explanationText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22
  },
  continueButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center"
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold"
  }
});