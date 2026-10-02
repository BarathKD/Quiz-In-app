import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, Modal, ScrollView } from "react-native";
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import Header from "../components/header";
import QuestionFilters from "../components/admin/QuestionFilters";
import QuestionList from "../components/admin/QuestionList";
import CategoryList from "../components/admin/CategoryList";
import { 
  addQuestion, 
  updateQuestion, 
  deleteQuestion, 
  bulkImportFromJson,
  bulkImportFromCsv,
  getAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  forceResetData,
  getQuestionsPaginated,
  getQuestionsByFilter,
  bulkDeleteQuestions,
  logoutUserSession
} from "../utils/storage";

// ============ NEW SUBCATEGORY MANAGER COMPONENT - ADD THIS ENTIRE SECTION ============
const SubcategoryManager = ({ categoryForm, setCategoryForm }) => {
  const [newSubcategory, setNewSubcategory] = useState("");
  const [selectedSubForSubjects, setSelectedSubForSubjects] = useState(null);
  const [newSubject, setNewSubject] = useState("");

  const addSubcategory = () => {
    if (!newSubcategory.trim()) return;
    
    const subcategories = categoryForm.subcategories 
      ? categoryForm.subcategories.split("\n").filter(Boolean) 
      : [];
    
    if (subcategories.includes(newSubcategory.trim())) {
      Alert.alert("Duplicate", "This subcategory already exists");
      return;
    }
    
    subcategories.push(newSubcategory.trim());
    setCategoryForm(prev => ({
      ...prev,
      subcategories: subcategories.join("\n")
    }));
    setNewSubcategory("");
  };

  const removeSubcategory = (subToRemove) => {
    const subcategories = categoryForm.subcategories
      .split("\n")
      .filter(s => s.trim() && s.trim() !== subToRemove);
    
    setCategoryForm(prev => ({
      ...prev,
      subcategories: subcategories.join("\n")
    }));
    
    if (categoryForm.hasSubcategories && categoryForm.subjects) {
      const subjectLines = categoryForm.subjects
        .split("\n")
        .filter(line => !line.startsWith(subToRemove + ":"));
      
      setCategoryForm(prev => ({
        ...prev,
        subjects: subjectLines.join("\n")
      }));
    }
  };

  const addSubject = () => {
    if (!newSubject.trim()) return;
    
    if (categoryForm.hasSubcategories && selectedSubForSubjects) {
      const subjectLines = categoryForm.subjects 
        ? categoryForm.subjects.split("\n").filter(Boolean) 
        : [];
      
      const lineIndex = subjectLines.findIndex(line => 
        line.startsWith(selectedSubForSubjects + ":")
      );
      
      if (lineIndex >= 0) {
        const parts = subjectLines[lineIndex].split(":");
        const subjects = parts[1] ? parts[1].split(",").map(s => s.trim()) : [];
        
        if (subjects.includes(newSubject.trim())) {
          Alert.alert("Duplicate", "This subject already exists");
          return;
        }
        
        subjects.push(newSubject.trim());
        subjectLines[lineIndex] = `${selectedSubForSubjects}:${subjects.join(",")}`;
      } else {
        subjectLines.push(`${selectedSubForSubjects}:${newSubject.trim()}`);
      }
      
      setCategoryForm(prev => ({
        ...prev,
        subjects: subjectLines.join("\n")
      }));
    } else {
      const subjects = categoryForm.subjects 
        ? categoryForm.subjects.split("\n").filter(Boolean) 
        : [];
      
      if (subjects.includes(newSubject.trim())) {
        Alert.alert("Duplicate", "This subject already exists");
        return;
      }
      
      subjects.push(newSubject.trim());
      setCategoryForm(prev => ({
        ...prev,
        subjects: subjects.join("\n")
      }));
    }
    
    setNewSubject("");
  };

  const removeSubject = (subToRemove, subcategory = null) => {
    if (categoryForm.hasSubcategories && subcategory) {
      const subjectLines = categoryForm.subjects.split("\n");
      const lineIndex = subjectLines.findIndex(line => 
        line.startsWith(subcategory + ":")
      );
      
      if (lineIndex >= 0) {
        const parts = subjectLines[lineIndex].split(":");
        const subjects = parts[1]
          .split(",")
          .map(s => s.trim())
          .filter(s => s !== subToRemove);
        
        if (subjects.length > 0) {
          subjectLines[lineIndex] = `${subcategory}:${subjects.join(",")}`;
        } else {
          subjectLines.splice(lineIndex, 1);
        }
        
        setCategoryForm(prev => ({
          ...prev,
          subjects: subjectLines.join("\n")
        }));
      }
    } else {
      const subjects = categoryForm.subjects
        .split("\n")
        .filter(s => s.trim() && s.trim() !== subToRemove);
      
      setCategoryForm(prev => ({
        ...prev,
        subjects: subjects.join("\n")
      }));
    }
  };

  const getSubcategoryList = () => {
    return categoryForm.subcategories 
      ? categoryForm.subcategories.split("\n").filter(Boolean).map(s => s.trim())
      : [];
  };

  const getSubjectsList = (subcategory = null) => {
    if (!categoryForm.subjects) return [];
    
    if (categoryForm.hasSubcategories && subcategory) {
      const line = categoryForm.subjects
        .split("\n")
        .find(l => l.startsWith(subcategory + ":"));
      
      if (line) {
        const parts = line.split(":");
        return parts[1] ? parts[1].split(",").map(s => s.trim()).filter(Boolean) : [];
      }
      return [];
    } else {
      return categoryForm.subjects.split("\n").filter(Boolean).map(s => s.trim());
    }
  };

  return (
    <View style={styles.subcategoryManager}>
      {categoryForm.hasSubcategories && (
        <View style={styles.managerSection}>
          <Text style={styles.managerTitle}>📚 Subcategories</Text>
          
          <View style={styles.inputRow}>
            <TextInput
              style={styles.managerInput}
              placeholder="Enter subcategory name"
              value={newSubcategory}
              onChangeText={setNewSubcategory}
              onSubmitEditing={addSubcategory}
            />
            <TouchableOpacity style={styles.addButton} onPress={addSubcategory}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chipContainer}>
            {getSubcategoryList().map((sub, index) => (
              <View key={index} style={styles.chip}>
                <Text style={styles.chipText}>{sub}</Text>
                <TouchableOpacity onPress={() => removeSubcategory(sub)}>
                  <Text style={styles.chipRemove}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.managerSection}>
        <Text style={styles.managerTitle}>
          {categoryForm.hasSubcategories ? "📖 Subjects" : "📖 Subjects/Topics"}
        </Text>
        
        {categoryForm.hasSubcategories && getSubcategoryList().length > 0 && (
          <View style={styles.subcategorySelector}>
            <Text style={styles.selectorLabel}>Select subcategory to add subjects:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.selectorRow}>
                {getSubcategoryList().map((sub, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.selectorChip,
                      selectedSubForSubjects === sub && styles.selectorChipActive
                    ]}
                    onPress={() => setSelectedSubForSubjects(sub)}
                  >
                    <Text style={[
                      styles.selectorChipText,
                      selectedSubForSubjects === sub && styles.selectorChipTextActive
                    ]}>{sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {(!categoryForm.hasSubcategories || selectedSubForSubjects) && (
          <>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.managerInput}
                placeholder={`Enter ${categoryForm.hasSubcategories ? 'subject' : 'subject/topic'} name`}
                value={newSubject}
                onChangeText={setNewSubject}
                onSubmitEditing={addSubject}
              />
              <TouchableOpacity style={styles.addButton} onPress={addSubject}>
                <Text style={styles.addButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.chipContainer}>
              {getSubjectsList(selectedSubForSubjects).map((subject, index) => (
                <View key={index} style={[styles.chip, styles.subjectChip]}>
                  <Text style={styles.chipText}>{subject}</Text>
                  <TouchableOpacity onPress={() => removeSubject(subject, selectedSubForSubjects)}>
                    <Text style={styles.chipRemove}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
};
// ============ END OF NEW COMPONENT ============

export default function AdminScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState("categories");
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  
  
  // Pagination for questions
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  
  // Filter states for questions
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSubcategory, setFilterSubcategory] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  
  // Question modal states
  const [questionModalVisible, setQuestionModalVisible] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    category: "",
    subcategory: "", 
    subject: "",
    difficulty: "easy", 
    questionText: "", 
    optionsText: "", 
    correct: "a", 
    explanation: ""
  });


  // Category modal states
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    subcategories: "",
    subjects: "",
    hasSubcategories: false,
    backgroundOpacity: 0.3,
    timer: "30",
    subjectTimers: ""
  });
  
  // Import states
  const [bulkText, setBulkText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importCategory, setImportCategory] = useState("");
  const [importSubcategory, setImportSubcategory] = useState("");
  const [importSubject, setImportSubject] = useState("");
  const [importDifficulty, setImportDifficulty] = useState("easy");
  
  // CSV File states
  const [csvFileData, setCsvFileData] = useState("");
  const [selectedCsvFile, setSelectedCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  
  // Bulk delete modal states
  const [bulkDeleteModalVisible, setBulkDeleteModalVisible] = useState(false);
  const [bulkDeleteCategory, setBulkDeleteCategory] = useState("");
  const [bulkDeleteSubcategory, setBulkDeleteSubcategory] = useState("");
  const [bulkDeleteSubject, setBulkDeleteSubject] = useState("");
  const [bulkDeleteDifficulty, setBulkDeleteDifficulty] = useState("");
  
  const user = route?.params?.user;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [categoriesData] = await Promise.all([
        getAllCategories()
      ]);
      setCategories(categoriesData);
      
      // Set default import category if categories exist
      if (categoriesData.length > 0 && !importCategory) {
        setImportCategory(categoriesData[0].name);
        if (categoriesData[0].subcategories && categoriesData[0].subcategories.length > 0) {
          setImportSubcategory(categoriesData[0].subcategories[0]);
        }
      }
      
      // Load questions with pagination
      await loadQuestionsWithPagination(0);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };


  // Load questions with pagination for better performance
  const loadQuestionsWithPagination = async (page = 0, reset = true) => {
    if (isLoadingQuestions) return;
    
    setIsLoadingQuestions(true);
    try {
      let questionData;
      
      // If filters are applied, use filtered query
      if (filterCategory || filterSubcategory || filterSubject || filterDifficulty) {
        const filteredQuestions = await getQuestionsByFilter(
          filterCategory || null,
          filterSubcategory || null,
          filterSubject || null,
          filterDifficulty || null
        );
        
        // Manual pagination for filtered results
        const start = page * 50;
        const end = start + 50;
        questionData = {
          questions: filteredQuestions.slice(start, end),
          totalCount: filteredQuestions.length,
          hasMore: end < filteredQuestions.length
        };
      } else {
        // Use paginated query for all questions
        questionData = await getQuestionsPaginated(page, 50);
      }
      
      if (reset) {
        setQuestions(questionData.questions);
      } else {
        setQuestions(prev => [...prev, ...questionData.questions]);
      }
      
      setTotalQuestions(questionData.totalCount);
      setHasMoreQuestions(questionData.hasMore);
      setCurrentPage(page);
    } catch (error) {
      console.error("Error loading questions:", error);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // Apply filters to questions
  const applyFilters = async () => {
    await loadQuestionsWithPagination(0, true);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterCategory("");
    setFilterSubcategory("");
    setFilterSubject("");
    setFilterDifficulty("");
    loadQuestionsWithPagination(0, true);
  };

  // Load more questions (pagination)
  const loadMoreQuestions = async () => {
    if (hasMoreQuestions && !isLoadingQuestions) {
      await loadQuestionsWithPagination(currentPage + 1, false);
    }
  };

  // Bulk Delete Questions
  const handleBulkDelete = async () => {
    if (!bulkDeleteCategory && !bulkDeleteSubcategory && !bulkDeleteSubject && !bulkDeleteDifficulty) {
      Alert.alert("Error", "Please select at least one filter criteria");
      return;
    }

    const filterDesc = [
      bulkDeleteCategory && `Category: ${bulkDeleteCategory}`,
      bulkDeleteSubcategory && `Subcategory: ${bulkDeleteSubcategory}`,
      bulkDeleteSubject && `Subject: ${bulkDeleteSubject}`,
      bulkDeleteDifficulty && `Difficulty: ${bulkDeleteDifficulty}`
    ].filter(Boolean).join(", ");

    Alert.alert(
      "Bulk Delete Questions",
      `This will delete ALL questions matching: ${filterDesc}. Are you sure?`,
      [
        { text: "Cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const deletedCount = await bulkDeleteQuestions(
                bulkDeleteCategory || null,
                bulkDeleteSubcategory || null,
                bulkDeleteSubject || null,
                bulkDeleteDifficulty || null
              );
              
              Alert.alert("Success", `${deletedCount} questions deleted successfully`);
              setBulkDeleteModalVisible(false);
              
              // Reset bulk delete form
              setBulkDeleteCategory("");
              setBulkDeleteSubcategory("");
              setBulkDeleteSubject("");
              setBulkDeleteDifficulty("");
              
              // Reload questions
              await loadQuestionsWithPagination(0, true);
            } catch (error) {
              console.error("Bulk delete error:", error);
              Alert.alert("Error", "Failed to delete questions");
            }
          }
        }
      ]
    );
  };

  // Get filtered subcategories for bulk delete
  const getBulkDeleteSubcategories = () => {
    const category = categories.find(c => c.name === bulkDeleteCategory);
    return category?.subcategories || [];
  };

  // Get filtered subjects for bulk delete
  const getBulkDeleteSubjects = () => {
    const category = categories.find(c => c.name === bulkDeleteCategory);
    if (category?.subjects && typeof category.subjects === 'object') {
      return category.subjects[bulkDeleteSubcategory] || [];
    }
    return [];
  };

  // Excel File Picker Function
  const pickExcelFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setSelectedCsvFile(file);
        await readExcelFile(file.uri);
      }
    } catch (error) {
      console.error('Error picking Excel file:', error);
      Alert.alert("Error", "Failed to pick Excel file");
    }
  };

  // Read Excel File Function
  const readExcelFile = async (fileUri) => {
    try {
      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'base64',
      });
      
      const workbook = XLSX.read(fileContent, { type: 'base64' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      
      // Parse CSV content for preview
      const lines = csvContent.trim().split('\n');
      const excelData = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = parseCSVLine(line);
        if (columns.length >= 8) {
          excelData.push(columns);
        }
      }
      
      setCsvFileData(csvContent);
      setCsvPreview(excelData.slice(0, 3)); // Preview first 3 questions
      Alert.alert("Success", `Loaded ${excelData.length} questions from Excel file`);
      
    } catch (error) {
      console.error('Error reading Excel file:', error);
      Alert.alert("Error", "Failed to read Excel file. Please check the file format.");
    }
  };

  // Helper function to parse CSV line (handles quotes and commas)
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  // Import Excel File Function
  const handleExcelFileImport = async () => {
    if (!importCategory || !importSubcategory) {
      Alert.alert("Error", "Please select category and subcategory");
      return;
    }

    if (!csvFileData) {
      Alert.alert("Error", "Please select an Excel file first");
      return;
    }

    try {
      const result = await bulkImportFromCsv(
        csvFileData, 
        importCategory, 
        importSubcategory, 
        importSubject || null, 
        importDifficulty
      );
      
      const addedCount = typeof result === 'object' ? result.addedCount : result;
      const skippedLines = typeof result === 'object' ? result.skippedLines : [];
      
      let message = `${addedCount} questions imported from Excel file to ${importCategory} > ${importSubcategory}${importSubject ? ' > ' + importSubject : ''}`;
      
      if (skippedLines && skippedLines.length > 0) {
        message += `\n\nSkipped ${skippedLines.length} rows:\n${skippedLines.join('\n')}`;
      }
      
      Alert.alert("Success", message);
      
      // Clear file data and reload
      setCsvFileData("");
      setSelectedCsvFile(null);
      setCsvPreview([]);
      await loadData();
      
    } catch (error) {
      console.error("Excel File Import error:", error);
      Alert.alert("Import Error", error.message || "Failed to import Excel file. Please check the format.");
    }
  };

  // Reset all data function
  const resetAllData = async () => {
    Alert.alert(
      "Reset All Data", 
      "This will delete all categories, questions, and user progress, then reload with fresh sample data. Are you sure?", 
      [
        { text: "Cancel" },
        { 
          text: "Reset", 
          style: "destructive",
          onPress: async () => {
            try {
              await forceResetData();
              Alert.alert("Success", "Data has been reset with new categories and questions");
              await loadData();
            } catch (error) {
              Alert.alert("Error", "Failed to reset data");
            }
          }
        }
      ]
    );
  };

  // Category Management Functions
  const openNewCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ 
      name: "", 
      description: "", 
      subcategories: "",
      subjects: "",
      hasSubcategories: false,
      backgroundOpacity: 0.3,
      timer: "30",
      subjectTimers: ""
    });
    setCategoryModalVisible(true);
  };

  const saveCategory = async () => {
    try {
      console.log("=== SAVING CATEGORY ===");
      
      const categoryObj = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        backgroundOpacity: categoryForm.backgroundOpacity,
        timer: parseInt(categoryForm.timer) || 30,
        subjectTimers: {}
      };

      if (categoryForm.subjectTimers.trim()) {
        const timers = {};
        categoryForm.subjectTimers.split('\n').forEach(line => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            timers[parts[0].trim()] = parseInt(parts[1].trim()) || 30;
          }
        });
        categoryObj.subjectTimers = timers;
      }

      if (categoryForm.hasSubcategories && categoryForm.subcategories.trim()) {
        const subcategoriesArray = categoryForm.subcategories
          .split("\n")
          .map(s => s.trim())
          .filter(Boolean);
        
        categoryObj.subcategories = subcategoriesArray;

        if (categoryForm.subjects.trim()) {
          const subjectsObj = {};
          const subjectLines = categoryForm.subjects.split("\n").filter(Boolean);
          
          subjectLines.forEach(line => {
            const [subcategory, subjectsStr] = line.split(":");
            if (subcategory && subjectsStr) {
              const subjects = subjectsStr.split(",").map(s => s.trim()).filter(Boolean);
              subjectsObj[subcategory.trim()] = subjects;
            }
          });
          
          if (Object.keys(subjectsObj).length > 0) {
            categoryObj.subjects = subjectsObj;
          }
        }
      } else {
        if (categoryForm.subjects.trim()) {
          const subjectsArray = categoryForm.subjects
            .split("\n")
            .map(s => s.trim())
            .filter(Boolean);
          categoryObj.subcategories = subjectsArray;
        }
      }

      let categoryId;
      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryObj);
        categoryId = editingCategory.id;
        console.log("Category updated:", categoryId);
      } else {
        categoryId = await addCategory(categoryObj);
        console.log("Category created:", categoryId);
      }

      Alert.alert("Success", "Category saved successfully");
      
      setCategoryModalVisible(false);
      await loadData();
    } catch (error) {
      console.error("Error saving category:", error);
      Alert.alert("Error", "Failed to save category: " + error.message);
    }
  };

  const startEditCategory = async (category) => {
    setEditingCategory(category);
    
    const hasNestedStructure = category.subjects && typeof category.subjects === 'object';
    
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      hasSubcategories: hasNestedStructure,
      subcategories: hasNestedStructure ? (category.subcategories || []).join("\n") : "",
      subjects: hasNestedStructure ? 
        Object.entries(category.subjects || {})
          .map(([sub, subjects]) => `${sub}:${subjects.join(",")}`)
          .join("\n") :
        (category.subcategories || []).join("\n"),
      backgroundOpacity: category.backgroundOpacity || 0.3,
      timer: category.timer ? category.timer.toString() : "30",
      subjectTimers: category.subjectTimers 
        ? Object.entries(category.subjectTimers).map(([k, v]) => `${k}:${v}`).join("\n")
        : ""
    });
    setCategoryModalVisible(true);
  };

  const onDeleteCategory = (category) => {
    Alert.alert(
      "Confirm Delete", 
      "Delete category? This will also delete all associated questions and background image.", 
      [
        { text: "Cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              
              // Then delete category
              await deleteCategory(category.id);
              await loadData();
              Alert.alert("Success", "Category deleted successfully");
            } catch (error) {
              console.error("Error deleting category:", error);
              Alert.alert("Error", "Failed to delete category");
            }
          }
        }
      ]
    );
  };

  // Question Management Functions
  const openNewQuestion = () => {
    setEditingQuestion(null);
    setQuestionForm({
      category: categories[0]?.name || "",
      subcategory: "",
      subject: "",
      difficulty: "easy", 
      questionText: "", 
      optionsText: "a:Option1\nb:Option2\nc:Option3\nd:Option4", 
      correct: "a", 
      explanation: ""
    });
    setQuestionModalVisible(true);
  };

  const saveQuestion = async () => {
    try {
      const optLines = questionForm.optionsText.split("\n").map(l => l.trim()).filter(Boolean);
      const options = optLines.map(l => {
        const [id, ...rest] = l.split(":");
        return { id: id.trim(), text: rest.join(":").trim() };
      });
      
      const qObj = {
        category: questionForm.category,
        subcategory: questionForm.subcategory,
        difficulty: questionForm.difficulty,
        questionText: questionForm.questionText,
        options,
        correctOptionId: questionForm.correct,
        explanation: questionForm.explanation
      };

      if (questionForm.subject) {
        qObj.subject = questionForm.subject;
      }
      
      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, qObj);
      } else {
        await addQuestion(qObj);
      }
      
      setQuestionModalVisible(false);
      await loadData();
    } catch (error) {
      Alert.alert("Error", "Failed to save question");
    }
  };

  const startEditQuestion = (q) => {
    setEditingQuestion(q);
    setQuestionForm({
      category: q.category || "",
      subcategory: q.subcategory || "",
      subject: q.subject || "",
      difficulty: q.difficulty,
      questionText: q.questionText,
      optionsText: q.options.map(o => `${o.id}:${o.text}`).join("\n"),
      correct: q.correctOptionId,
      explanation: q.explanation || ""
    });
    setQuestionModalVisible(true);
  };

  const onDeleteQuestion = (id) => {
    Alert.alert("Confirm", "Delete question?", [
      { text: "Cancel" },
      { 
        text: "Delete", 
        onPress: async () => {
          try {
            await deleteQuestion(id);
            await loadData();
          } catch (error) {
            Alert.alert("Error", "Failed to delete question");
          }
        }
      }
    ]);
  };

  // Import helper functions
  const getImportCategoryData = () => {
    return categories.find(c => c.name === importCategory) || {};
  };

  const getImportSubcategories = () => {
    const categoryObj = getImportCategoryData();
    return categoryObj.subcategories || [];
  };

  const getImportSubjects = () => {
    const categoryObj = getImportCategoryData();
    if (categoryObj.subjects && typeof categoryObj.subjects === 'object') {
      return categoryObj.subjects[importSubcategory] || [];
    }
    return [];
  };

  // Import Functions
  const handleJsonImport = async () => {
    if (!importCategory || !importSubcategory) {
      Alert.alert("Error", "Please select category and subcategory");
      return;
    }

    if (!bulkText.trim()) {
      Alert.alert("Error", "Please enter JSON data to import");
      return;
    }

    try {
      const result = await bulkImportFromJson(
        bulkText, 
        importCategory, 
        importSubcategory, 
        importSubject || null, 
        importDifficulty
      );
      
      const addedCount = typeof result === 'object' ? result.addedCount : result;
      const skippedLines = typeof result === 'object' ? result.skippedLines : [];
      
      let message = `${addedCount} questions imported from JSON to ${importCategory} > ${importSubcategory}${importSubject ? ' > ' + importSubject : ''}`;
      
      if (skippedLines && skippedLines.length > 0) {
        message += `\n\nSkipped ${skippedLines.length} items:\n${skippedLines.join('\n')}`;
      }
      
      Alert.alert("Success", message);
      setBulkText("");
      await loadData();
    } catch (error) {
      console.error("JSON Import error:", error);
      Alert.alert("Import Error", error.message || "Failed to import JSON data. Please check the format.");
    }
  };

  const handleCsvImport = async () => {
    if (!importCategory || !importSubcategory) {
      Alert.alert("Error", "Please select category and subcategory");
      return;
    }

    if (!csvText.trim()) {
      Alert.alert("Error", "Please enter CSV data to import");
      return;
    }

    try {
      const addedCount = await bulkImportFromCsv(
        csvText, 
        importCategory, 
        importSubcategory, 
        importSubject || null, 
        importDifficulty
      );
      
      Alert.alert("Success", addedCount + " questions imported to " + importCategory + " > " + importSubcategory + (importSubject ? " > " + importSubject : ""));
      setCsvText("");
      await loadData();
    } catch (error) {
      console.error("CSV Import error:", error);
      Alert.alert("Import Error", error.message || "Failed to import CSV data. Please check the format.");
    }
  };

  const getSelectedCategoryData = () => {
    const selectedCategory = categories.find(c => c.name === questionForm.category);
    return selectedCategory || {};
  };

  const getSelectedCategorySubcategories = () => {
    const selectedCategory = getSelectedCategoryData();
    return selectedCategory.subcategories || [];
  };

  const getSelectedSubcategorySubjects = () => {
    const selectedCategory = getSelectedCategoryData();
    if (selectedCategory.subjects && typeof selectedCategory.subjects === 'object') {
      return selectedCategory.subjects[questionForm.subcategory] || [];
    }
    return [];
  };

  // ─── Timer helpers ────────────────────────────────────────────────────
  // Flatten all subjects from the category form into a plain array
  const getAllSubjectsFromForm = () => {
    if (!categoryForm.subjects || !categoryForm.subjects.trim()) return [];
    const subjects = [];
    if (categoryForm.hasSubcategories) {
      // Lines are: "Subcategory:Subject1,Subject2"
      categoryForm.subjects.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts[1]) {
          parts[1].split(',').forEach(s => {
            const name = s.trim();
            if (name) subjects.push(name);
          });
        }
      });
    } else {
      categoryForm.subjects.split('\n').forEach(s => {
        const name = s.trim();
        if (name) subjects.push(name);
      });
    }
    // Deduplicate
    return [...new Set(subjects)];
  };

  // Get a single subject's timer from the subjectTimers string
  const getSubjectTimerValue = (subject) => {
    if (!categoryForm.subjectTimers) return '';
    const line = categoryForm.subjectTimers
      .split('\n')
      .find(l => l.startsWith(subject + ':'));
    if (line) return line.split(':')[1]?.trim() || '';
    return '';
  };

  // Update one subject's timer inside the subjectTimers string
  const updateSubjectTimer = (subject, value) => {
    const lines = categoryForm.subjectTimers
      ? categoryForm.subjectTimers.split('\n').filter(Boolean)
      : [];
    const idx = lines.findIndex(l => l.startsWith(subject + ':'));
    if (value === '' || value === '0') {
      if (idx >= 0) lines.splice(idx, 1);
    } else {
      const entry = `${subject}:${value}`;
      if (idx >= 0) lines[idx] = entry;
      else lines.push(entry);
    }
    setCategoryForm(f => ({ ...f, subjectTimers: lines.join('\n') }));
  };
  // ──────────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel" },
      { 
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logoutUserSession();
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }]
          });
        }
      }
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerContainer}>
        <Header title="Admin Dashboard" />
      </View>
      
      <ScrollView style={{ flex: 1, backgroundColor: "#f5f5f5", padding: 12 }}>
        {activeTab === "categories" && (
          <View>
            <TouchableOpacity style={styles.btn} onPress={openNewCategory}>
              <Text style={styles.btnText}>Add New Category</Text>
            </TouchableOpacity>


            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: "#EF4444", marginTop: 8 }]} 
              onPress={resetAllData}
            >
              <Text style={styles.btnText}>Reset All Data</Text>
            </TouchableOpacity>
            

            <Text style={styles.sectionTitle}>Categories ({categories.length})</Text>
            <CategoryList
              categories={categories}
              onEdit={startEditCategory}
              onDelete={onDeleteCategory}
            />
          </View>
        )}
        {activeTab === "questions" && (
          <View>
            <TouchableOpacity style={styles.btn} onPress={openNewQuestion}>
              <Text style={styles.btnText}>Add New Question</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: "#6366F1", marginTop: 8 }]} 
              onPress={() => setImportModalVisible(true)}
            >
              <Text style={styles.btnText}>Bulk Import Questions</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: "#EF4444", marginTop: 8 }]} 
              onPress={() => setBulkDeleteModalVisible(true)}
            >
              <Text style={styles.btnText}>Bulk Delete Questions</Text>
            </TouchableOpacity>

            {/* Filters */}
            <QuestionFilters
              categories={categories}
              filterCategory={filterCategory}
              filterSubcategory={filterSubcategory}
              filterSubject={filterSubject}
              filterDifficulty={filterDifficulty}
              onCategoryChange={setFilterCategory}
              onSubcategoryChange={setFilterSubcategory}
              onSubjectChange={setFilterSubject}
              onDifficultyChange={setFilterDifficulty}
              onApply={applyFilters}
              onClear={clearFilters}
            />

            <Text style={styles.sectionTitle}>Questions ({totalQuestions})</Text>
            <QuestionList
              questions={questions}
              totalQuestions={totalQuestions}
              hasMoreQuestions={hasMoreQuestions}
              isLoadingQuestions={isLoadingQuestions}
              onEdit={startEditQuestion}
              onDelete={onDeleteQuestion}
              onLoadMore={loadMoreQuestions}
            />
          </View>
        )}
        {activeTab === "admin" && (
          <View style={styles.adminProfileContainer}>
            <View style={styles.profileCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{user?.email?.charAt(0).toUpperCase() || 'A'}</Text>
              </View>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profileRole}>Administrator</Text>
            </View>

            <TouchableOpacity style={styles.logoutCardBtn} onPress={handleLogout}>
              <View style={styles.logoutIconContainer}>
                <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              </View>
              <View style={styles.logoutTextContainer}>
                <Text style={styles.logoutCardTitle}>Logout</Text>
                <Text style={styles.logoutCardSub}>Sign out of your account</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavContainer}>
        <TouchableOpacity 
          style={styles.bottomNavTab}
          onPress={() => setActiveTab("categories")}
        >
          <Ionicons name="folder" size={24} color={activeTab === "categories" ? "#6366F1" : "#888"} />
          <Text style={[styles.bottomNavText, activeTab === "categories" && styles.activeBottomNavText]}>
            Categories
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavTab}
          onPress={() => setActiveTab("questions")}
        >
          <Ionicons name="help-circle" size={24} color={activeTab === "questions" ? "#6366F1" : "#888"} />
          <Text style={[styles.bottomNavText, activeTab === "questions" && styles.activeBottomNavText]}>
            Questions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavTab}
          onPress={() => setActiveTab("admin")}
        >
          <Ionicons name="person" size={24} color={activeTab === "admin" ? "#6366F1" : "#888"} />
          <Text style={[styles.bottomNavText, activeTab === "admin" && styles.activeBottomNavText]}>
            Admin
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bulk Delete Modal */}
      <Modal visible={bulkDeleteModalVisible} animationType="slide">
        <ScrollView style={{ padding: 16 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bulk Delete Questions</Text>
            <TouchableOpacity 
              onPress={() => setBulkDeleteModalVisible(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>X</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.configSection}>
            <Text style={styles.configTitle}>Select Questions to Delete</Text>
            
            {/* Category Selection */}
            <Text style={styles.label}>Category (Optional)</Text>
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  !bulkDeleteCategory && styles.selectedOption
                ]}
                onPress={() => setBulkDeleteCategory("")}
              >
                <Text style={[
                  styles.pickerText,
                  !bulkDeleteCategory && styles.selectedText
                ]}>All Categories</Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.pickerOption,
                    bulkDeleteCategory === cat.name && styles.selectedOption
                  ]}
                  onPress={() => {
                    setBulkDeleteCategory(cat.name);
                    setBulkDeleteSubcategory("");
                    setBulkDeleteSubject("");
                  }}
                >
                  <Text style={[
                    styles.pickerText,
                    bulkDeleteCategory === cat.name && styles.selectedText
                  ]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subcategory Selection */}
            {bulkDeleteCategory && (
              <>
                <Text style={styles.label}>Subcategory (Optional)</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={[
                      styles.pickerOption,
                      !bulkDeleteSubcategory && styles.selectedOption
                    ]}
                    onPress={() => setBulkDeleteSubcategory("")}
                  >
                    <Text style={[
                      styles.pickerText,
                      !bulkDeleteSubcategory && styles.selectedText
                    ]}>All Subcategories</Text>
                  </TouchableOpacity>
                  {getBulkDeleteSubcategories().map(sub => (
                    <TouchableOpacity
                      key={sub}
                      style={[
                        styles.pickerOption,
                        bulkDeleteSubcategory === sub && styles.selectedOption
                      ]}
                      onPress={() => {
                        setBulkDeleteSubcategory(sub);
                        setBulkDeleteSubject("");
                      }}
                    >
                      <Text style={[
                        styles.pickerText,
                        bulkDeleteSubcategory === sub && styles.selectedText
                      ]}>{sub}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Subject Selection */}
            {bulkDeleteCategory && bulkDeleteSubcategory && getBulkDeleteSubjects().length > 0 && (
              <>
                <Text style={styles.label}>Subject (Optional)</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={[
                      styles.pickerOption,
                      !bulkDeleteSubject && styles.selectedOption
                    ]}
                    onPress={() => setBulkDeleteSubject("")}
                  >
                    <Text style={[
                      styles.pickerText,
                      !bulkDeleteSubject && styles.selectedText
                    ]}>All Subjects</Text>
                  </TouchableOpacity>
                  {getBulkDeleteSubjects().map(subject => (
                    <TouchableOpacity
                      key={subject}
                      style={[
                        styles.pickerOption,
                        bulkDeleteSubject === subject && styles.selectedOption
                      ]}
                      onPress={() => setBulkDeleteSubject(subject)}
                    >
                      <Text style={[
                        styles.pickerText,
                        bulkDeleteSubject === subject && styles.selectedText
                      ]}>{subject}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Difficulty Selection */}
            <Text style={styles.label}>Difficulty (Optional)</Text>
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  !bulkDeleteDifficulty && styles.selectedOption
                ]}
                onPress={() => setBulkDeleteDifficulty("")}
              >
                <Text style={[
                  styles.pickerText,
                  !bulkDeleteDifficulty && styles.selectedText
                ]}>All Difficulties</Text>
              </TouchableOpacity>
              {["easy", "medium", "hard"].map(diff => (
                <TouchableOpacity
                  key={diff}
                  style={[
                    styles.pickerOption,
                    bulkDeleteDifficulty === diff && styles.selectedOption
                  ]}
                  onPress={() => setBulkDeleteDifficulty(diff)}
                >
                  <Text style={[
                    styles.pickerText,
                    bulkDeleteDifficulty === diff && styles.selectedText
                  ]}>{diff.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Delete Summary */}
            <View style={styles.deleteSummary}>
              <Text style={styles.summaryText}>
                This will delete questions matching:
              </Text>
              <Text style={styles.summaryPath}>
                {bulkDeleteCategory || "Any Category"}
                {bulkDeleteSubcategory && ` > ${bulkDeleteSubcategory}`}
                {bulkDeleteSubject && ` > ${bulkDeleteSubject}`}
                {bulkDeleteDifficulty && ` • ${bulkDeleteDifficulty.toUpperCase()}`}
              </Text>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.btn, styles.cancelBtn]} 
              onPress={() => setBulkDeleteModalVisible(false)}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: "#EF4444" }]} 
              onPress={handleBulkDelete}
            >
              <Text style={styles.btnText}>Delete Questions</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      {/* Import Modal */}
      <Modal visible={importModalVisible} animationType="slide">
        <ScrollView style={{ padding: 16 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bulk Import Questions</Text>
            <TouchableOpacity 
              onPress={() => setImportModalVisible(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>X</Text>
            </TouchableOpacity>
          </View>

          {/* Import Configuration */}
          <View style={styles.configSection}>
            <Text style={styles.configTitle}>Import Destination</Text>
            
            {/* Category Selection */}
            <Text style={styles.label}>Category</Text>
            <View style={styles.pickerContainer}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.pickerOption,
                    importCategory === cat.name && styles.selectedOption
                  ]}
                  onPress={() => {
                    setImportCategory(cat.name);
                    setImportSubcategory(cat.subcategories?.[0] || "");
                    setImportSubject("");
                  }}
                >
                  <Text style={[
                    styles.pickerText,
                    importCategory === cat.name && styles.selectedText
                  ]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subcategory Selection */}
            <Text style={styles.label}>Subcategory</Text>
            <View style={styles.pickerContainer}>
              {getImportSubcategories().map(sub => (
                <TouchableOpacity
                  key={sub}
                  style={[
                    styles.pickerOption,
                    importSubcategory === sub && styles.selectedOption
                  ]}
                  onPress={() => {
                    setImportSubcategory(sub);
                    setImportSubject("");
                  }}
                >
                  <Text style={[
                    styles.pickerText,
                    importSubcategory === sub && styles.selectedText
                  ]}>{sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subject Selection (if available) */}
            {getImportSubjects().length > 0 && (
              <>
                <Text style={styles.label}>Subject (Optional)</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={[
                      styles.pickerOption,
                      !importSubject && styles.selectedOption
                    ]}
                    onPress={() => setImportSubject("")}
                  >
                    <Text style={[
                      styles.pickerText,
                      !importSubject && styles.selectedText
                    ]}>No Subject</Text>
                  </TouchableOpacity>
                  {getImportSubjects().map(subject => (
                    <TouchableOpacity
                      key={subject}
                      style={[
                        styles.pickerOption,
                        importSubject === subject && styles.selectedOption
                      ]}
                      onPress={() => setImportSubject(subject)}
                    >
                      <Text style={[
                        styles.pickerText,
                        importSubject === subject && styles.selectedText
                      ]}>{subject}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Difficulty Selection */}
            <Text style={styles.label}>Difficulty</Text>
            <View style={styles.pickerContainer}>
              {["easy", "medium", "hard"].map(diff => (
                <TouchableOpacity
                  key={diff}
                  style={[
                    styles.pickerOption,
                    importDifficulty === diff && styles.selectedOption
                  ]}
                  onPress={() => setImportDifficulty(diff)}
                >
                  <Text style={[
                    styles.pickerText,
                    importDifficulty === diff && styles.selectedText
                  ]}>{diff.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Import Summary */}
            <View style={styles.importSummary}>
              <Text style={styles.summaryText}>
                Questions will be imported to:
              </Text>
              <Text style={styles.summaryPath}>
                {importCategory} {" > "} {importSubcategory}
                {importSubject && " > " + importSubject} • {importDifficulty.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Excel File Import Section - PRIMARY METHOD */}
          <View style={styles.importSection}>
            <Text style={styles.label}>Method 1: Import Excel File (Recommended)</Text>
            <Text style={styles.helpText}>
              Pick an Excel (.xlsx) file from your device storage. Format: ID, Question, Option A, Option B, Option C, Option D, Correct Answer (A/B/C/D), Explanation
            </Text>
            
            <View style={styles.csvFileSection}>
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: "#6366F1", marginBottom: 12 }]} 
                onPress={pickExcelFile}
              >
                <Text style={styles.btnText}>📁 Pick Excel File from Storage</Text>
              </TouchableOpacity>
              
              {selectedCsvFile && (
                <View style={styles.selectedFileInfo}>
                  <Text style={styles.selectedFileText}>Selected: {selectedCsvFile.name}</Text>
                  <Text style={styles.selectedFileSize}>
                    Size: {(selectedCsvFile.size / 1024).toFixed(1)} KB | Questions loaded: {csvPreview.length}
                  </Text>
                </View>
              )}
              
              {csvPreview.length > 0 && (
                <View style={styles.csvPreview}>
                  <Text style={styles.previewTitle}>Preview (first 3 questions):</Text>
                  {csvPreview.map((row, index) => (
                    <View key={index} style={styles.previewQuestion}>
                      <Text style={styles.previewQuestionText} numberOfLines={2}>
                        {index + 1}. {row[1]}
                      </Text>
                      <Text style={styles.previewOptions} numberOfLines={1}>
                        A: {row[2]} | B: {row[3]} | Correct: {row[6]}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              <TouchableOpacity 
                style={[
                  styles.btn, 
                  { 
                    backgroundColor: csvFileData ? "#F59E0B" : "#ccc",
                    marginTop: 8 
                  }
                ]} 
                onPress={handleExcelFileImport}
                disabled={!csvFileData}
              >
                <Text style={styles.btnText}>
                  Import {csvPreview.length} Questions from Excel File
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.importInstructions}>
            Alternative Methods: Manual CSV or JSON Input
          </Text>

          <View style={styles.importSection}>
            <Text style={styles.label}>Method 2: Paste CSV Data</Text>
            <Text style={styles.helpText}>
              Manually paste CSV data if file picker doesnt work
            </Text>
            
            <TextInput 
              value={csvText} 
              onChangeText={setCsvText} 
              multiline 
              style={styles.importInput} 
              placeholder={`1,What is the capital of France?,Paris,London,Berlin,Madrid,A,Paris is the capital of France.
2,What is 2+2?,3,4,5,6,B,Basic arithmetic: 2 plus 2 equals 4.
3,Who wrote Romeo and Juliet?,Shakespeare,Dickens,Tolkien,Orwell,A,William Shakespeare wrote this famous tragedy.`}
            />
            <TouchableOpacity style={[styles.btn, { marginTop: 8 }]} onPress={handleCsvImport}>
              <Text style={styles.btnText}>Import Manual CSV Data</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.importSection}>
            <Text style={styles.label}>Method 3: JSON Format (Advanced)</Text>
            <Text style={styles.helpText}>
              Array of question objects with questionText, options, correctOptionId, and explanation
            </Text>
            <TextInput 
              value={bulkText} 
              onChangeText={setBulkText} 
              multiline 
              style={styles.importInput} 
              placeholder={`[
  {
    "questionText": "What is the capital of France?",
    "options": [
      {"id": "a", "text": "Paris"},
      {"id": "b", "text": "London"},
      {"id": "c", "text": "Berlin"},
      {"id": "d", "text": "Madrid"}
    ],
    "correctOptionId": "a",
    "explanation": "Paris is the capital of France."
  }
]`}
            />
            <TouchableOpacity style={[styles.btn, { marginTop: 8 }]} onPress={handleJsonImport}>
              <Text style={styles.btnText}>Import JSON Data</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      {/* Enhanced Category Modal with Image Support */}
      <Modal visible={categoryModalVisible} animationType="slide">
        <ScrollView style={{ padding: 12 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingCategory ? "Edit Category" : "New Category"}
            </Text>
            <TouchableOpacity 
              onPress={() => setCategoryModalVisible(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>X</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>Category Name</Text>
          <TextInput 
            value={categoryForm.name} 
            onChangeText={(t) => setCategoryForm(f => ({ ...f, name: t }))} 
            style={styles.input} 
            placeholder="e.g., Tamil Nadu, CBSE, General Knowledge"
          />
          
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput 
            value={categoryForm.description} 
            onChangeText={(t) => setCategoryForm(f => ({ ...f, description: t }))} 
            style={styles.input} 
            multiline 
            placeholder="Brief description of this category"
          />

          {/* Structure Type Toggle */}
          <View style={styles.toggleContainer}>
            <Text style={styles.label}>Structure Type</Text>
            <TouchableOpacity
              style={[styles.toggleButton, !categoryForm.hasSubcategories && styles.activeToggle]}
              onPress={() => setCategoryForm(f => ({ ...f, hasSubcategories: false }))}
            >
              <Text style={[styles.toggleText, !categoryForm.hasSubcategories && styles.activeToggleText]}>
                Simple (Category - Subjects)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, categoryForm.hasSubcategories && styles.activeToggle]}
              onPress={() => setCategoryForm(f => ({ ...f, hasSubcategories: true }))}
            >
              <Text style={[styles.toggleText, categoryForm.hasSubcategories && styles.activeToggleText]}>
                Nested (Category - Subcategory - Subjects)
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>⏱️ Default Timer (minutes)</Text>
          <View style={styles.timerDefaultRow}>
            <TextInput 
              value={categoryForm.timer} 
              onChangeText={(t) => setCategoryForm(f => ({ ...f, timer: t }))} 
              style={[styles.input, styles.timerDefaultInput]} 
              keyboardType="numeric"
              placeholder="30"
            />
            <Text style={styles.timerUnit}>min</Text>
          </View>

          {/* Subcategories and Subjects sections */}
          <SubcategoryManager categoryForm={categoryForm}
           setCategoryForm={setCategoryForm} />

          {/* Per-subject timer UI */}
          {getAllSubjectsFromForm().length > 0 && (
            <View style={styles.subjectTimerSection}>
              <Text style={styles.subjectTimerSectionTitle}>⏱️ Custom Timers per Subject</Text>
              <Text style={styles.helpText}>Leave blank to use the default timer above</Text>
              {getAllSubjectsFromForm().map(subject => (
                <View key={subject} style={styles.subjectTimerRow}>
                  <View style={styles.subjectTimerLabelContainer}>
                    <Text style={styles.subjectTimerDot}>•</Text>
                    <Text style={styles.subjectTimerLabel}>{subject}</Text>
                  </View>
                  <View style={styles.subjectTimerInputGroup}>
                    <TextInput
                      style={styles.subjectTimerInput}
                      value={getSubjectTimerValue(subject)}
                      onChangeText={(t) => updateSubjectTimer(subject, t)}
                      keyboardType="numeric"
                      placeholder={categoryForm.timer || "30"}
                      placeholderTextColor="#9CA3AF"
                    />
                    <Text style={styles.timerUnit}>min</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

            <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.btn, styles.cancelBtn]} 
              onPress={() => setCategoryModalVisible(false)}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={saveCategory}>
              <Text style={styles.btnText}>Save Category</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      {/* Question Modal */}
      <Modal visible={questionModalVisible} animationType="slide">
        <ScrollView style={{ padding: 12 }}>
          <Text style={styles.modalTitle}>
            {editingQuestion ? "Edit Question" : "New Question"}
          </Text>
          
          <Text style={styles.label}>Category</Text>
          <View style={styles.pickerContainer}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.pickerOption,
                  questionForm.category === cat.name && styles.selectedOption
                ]}
                onPress={() => {
                  setQuestionForm(f => ({ 
                    ...f, 
                    category: cat.name,
                    subcategory: cat.subcategories?.[0] || "",
                    subject: ""
                  }));
                }}
              >
                <Text style={[
                  styles.pickerText,
                  questionForm.category === cat.name && styles.selectedText
                ]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.label}>Subcategory</Text>
          <View style={styles.pickerContainer}>
            {getSelectedCategorySubcategories().map(sub => (
              <TouchableOpacity
                key={sub}
                style={[
                  styles.pickerOption,
                  questionForm.subcategory === sub && styles.selectedOption
                ]}
                onPress={() => setQuestionForm(f => ({ ...f, subcategory: sub, subject: "" }))}
              >
                <Text style={[
                  styles.pickerText,
                  questionForm.subcategory === sub && styles.selectedText
                ]}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Subject selection (if category has nested structure) */}
          {getSelectedSubcategorySubjects().length > 0 && (
            <>
              <Text style={styles.label}>Subject</Text>
              <View style={styles.pickerContainer}>
                {getSelectedSubcategorySubjects().map(subject => (
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.pickerOption,
                      questionForm.subject === subject && styles.selectedOption
                    ]}
                    onPress={() => setQuestionForm(f => ({ ...f, subject }))}
                  >
                    <Text style={[
                      styles.pickerText,
                      questionForm.subject === subject && styles.selectedText
                    ]}>{subject}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          
          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.pickerContainer}>
            {["easy", "medium", "hard"].map(diff => (
              <TouchableOpacity
                key={diff}
                style={[
                  styles.pickerOption,
                  questionForm.difficulty === diff && styles.selectedOption
                ]}
                onPress={() => setQuestionForm(f => ({ ...f, difficulty: diff }))}
              >
                <Text style={[
                  styles.pickerText,
                  questionForm.difficulty === diff && styles.selectedText
                ]}>{diff}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.label}>Question</Text>
          <TextInput 
            value={questionForm.questionText} 
            onChangeText={(t) => setQuestionForm(f => ({ ...f, questionText: t }))} 
            style={styles.input} 
            multiline 
          />
          
          <Text style={styles.label}>Options (one per line, format: id:Text)</Text>
          <TextInput 
            value={questionForm.optionsText} 
            onChangeText={(t) => setQuestionForm(f => ({ ...f, optionsText: t }))} 
            multiline 
            style={{ ...styles.input, height: 120 }} 
          />
          
          <Text style={styles.label}>Correct Option ID (e.g. a)</Text>
          <TextInput 
            value={questionForm.correct} 
            onChangeText={(t) => setQuestionForm(f => ({ ...f, correct: t }))} 
            style={styles.input} 
          />
          
          <Text style={styles.label}>Explanation</Text>
          <TextInput 
            value={questionForm.explanation} 
            onChangeText={(t) => setQuestionForm(f => ({ ...f, explanation: t }))} 
            style={{ ...styles.input, height: 80 }} 
            multiline 
          />

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.btn, styles.cancelBtn]} 
              onPress={() => setQuestionModalVisible(false)}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={saveQuestion}>
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const P = {
  primary:   "#6366F1",   // Indigo-500
  primaryDk: "#4F46E5",   // Indigo-600
  primaryLt: "#EEF2FF",   // Indigo-50
  primaryMd: "#C7D2FE",   // Indigo-200
  danger:    "#EF4444",
  dangerLt:  "#FEE2E2",
  success:   "#10B981",
  successLt: "#D1FAE5",
  amber:     "#F59E0B",
  amberLt:   "#FEF3C7",
  neutral:   "#6B7280",
  surface:   "#F9FAFB",
  bg:        "#F3F4F6",
  white:     "#FFFFFF",
  border:    "#E5E7EB",
  text:      "#111827",
  subtext:   "#6B7280",
};

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────
  headerContainer:     { backgroundColor: P.white },
  userInfo:            { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, paddingBottom:12 },
  welcomeText:         { color: P.subtext, fontSize: 14 },

  // ── Logout ──────────────────────────────────────
  logoutBtn:           { paddingHorizontal:12, paddingVertical:6, backgroundColor:P.danger, borderRadius:6 },
  logoutText:          { color:P.white, fontSize:12, fontWeight:"600" },

  // ── Bottom Nav ──────────────────────────────────
  bottomNavContainer:  { flexDirection:"row", backgroundColor:P.white, borderTopWidth:1, borderTopColor:P.border, paddingBottom:20, paddingTop:8 },
  bottomNavTab:        { flex:1, alignItems:"center", justifyContent:"center" },
  bottomNavText:       { fontSize:12, color:P.subtext, marginTop:4 },
  activeBottomNavText: { color:P.primary, fontWeight:"700" },

  // ── Profile ─────────────────────────────────────
  adminProfileContainer: { padding:8 },
  profileCard:         { backgroundColor:P.white, borderRadius:16, padding:32, alignItems:"center", marginBottom:16, borderWidth:1, borderColor:P.border },
  avatarCircle:        { width:80, height:80, borderRadius:40, backgroundColor:P.primary, justifyContent:"center", alignItems:"center", marginBottom:16 },
  avatarText:          { fontSize:32, color:P.white, fontWeight:"bold" },
  profileEmail:        { fontSize:18, fontWeight:"700", color:P.text, marginBottom:4 },
  profileRole:         { fontSize:14, color:P.subtext },
  logoutCardBtn:       { backgroundColor:P.white, borderRadius:16, padding:16, flexDirection:"row", alignItems:"center", borderWidth:1, borderColor:P.border },
  logoutIconContainer: { width:40, height:40, borderRadius:20, backgroundColor:P.dangerLt, justifyContent:"center", alignItems:"center", marginRight:16 },
  logoutTextContainer: { flex:1 },
  logoutCardTitle:     { fontSize:16, fontWeight:"700", color:P.text },
  logoutCardSub:       { fontSize:13, color:P.subtext },

  // ── Buttons ─────────────────────────────────────
  btn:             { padding:12, backgroundColor:P.primary, borderRadius:10, alignItems:"center" },
  btnText:         { color:P.white, fontWeight:"700", fontSize:14 },
  cancelBtn:       { backgroundColor:P.surface, borderWidth:1, borderColor:P.border },
  clearBtn:        { backgroundColor:P.neutral },
  filterBtnText:   { color:P.white, fontSize:12, fontWeight:"600" },

  // ── Section Title ────────────────────────────────
  sectionTitle:    { marginTop:20, fontWeight:"700", fontSize:17, color:P.text },

  // ── Cards ────────────────────────────────────────
  card:            { padding:14, borderWidth:1, borderColor:P.border, borderRadius:12, marginTop:8, backgroundColor:P.white, shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:3, elevation:2 },
  categoryHeader:  { flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  cardTitle:       { fontWeight:"700", fontSize:15, flex:1, color:P.text },
  cardDescription: { color:P.subtext, marginTop:4, fontSize:13 },
  cardInfo:        { color:P.subtext, marginTop:4, fontSize:12 },
  cardSubInfo:     { color:"#9CA3AF", marginTop:2, fontSize:11, marginLeft:8 },
  cardCorrectAnswer: { color:P.success, marginTop:4, fontSize:12, fontWeight:"600" },
  opacityInfo:     { color:P.primary, marginTop:4, fontSize:11, fontWeight:"600" },
  imageIndicator:  { backgroundColor:P.primaryLt, paddingHorizontal:6, paddingVertical:2, borderRadius:6 },
  imageIndicatorText: { fontSize:12, color:P.primary },
  cardActions:     { flexDirection:"row", marginTop:10 },
  small:           { padding:8, backgroundColor:P.primaryLt, borderRadius:8 },
  smallText:       { fontSize:12, fontWeight:"700", color:P.primary },
  categorySelectCard: { backgroundColor:P.white, padding:16, borderRadius:12, marginBottom:12, flexDirection:"row", justifyContent:"space-between", alignItems:"center", shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.08, shadowRadius:3, elevation:2 },
  categorySelectText: { fontSize:16, fontWeight:"600", color:P.text },
  categorySelectArrow: { fontSize:24, color:P.subtext },

  // ── Modal ────────────────────────────────────────
  modalHeader:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:20 },
  modalTitle:      { fontWeight:"700", fontSize:18, color:P.text },
  closeBtn:        { padding:8, backgroundColor:P.surface, borderRadius:20, width:36, height:36, alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:P.border },
  closeBtnText:    { fontSize:18, color:P.subtext },
  modalActions:    { flexDirection:"row", justifyContent:"space-between", marginTop:20, marginBottom:20, gap:12 },

  // ── Form ─────────────────────────────────────────
  input:           { borderWidth:1, borderColor:P.border, borderRadius:10, padding:10, marginTop:6, backgroundColor:P.white, fontSize:14, color:P.text },
  label:           { marginTop:14, fontWeight:"700", color:P.text, fontSize:13 },
  helpText:        { fontSize:12, color:P.subtext, marginTop:4, marginBottom:6, lineHeight:18 },

  // ── Picker ───────────────────────────────────────
  pickerContainer: { flexDirection:"row", flexWrap:"wrap", marginTop:8 },
  pickerOption:    { paddingHorizontal:14, paddingVertical:8, backgroundColor:P.surface, borderRadius:8, marginRight:8, marginBottom:8, borderWidth:1, borderColor:P.border },
  selectedOption:  { backgroundColor:P.primary, borderColor:P.primary },
  pickerText:      { fontSize:13, color:P.subtext, fontWeight:"500" },
  selectedText:    { color:P.white, fontWeight:"700" },

  // ── Toggle ───────────────────────────────────────
  toggleContainer: { marginTop:12 },
  toggleButton:    { padding:12, borderWidth:1.5, borderColor:P.border, borderRadius:10, marginTop:6, alignItems:"center" },
  activeToggle:    { backgroundColor:P.primaryLt, borderColor:P.primary },
  toggleText:      { fontSize:14, color:P.subtext },
  activeToggleText:{ color:P.primary, fontWeight:"700" },

  // ── Subcategory Manager ──────────────────────────
  subcategoryManager: { marginTop:16, marginBottom:16 },
  managerSection:  { backgroundColor:P.surface, padding:16, borderRadius:12, marginBottom:16, borderLeftWidth:4, borderLeftColor:P.primary },
  managerTitle:    { fontSize:16, fontWeight:"700", color:P.text, marginBottom:12 },
  inputRow:        { flexDirection:"row", marginBottom:12 },
  managerInput:    { flex:1, borderWidth:1, borderColor:P.border, borderRadius:10, padding:10, backgroundColor:P.white, marginRight:8, fontSize:14 },
  addButton:       { backgroundColor:P.primary, paddingHorizontal:16, paddingVertical:10, borderRadius:10, justifyContent:"center" },
  addButtonText:   { color:P.white, fontWeight:"700", fontSize:14 },
  chipContainer:   { flexDirection:"row", flexWrap:"wrap", marginTop:8 },
  chip:            { flexDirection:"row", alignItems:"center", backgroundColor:P.primaryLt, paddingHorizontal:12, paddingVertical:7, borderRadius:20, marginRight:8, marginBottom:8 },
  subjectChip:     { backgroundColor:P.amberLt },
  chipText:        { fontSize:13, color:P.primaryDk, marginRight:4, fontWeight:"600" },
  chipRemove:      { fontSize:18, color:P.danger, fontWeight:"bold", marginLeft:4 },
  subcategorySelector: { marginBottom:12 },
  selectorLabel:   { fontSize:12, color:P.subtext, marginBottom:8, fontWeight:"500" },
  selectorRow:     { flexDirection:"row" },
  selectorChip:    { paddingHorizontal:16, paddingVertical:8, backgroundColor:P.white, borderRadius:20, marginRight:8, borderWidth:2, borderColor:P.border },
  selectorChipActive: { backgroundColor:P.primary, borderColor:P.primary },
  selectorChipText: { fontSize:13, color:P.subtext, fontWeight:"500" },
  selectorChipTextActive: { color:P.white, fontWeight:"700" },

  // ── Config / Import ──────────────────────────────
  configSection:   { backgroundColor:P.surface, padding:16, borderRadius:12, marginBottom:20, borderLeftWidth:4, borderLeftColor:P.primary },
  configTitle:     { fontSize:16, fontWeight:"700", color:P.text, marginBottom:16, textAlign:"center" },
  importSummary:   { backgroundColor:P.successLt, padding:12, borderRadius:10, marginTop:16, borderWidth:1, borderColor:P.success },
  deleteSummary:   { backgroundColor:P.dangerLt, padding:12, borderRadius:10, marginTop:16, borderWidth:1, borderColor:P.danger },
  summaryText:     { fontSize:14, color:"#065F46", fontWeight:"600", marginBottom:4 },
  summaryPath:     { fontSize:16, color:P.primary, fontWeight:"700" },
  importInstructions: { backgroundColor:P.primaryLt, padding:12, borderRadius:10, marginBottom:20, color:P.primaryDk, fontSize:14, textAlign:"center", fontWeight:"700" },
  importSection:   { marginBottom:24 },
  importInput:     { borderWidth:1, borderColor:P.border, borderRadius:10, padding:12, marginTop:8, textAlignVertical:"top", minHeight:120, fontSize:12, backgroundColor:P.white },
  csvFileSection:  { backgroundColor:P.primaryLt, padding:16, borderRadius:10, marginTop:8, borderWidth:1, borderColor:P.primaryMd },
  selectedFileInfo: { backgroundColor:P.successLt, padding:12, borderRadius:10, marginBottom:12 },
  selectedFileText: { fontSize:14, fontWeight:"700", color:"#065F46", marginBottom:4 },
  selectedFileSize: { fontSize:12, color:"#047857" },
  csvPreview:      { backgroundColor:P.white, padding:12, borderRadius:10, marginBottom:12, borderWidth:1, borderColor:P.border },
  previewTitle:    { fontSize:14, fontWeight:"700", color:P.text, marginBottom:8 },
  previewQuestion: { marginBottom:8, paddingBottom:8, borderBottomWidth:1, borderBottomColor:P.border },
  previewQuestionText: { fontSize:13, color:P.text, fontWeight:"500", marginBottom:4 },
  previewOptions:  { fontSize:11, color:P.subtext },

  // ── Image / Slider stubs (unused but kept to avoid ref errors) ──
  imageSection:    { backgroundColor:P.surface, padding:16, borderRadius:12, marginTop:16, borderLeftWidth:4, borderLeftColor:P.primary },
  imageControls:   { flexDirection:"row", marginTop:8 },
  imageBtn:        { backgroundColor:P.primary, paddingHorizontal:16, paddingVertical:10, borderRadius:8, marginRight:8 },
  imageBtnText:    { color:P.white, fontSize:14, fontWeight:"600" },
  removeBtn:       { backgroundColor:P.danger },
  removeBtnText:   { color:P.white, fontSize:14, fontWeight:"600" },
  imagePreview:    { marginTop:12, borderRadius:8, overflow:"hidden", height:120, backgroundColor:P.border, position:"relative" },
  previewImage:    { width:"100%", height:"100%" },
  opacityOverlay:  { position:"absolute", top:0, left:0, right:0, bottom:0, justifyContent:"center", alignItems:"center" },
  opacityControl:  { marginTop:16 },
  slider:          { width:"100%", height:40 },
  sliderThumb:     { backgroundColor:P.primary, width:20, height:20 },
  sliderTrack:     { height:4, borderRadius:2 },
  opacityLabels:   { flexDirection:"row", justifyContent:"space-between", marginTop:4 },
  opacityLabel:    { fontSize:10, color:P.subtext },
  imagePreviewLabel: { fontSize:14, fontWeight:"600", color:P.text, marginBottom:8, marginTop:12 },
  imagePreviewContainer: { height:200, borderRadius:12, overflow:"hidden", borderWidth:2, borderColor:P.border },
  previewImageBackground: { width:"100%", height:"100%", justifyContent:"center", alignItems:"center" },
  previewImageStyle: { borderRadius:10 },
  previewQuestionCard: { backgroundColor:"rgba(255,255,255,0.95)", padding:16, borderRadius:12, width:"80%", shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.2, shadowRadius:4 },
  previewQuestionTextNew: { fontSize:14, fontWeight:"600", color:P.text, marginBottom:12, textAlign:"center" },
  previewOption:   { flexDirection:"row", alignItems:"center", backgroundColor:P.surface, padding:10, borderRadius:8 },
  previewOptionLabel: { width:24, height:24, borderRadius:12, backgroundColor:P.primary, color:P.white, textAlign:"center", lineHeight:24, marginRight:8, fontSize:12, fontWeight:"bold" },
  previewOptionTextNew: { fontSize:12, color:P.subtext, flex:1 },

  // ── Timer UI ─────────────────────────────────────────────────────────
  timerDefaultRow:            { flexDirection:"row", alignItems:"center", marginTop:6 },
  timerDefaultInput:          { flex:1, marginTop:0, marginRight:10 },
  timerUnit:                  { fontSize:14, fontWeight:"700", color:P.subtext },
  subjectTimerSection:        { marginTop:16, backgroundColor:P.surface, borderRadius:14, padding:14, borderLeftWidth:4, borderLeftColor:P.primary },
  subjectTimerSectionTitle:   { fontSize:15, fontWeight:"700", color:P.text, marginBottom:4 },
  subjectTimerRow:            { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingVertical:10, borderBottomWidth:1, borderBottomColor:P.border },
  subjectTimerLabelContainer: { flexDirection:"row", alignItems:"center", flex:1, marginRight:12 },
  subjectTimerDot:            { color:P.primary, fontSize:18, marginRight:8 },
  subjectTimerLabel:          { fontSize:14, color:P.text, fontWeight:"500", flex:1 },
  subjectTimerInputGroup:     { flexDirection:"row", alignItems:"center" },
  subjectTimerInput:          { borderWidth:1.5, borderColor:P.primaryMd, borderRadius:8, paddingHorizontal:10, paddingVertical:6, width:60, fontSize:15, fontWeight:"700", color:P.primaryDk, textAlign:"center", backgroundColor:P.primaryLt, marginRight:6 },
});
