import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";

export default function QuestionFilters({
  categories,
  filterCategory,
  filterSubcategory,
  filterSubject,
  filterDifficulty,
  onCategoryChange,
  onSubcategoryChange,
  onSubjectChange,
  onDifficultyChange,
  onApply,
  onClear
}) {
  const getFilteredSubcategories = () => {
    if (!filterCategory) return [];
    const cat = categories.find(c => c.name === filterCategory);
    return cat?.subcategories || [];
  };

  const getFilteredSubjects = () => {
    if (!filterCategory || !filterSubcategory) return [];
    const cat = categories.find(c => c.name === filterCategory);
    if (cat?.subjects && typeof cat.subjects === 'object') {
      return cat.subjects[filterSubcategory] || [];
    }
    return [];
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 Filter Questions</Text>
      
      {/* Category Filter */}
      <View style={styles.filterRow}>
        <Text style={styles.label}>Category:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.optionsRow}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.option,
                  filterCategory === cat.name && styles.selectedOption
                ]}
                onPress={() => onCategoryChange(filterCategory === cat.name ? "" : cat.name)}
              >
                <Text style={[
                  styles.optionText,
                  filterCategory === cat.name && styles.selectedText
                ]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Subcategory Filter */}
      {filterCategory && getFilteredSubcategories().length > 0 && (
        <View style={styles.filterRow}>
          <Text style={styles.label}>Subcategory:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.optionsRow}>
              {getFilteredSubcategories().map(sub => (
                <TouchableOpacity
                  key={sub}
                  style={[
                    styles.option,
                    filterSubcategory === sub && styles.selectedOption
                  ]}
                  onPress={() => onSubcategoryChange(filterSubcategory === sub ? "" : sub)}
                >
                  <Text style={[
                    styles.optionText,
                    filterSubcategory === sub && styles.selectedText
                  ]}>{sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Subject Filter */}
      {filterCategory && filterSubcategory && getFilteredSubjects().length > 0 && (
        <View style={styles.filterRow}>
          <Text style={styles.label}>Subject:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.optionsRow}>
              {getFilteredSubjects().map(subject => (
                <TouchableOpacity
                  key={subject}
                  style={[
                    styles.option,
                    filterSubject === subject && styles.selectedOption
                  ]}
                  onPress={() => onSubjectChange(filterSubject === subject ? "" : subject)}
                >
                  <Text style={[
                    styles.optionText,
                    filterSubject === subject && styles.selectedText
                  ]}>{subject}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Difficulty Filter */}
      <View style={styles.filterRow}>
        <Text style={styles.label}>Difficulty:</Text>
        <View style={styles.optionsRow}>
          {["easy", "medium", "hard"].map(diff => (
            <TouchableOpacity
              key={diff}
              style={[
                styles.option,
                filterDifficulty === diff && styles.selectedOption
              ]}
              onPress={() => onDifficultyChange(filterDifficulty === diff ? "" : diff)}
            >
              <Text style={[
                styles.optionText,
                filterDifficulty === diff && styles.selectedText
              ]}>{diff.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
          <Text style={styles.btnText}>Apply Filters</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Active Filters Summary */}
      {(filterCategory || filterDifficulty) && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Active Filters:</Text>
          <Text style={styles.summaryText}>
            {[
              filterCategory && `📁 ${filterCategory}`,
              filterSubcategory && `› ${filterSubcategory}`,
              filterSubject && `› ${filterSubject}`,
              filterDifficulty && `🎯 ${filterDifficulty.toUpperCase()}`
            ].filter(Boolean).join(" ")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 16
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333"
  },
  filterRow: {
    marginBottom: 12
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    color: "#555"
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedOption: {
    backgroundColor: "#EEF2FF",
    borderColor: "#6366F1"
  },
  optionText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500"
  },
  selectedText: {
    color: "#4F46E5",
    fontWeight: "700"
  },
  actions: {
    flexDirection: "row",
    marginTop: 12
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#6366F1",
    borderRadius: 10,
    marginRight: 8,
    alignItems: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  btnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600"
  },
  clearBtnText: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "600"
  },
  summary: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1"
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1976d2",
    marginBottom: 4
  },
  summaryText: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500"
  }
});