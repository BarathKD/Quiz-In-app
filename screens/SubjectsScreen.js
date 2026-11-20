import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import ProgressRow from "../components/ProgressRow";
import { getUserProgress, getAllCategories } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors } from "../utils/theme";

export default function SubjectsScreen({ navigation, route }) {
  const { category, subcategory, user } = route.params;
  const { t } = useLang();
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
    
    navigation.navigate("Difficulty", {
      category: category,
      subcategory: subcategory,
      subject: subjectName,
      user: user,
      progress: subjectProgress
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title={`${category} - ${subcategory}`}
        onBack={() => navigation.goBack()}
      />
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
      <BottomNav navigation={navigation} user={user} activeTab="categories" />
    </View>
  );
}

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
