/*
 * SubcategoriesScreen
 * What: shows the subcategories of one category (for example Tamil Nadu -> Class X, Class XI).
 * Route params: { category (full object: name + subcategories array), user }
 *   Note: here "category" is an object, but in SubjectsScreen it is only a name string.
 * Data: utils/api.js -> getUserProgress (progress marks), getAllCategories (to check if nested subjects exist).
 * Texts: t() from utils/i18n.js. Colors: utils/theme.js.
 * Next screen: "Subjects" if the category has nested subjects, otherwise directly "Difficulty".
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import ProgressRow from "../components/ProgressRow";
import { getUserProgress, getAllCategories } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors } from "../utils/theme";

export default function SubcategoriesScreen({ navigation, route }) {
  // Values sent by the previous screen (CategoriesScreen).
  const { category, user } = route.params;
  const { t } = useLang();
  // State: progress = map of "category_subcategory" -> { easy, medium, hard } done flags.
  const [progress, setProgress] = useState({});

  // Effect: load the user's progress once when the screen opens.
  useEffect(() => {
    loadUserProgress();
  }, []);

  // Helper: gets progress from utils/api.js. Only works for logged-in users (user.id).
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

  // Handler: user taps a subcategory. Decides the next screen:
  //  - category has nested subjects object -> "Subjects" screen
  //  - otherwise -> straight to "Difficulty" screen
  // If loading categories fails, the catch block uses the "Difficulty" screen as a safe fallback.
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

  // Helper: progress flags for one subcategory (default: nothing done).
  const getSubcategoryProgress = (subcategoryName) => {
    const key = `${category.name}_${subcategoryName}`;
    return progress[key] || { easy: false, medium: false, hard: false };
  };

  // Render: header (back button), subcategory list, bottom navigation.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={category.name} onBack={() => navigation.goBack()} />

      {/* Subcategory list: one ProgressRow per subcategory, data comes from category.subcategories */}
      <FlatList
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
        data={category.subcategories || []}
        keyExtractor={(item) => item}
        renderItem={({ item: subcategoryName, index }) => (
          <ProgressRow
            index={index}
            title={subcategoryName}
            progress={getSubcategoryProgress(subcategoryName)}
            onPress={() => handleSubcategoryPress(subcategoryName)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t("noSubcategories")}</Text>
            <Text style={styles.emptySubtext}>{t("noSubcategoriesSub")}</Text>
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
