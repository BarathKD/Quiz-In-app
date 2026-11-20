import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import ProgressRow from "../components/ProgressRow";
import { getUserProgress, getAllCategories } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors } from "../utils/theme";

export default function SubcategoriesScreen({ navigation, route }) {
  const { category, user } = route.params;
  const { t } = useLang();
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={category.name} onBack={() => navigation.goBack()} />

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
