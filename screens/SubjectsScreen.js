/*
 * SubjectsScreen
 * What: shows the list of subjects (for example Tamil, Maths) inside one subcategory.
 *       It is only used for categories that have nested subjects (like Tamil Nadu -> Class X -> subjects).
 * Route params: { category (string name), subcategory (string name), user }
 * Data: utils/api.js -> getUserProgress (done easy/medium/hard marks), getAllCategories (subject names).
 * Texts: t() from utils/i18n.js. Colors: utils/theme.js.
 * Next screen: "Difficulty" (params: category, subcategory, subject, user, progress).
 * If subjects list is empty, check loadData() below (category name must match exactly).
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import ProgressRow from "../components/ProgressRow";
import { getUserProgress, getAllCategories } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors } from "../utils/theme";

export default function SubjectsScreen({ navigation, route }) {
  // Values sent by the previous screen (SubcategoriesScreen).
  const { category, subcategory, user } = route.params;
  const { t } = useLang();
  // State: progress = map of "category_subcategory_subject" -> { easy, medium, hard } done flags.
  // subjects = list of subject names to show.
  const [progress, setProgress] = useState({});
  const [subjects, setSubjects] = useState([]);

  // Effect: load data once when the screen opens.
  useEffect(() => {
    loadData();
  }, []);

  // Helper: gets user progress and the subject list from utils/api.js.
  // Errors are only logged, so the screen shows the empty message instead of crashing.
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
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  // Helper: progress flags for one subject. The key format must match what utils/api.js saves.
  // If nothing is saved yet, all levels are "not done".
  const getSubjectProgress = (subjectName) => {
    const key = `${category}_${subcategory}_${subjectName}`;
    return progress[key] || { easy: false, medium: false, hard: false };
  };

  // Handler: user taps a subject -> go to Difficulty screen with the subject and its progress.
  const handleSubjectPress = (subjectName) => {
    const subjectProgress = getSubjectProgress(subjectName);
    
    navigation.navigate("Difficulty", {
      category: category,
      subcategory: subcategory,
      subject: subjectName,
      user: user,
      progress: subjectProgress
    });
  };

  // Render: header (back button), subject list, bottom navigation.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title={`${category} - ${subcategory}`}
        onBack={() => navigation.goBack()}
      />
      {/* Subject list: one ProgressRow per subject (shows easy/medium/hard done marks) */}
      <FlatList
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
        data={subjects}
        keyExtractor={(item) => item}
        renderItem={({ item: subjectName, index }) => (
          <ProgressRow
            index={index}
            title={subjectName}
            progress={getSubjectProgress(subjectName)}
            onPress={() => handleSubjectPress(subjectName)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t("noSubjects")}</Text>
            <Text style={styles.emptySubtext}>{t("noSubjectsSub")}</Text>
          </View>
        }
      />
      {/* Bottom tab bar; "categories" tab stays highlighted */}
      <BottomNav navigation={navigation} user={user} activeTab="categories" />
    </View>
  );
}

// Styles: only the "empty list" message needs styles here; colors come from utils/theme.js.
const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
  },
});
