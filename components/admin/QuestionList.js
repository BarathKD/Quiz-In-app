import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";

export default function QuestionList({ 
  questions, 
  totalQuestions,
  hasMoreQuestions,
  isLoadingQuestions,
  onEdit,
  onDelete,
  onLoadMore
}) {
  // State to track which sections are expanded
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedSubcategories, setExpandedSubcategories] = useState({});
  const [expandedSubjects, setExpandedSubjects] = useState({});

  // Toggle functions
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const toggleSubcategory = (category, subcategory) => {
    const key = `${category}_${subcategory}`;
    setExpandedSubcategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleSubject = (category, subcategory, subject) => {
    const key = `${category}_${subcategory}_${subject}`;
    setExpandedSubjects(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Group questions by category > subcategory > subject
  const groupedQuestions = questions.reduce((acc, question) => {
    const category = question.category || "Uncategorized";
    const subcategory = question.subcategory || "General";
    const subject = question.subject || "No Subject";
    
    if (!acc[category]) {
      acc[category] = {};
    }
    if (!acc[category][subcategory]) {
      acc[category][subcategory] = {};
    }
    if (!acc[category][subcategory][subject]) {
      acc[category][subcategory][subject] = [];
    }
    
    acc[category][subcategory][subject].push(question);
    return acc;
  }, {});

  const renderQuestion = (item) => (
    <View key={item.id} style={styles.questionCard}>
      <View style={styles.questionHeader}>
        <Text numberOfLines={2} style={styles.questionText}>{item.questionText}</Text>
      </View>
      
      <View style={styles.metaContainer}>
        <View style={[
          styles.difficultyBadge,
          item.difficulty === 'easy' && styles.easyBadge,
          item.difficulty === 'medium' && styles.mediumBadge,
          item.difficulty === 'hard' && styles.hardBadge
        ]}>
          <Text style={styles.difficultyText}>
            {item.difficulty.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <Text style={styles.correctAnswer}>
        ✓ {item.options.find(o => o.id === item.correctOptionId)?.text || 'N/A'}
      </Text>
      
      <View style={styles.actions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.deleteBtn} 
          onPress={() => onDelete(item.id)}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} nestedScrollEnabled={true}>
      {Object.entries(groupedQuestions).map(([category, subcategories]) => {
        const categoryQuestionCount = Object.values(subcategories).reduce((sum, subjects) => 
          sum + Object.values(subjects).reduce((s, qs) => s + qs.length, 0), 0
        );
        const isCategoryExpanded = expandedCategories[category];

        return (
          <View key={category} style={styles.categorySection}>
            {/* Category Header - Collapsible */}
            <TouchableOpacity 
              style={styles.categoryHeader}
              onPress={() => toggleCategory(category)}
              activeOpacity={0.7}
            >
              <View style={styles.headerLeft}>
                <Text style={styles.arrow}>{isCategoryExpanded ? '▼' : '▶'}</Text>
                <Text style={styles.categoryTitle}>📁 {category}</Text>
              </View>
              <Text style={styles.categoryCount}>{categoryQuestionCount} questions</Text>
            </TouchableOpacity>
            
            {/* Category Content - Show only if expanded */}
            {isCategoryExpanded && (
              <View style={styles.categoryContent}>
                {Object.entries(subcategories).map(([subcategory, subjects]) => {
                  const subcategoryQuestionCount = Object.values(subjects).reduce((sum, qs) => sum + qs.length, 0);
                  const subcategoryKey = `${category}_${subcategory}`;
                  const isSubcategoryExpanded = expandedSubcategories[subcategoryKey];

                  return (
                    <View key={subcategory} style={styles.subcategorySection}>
                      {/* Subcategory Header - Collapsible */}
                      <TouchableOpacity 
                        style={styles.subcategoryHeader}
                        onPress={() => toggleSubcategory(category, subcategory)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.headerLeft}>
                          <Text style={styles.arrow}>{isSubcategoryExpanded ? '▼' : '▶'}</Text>
                          <Text style={styles.subcategoryTitle}>📂 {subcategory}</Text>
                        </View>
                        <Text style={styles.subcategoryCount}>{subcategoryQuestionCount} questions</Text>
                      </TouchableOpacity>
                      
                      {/* Subcategory Content - Show only if expanded */}
                      {isSubcategoryExpanded && (
                        <View style={styles.subcategoryContent}>
                          {Object.entries(subjects).map(([subject, questionsList]) => {
                            const subjectKey = `${category}_${subcategory}_${subject}`;
                            const isSubjectExpanded = expandedSubjects[subjectKey];

                            return (
                              <View key={subject} style={styles.subjectSection}>
                                {/* Subject Header - Collapsible */}
                                <TouchableOpacity 
                                  style={styles.subjectHeader}
                                  onPress={() => toggleSubject(category, subcategory, subject)}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.headerLeft}>
                                    <Text style={styles.arrow}>{isSubjectExpanded ? '▼' : '▶'}</Text>
                                    <Text style={styles.subjectTitle}>📄 {subject}</Text>
                                  </View>
                                  <Text style={styles.subjectCount}>{questionsList.length} questions</Text>
                                </TouchableOpacity>
                                
                                {/* Subject Content - Show only if expanded */}
                                {isSubjectExpanded && (
                                  <View style={styles.questionsContainer}>
                                    {questionsList.map(renderQuestion)}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
      
      {hasMoreQuestions && (
        <TouchableOpacity 
          style={styles.loadMoreBtn} 
          onPress={onLoadMore}
          disabled={isLoadingQuestions}
        >
          <Text style={styles.loadMoreText}>
            {isLoadingQuestions ? "Loading..." : "Load More"}
          </Text>
        </TouchableOpacity>
      )}
      
      {questions.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No questions found</Text>
          <Text style={styles.emptySubtext}>Try adjusting your filters or add new questions</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 8
  },
  categorySection: {
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden"
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#4F46E5", // Indigo-600
    borderRadius: 12
  },
  categoryContent: {
    padding: 12,
    backgroundColor: "#F8FAFC"
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  arrow: {
    fontSize: 14,
    color: "#fff",
    marginRight: 8,
    fontWeight: "bold"
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    flex: 1
  },
  categoryCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  subcategorySection: {
    marginBottom: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    overflow: "hidden"
  },
  subcategoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#6366F1" // Indigo-500
  },
  subcategoryContent: {
    padding: 10,
    backgroundColor: "#F1F5F9"
  },
  subcategoryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    flex: 1
  },
  subcategoryCount: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  subjectSection: {
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden"
  },
  subjectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#818CF8" // Indigo-400
  },
  subjectTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    flex: 1
  },
  subjectCount: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8
  },
  questionsContainer: {
    padding: 8
  },
  questionCard: {
    padding: 14,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#A5B4FC", // Indigo-300
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  questionHeader: {
    marginBottom: 8
  },
  questionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    lineHeight: 20
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  easyBadge: {
    backgroundColor: "#e8f5e9"
  },
  mediumBadge: {
    backgroundColor: "#fff3e0"
  },
  hardBadge: {
    backgroundColor: "#ffebee"
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#333"
  },
  correctAnswer: {
    color: "#28a745",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8
  },
  actions: {
    flexDirection: "row"
  },
  editBtn: {
    flex: 1,
    padding: 8,
    backgroundColor: "#e3f2fd",
    borderRadius: 6,
    alignItems: "center",
    marginRight: 8
  },
  editText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1976d2"
  },
  deleteBtn: {
    flex: 1,
    padding: 8,
    backgroundColor: "#ffebee",
    borderRadius: 6,
    alignItems: "center"
  },
  deleteText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#c62828"
  },
  loadMoreBtn: {
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: "#E0E7FF",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C7D2FE"
  },
  loadMoreText: {
    color: "#4F46E5",
    fontWeight: "700",
    fontSize: 14
  },
  emptyContainer: {
    alignItems: "center",
    padding: 40
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 13,
    color: "#999",
    textAlign: "center"
  }
});