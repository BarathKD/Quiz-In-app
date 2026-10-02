import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import { getUserProgress, getAllCategories } from "../utils/storage";

export default function SubjectsScreen({ navigation, route }) {
  const { category, subcategory, user } = route.params;
  const [progress, setProgress] = useState({});
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load user progress
      if (user?.id) {
        const userProgress = await getUserProgress(user.id);
        setProgress(userProgress || {});
      }
      
      // Load subjects for this category/subcategory
      const categories = await getAllCategories();
      const categoryObj = categories.find(c => c.name === category);
      
      if (categoryObj) {
        let subjectsList = [];
        
        if (categoryObj.subjects && typeof categoryObj.subjects === 'object') {
          // Nested subjects structure (like Tamil Nadu -> Class X -> Subjects)
          subjectsList = categoryObj.subjects[subcategory] || [];
        } else if (categoryObj.subcategories) {
          // Simple subcategories structure (like General Knowledge categories)
          subjectsList = categoryObj.subcategories;
        }
        
        setSubjects(subjectsList);
        console.log("Loaded subjects:", subjectsList);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const getSubjectProgress = (subjectName) => {
    const key = `${category}_${subcategory}_${subjectName}`;
    return progress[key] || { easy: false, medium: false, hard: false };
  };

  const handleSubjectPress = (subjectName) => {
    const subjectProgress = getSubjectProgress(subjectName);
    
    console.log("Navigating to Difficulty with:", {
      category,
      subcategory,
      subject: subjectName,
      progress: subjectProgress
    });
    
    navigation.navigate("Difficulty", {
      category: category,
      subcategory: subcategory,
      subject: subjectName,
      user: user,
      progress: subjectProgress
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <Header 
        title={`${category} - ${subcategory}`}
        onBack={() => navigation.goBack()} 
      />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={subjects}
        keyExtractor={(item) => item}
        renderItem={({ item: subjectName }) => {
          const subjectProgress = getSubjectProgress(subjectName);
          const completedCount = Object.values(subjectProgress).filter(Boolean).length;
          
          return (
            <TouchableOpacity
              style={styles.subjectCard}
              onPress={() => handleSubjectPress(subjectName)}
            >
              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.subjectName}>
                    {subjectName}
                  </Text>
                </View>
                
                <View style={styles.progressContainer}>
                  <View style={styles.difficultyRow}>
                    <View style={[
                      styles.difficultyBadge,
                      subjectProgress.easy && styles.completedBadge
                    ]}>
                      <Text style={[
                        styles.difficultyText,
                        subjectProgress.easy && styles.completedText
                      ]}>Easy</Text>
                    </View>
                    <View style={[
                      styles.difficultyBadge,
                      subjectProgress.medium && styles.completedBadge
                    ]}>
                      <Text style={[
                        styles.difficultyText,
                        subjectProgress.medium && styles.completedText
                      ]}>Medium</Text>
                    </View>
                    <View style={[
                      styles.difficultyBadge,
                      subjectProgress.hard && styles.completedBadge
                    ]}>
                      <Text style={[
                        styles.difficultyText,
                        subjectProgress.hard && styles.completedText
                      ]}>Hard</Text>
                    </View>
                  </View>
                  <Text style={styles.progressText}>
                    {completedCount}/3 completed
                  </Text>
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
            <Text style={styles.emptyText}>No subjects available</Text>
            <Text style={styles.emptySubtext}>
              This class doesnt have any subjects yet
            </Text>
          </View>
        }
      />
      <BottomNav navigation={navigation} user={user} activeTab="categories" />
    </View>
  );
}

const styles = StyleSheet.create({
  subjectCard: {
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
  subjectName: {
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