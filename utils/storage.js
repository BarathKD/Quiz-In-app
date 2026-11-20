import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from "expo-crypto";

// Number of questions in one level (shared by LevelsScreen and QuizScreen)
export const QUESTIONS_PER_LEVEL = 50;

const QUESTIONS_KEY = "quiz_questions";
const USERS_KEY = "quiz_users";
const CATEGORIES_KEY = "quiz_categories";
const PROGRESS_KEY = "quiz_progress";
const IMAGES_KEY = "quiz_images";
const SESSION_KEY = "quiz_session";

// Image directory for storing category backgrounds
// @ts-ignore
const IMAGE_DIR = `${FileSystem.documentDirectory}quiz_images/`;

// Initialize image directory
const initImageDirectory = async () => {
  try {
    console.log("Checking image directory:", IMAGE_DIR);
    
    // @ts-ignore
    const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
    
    console.log("Directory info:", dirInfo);
    
    if (!dirInfo.exists) {
      console.log("Creating image directory...");
      await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
      console.log("✅ Image directory created successfully");
    } else {
      console.log("✅ Image directory already exists");
    }
    return true;
  } catch (error) {
    console.error("❌ Error creating image directory:", error);
    throw new Error("Failed to initialize image directory: " + error.message);
  }
};

// Save category/subject background image
export const saveCategoryImage = async (categoryId, base64Data, subcategory = null, subject = null) => {
  try {
    console.log("=== SAVING CATEGORY IMAGE ===");
    console.log("Category ID:", categoryId);
    console.log("Subcategory:", subcategory);
    console.log("Subject:", subject);
    
    await initImageDirectory();
    
    // Create unique key for category, subcategory, or subject
    let imageKey = categoryId;
    if (subject && subcategory) {
      imageKey = `${categoryId}_${subcategory}_${subject}`;
    } else if (subcategory) {
      imageKey = `${categoryId}_${subcategory}`;
    }
    
    // Clean key for filename (remove special characters)
    const cleanKey = imageKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `bg_${cleanKey}.jpg`;
    const filePath = `${IMAGE_DIR}${filename}`;
    
    console.log("Saving image:", { imageKey, filename, filePath });
    
    // Save base64 image to file system
    await FileSystem.writeAsStringAsync(filePath, base64Data, {
      encoding: 'base64',
    });
    
    console.log("Image file written");
    
    // Verify file was written
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      throw new Error("File was not created successfully");
    }
    
    console.log("File created successfully:", fileInfo);
    
    // Store image metadata
    const imageMetadata = await getImageMetadata();
    imageMetadata[imageKey] = {
      filename,
      filePath,
      categoryId,
      subcategory,
      subject,
      createdAt: new Date().toISOString(),
      size: fileInfo.size
    };
    
    await AsyncStorage.setItem(IMAGES_KEY, JSON.stringify(imageMetadata));
    console.log(`✅ Image saved: ${imageKey}`);
    
    return filePath;
  } catch (error) {
    console.error("❌ Error saving image:", error);
    throw error;
  }
};
   
export const getCategoryImage = async (categoryId, subcategory = null, subject = null) => {
  try {
    // Create unique key
    let imageKey = categoryId;
    if (subject && subcategory) {
      imageKey = `${categoryId}_${subcategory}_${subject}`;
    } else if (subcategory) {
      imageKey = `${categoryId}_${subcategory}`;
    }
    
    console.log("Looking for image with key:", imageKey);
    
    const imageMetadata = await getImageMetadata();
    const categoryImage = imageMetadata[imageKey];
    
    if (!categoryImage) {
      console.log("No image metadata found for key:", imageKey);
      return null;
    }
    
    console.log("Found image metadata:", categoryImage);
    
    // Check if file still exists
    const fileInfo = await FileSystem.getInfoAsync(categoryImage.filePath);
    if (fileInfo.exists) {
      console.log("✅ Image file exists:", categoryImage.filePath);
      return categoryImage.filePath;
    } else {
      console.log("❌ Image file missing:", categoryImage.filePath);
      // Clean up metadata for missing file
      delete imageMetadata[imageKey];
      await AsyncStorage.setItem(IMAGES_KEY, JSON.stringify(imageMetadata));
      return null;
    }
  } catch (error) {
    console.error("Error getting image:", error);
    return null;
  }
};

export const deleteCategoryImage = async (categoryId, subcategory = null, subject = null) => {
  try {
    // Create unique key
    let imageKey = categoryId;
    if (subject && subcategory) {
      imageKey = `${categoryId}_${subcategory}_${subject}`;
    } else if (subcategory) {
      imageKey = `${categoryId}_${subcategory}`;
    }
    
    const imageMetadata = await getImageMetadata();
    const categoryImage = imageMetadata[imageKey];
    
    if (categoryImage) {
      // Delete file
      try {
        await FileSystem.deleteAsync(categoryImage.filePath);
        console.log("Deleted image file:", categoryImage.filePath);
      } catch (fileError) {
        console.warn("File already deleted or doesn't exist:", fileError);
      }
      
      // Remove from metadata
      delete imageMetadata[imageKey];
      await AsyncStorage.setItem(IMAGES_KEY, JSON.stringify(imageMetadata));
      
      console.log(`Image deleted: ${imageKey}`);
    }
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};

// Get image metadata
const getImageMetadata = async () => {
  try {
    const data = await AsyncStorage.getItem(IMAGES_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("Error getting image metadata:", error);
    return {};
  }
};

// Updated sample categories with background opacity
const sampleCategories = [
  {
    id: "1",
    name: "Tamil Nadu",
    description: "Tamil Nadu Board Education",
    backgroundOpacity: 0.3,
    subcategories: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"],
    subjects: {
      "Class 6": ["Tamil", "English", "Mathematics", "Science", "Social Science"],
      "Class 7": ["Tamil", "English", "Mathematics", "Science", "Social Science"],
      "Class 8": ["Tamil", "English", "Mathematics", "Science", "Social Science"],
      "Class 9": ["Tamil", "English", "Mathematics", "Physics", "Chemistry", "Biology", "History", "Geography", "Civics"],
      "Class 10": ["Tamil", "English", "Mathematics", "Physics", "Chemistry", "Biology", "History", "Geography", "Civics"],
      "Class 11": ["Tamil", "English", "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "Economics", "History"],
      "Class 12": ["Tamil", "English", "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "Economics", "History"]
    }
  },
  {
    id: "2",
    name: "Indian General Knowledge",
    description: "General knowledge about India",
    backgroundOpacity: 0.25,
    subcategories: ["History", "Geography", "Politics", "Culture", "Sports", "Economy"]
  },
  {
    id: "3",
    name: "World General Knowledge", 
    description: "World general knowledge",
    backgroundOpacity: 0.2,
    subcategories: ["Geography", "History", "Science", "Technology", "Sports", "Culture"]
  },
  {
    id: "4",
    name: "Reasoning & Aptitude",
    description: "Logical reasoning and aptitude",
    backgroundOpacity: 0.35,
    subcategories: ["Logical Reasoning", "Numerical Ability", "Verbal Ability", "Analytical Reasoning"]
  },
  {
    id: "5",
    name: "CBSE",
    description: "CBSE Board subjects",
    backgroundOpacity: 0.3,
    subcategories: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"],
    subjects: {
      "Class 6": ["Mathematics", "Science", "English", "Hindi", "Social Studies"],
      "Class 7": ["Mathematics", "Science", "English", "Hindi", "Social Studies"],
      "Class 8": ["Mathematics", "Science", "English", "Hindi", "Social Studies"],
      "Class 9": ["Mathematics", "Science", "English", "Hindi", "Social Studies"],
      "Class 10": ["Mathematics", "Science", "English", "Hindi", "Social Studies"],
      "Class 11": ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Hindi"],
      "Class 12": ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Hindi"]
    }
  }
];

const sampleQuestions = [
  {
    id: "1",
    category: "Tamil Nadu",
    subcategory: "Class 10",
    subject: "History", 
    difficulty: "easy",
    questionText: "Who was the first Chief Minister of Tamil Nadu?",
    options: [
      { id: "a", text: "C. N. Annadurai" },
      { id: "b", text: "M. Karunanidhi" },
      { id: "c", text: "K. Kamaraj" },
      { id: "d", text: "M. G. Ramachandran" }
    ],
    correctOptionId: "a",
    explanation: "C. N. Annadurai was the first Chief Minister of Tamil Nadu after the state was renamed from Madras."
  },
  {
    id: "2",
    category: "Tamil Nadu",
    subcategory: "Class 9",
    subject: "Mathematics",
    difficulty: "easy", 
    questionText: "What is the value of π (pi) approximately?",
    options: [
      { id: "a", text: "3.14" },
      { id: "b", text: "2.14" },
      { id: "c", text: "4.14" },
      { id: "d", text: "1.14" }
    ],
    correctOptionId: "a",
    explanation: "The value of π (pi) is approximately 3.14159, commonly rounded to 3.14."
  },
  {
    id: "3",
    category: "Tamil Nadu",
    subcategory: "Class 8",
    subject: "Science",
    difficulty: "easy",
    questionText: "What is the chemical symbol for water?",
    options: [
      { id: "a", text: "H2O" },
      { id: "b", text: "CO2" },
      { id: "c", text: "O2" },
      { id: "d", text: "H2" }
    ],
    correctOptionId: "a", 
    explanation: "Water is composed of two hydrogen atoms and one oxygen atom, hence H2O."
  },
  {
    id: "4",
    category: "Tamil Nadu",
    subcategory: "Class 11",
    subject: "Physics",
    difficulty: "medium",
    questionText: "What is the SI unit of force?",
    options: [
      { id: "a", text: "Newton" },
      { id: "b", text: "Joule" },
      { id: "c", text: "Watt" },
      { id: "d", text: "Pascal" }
    ],
    correctOptionId: "a",
    explanation: "Newton (N) is the SI unit of force, named after Sir Isaac Newton."
  },
  {
    id: "5",
    category: "Tamil Nadu",
    subcategory: "Class 12",
    subject: "Chemistry",
    difficulty: "medium",
    questionText: "What is the atomic number of Carbon?",
    options: [
      { id: "a", text: "6" },
      { id: "b", text: "8" },
      { id: "c", text: "12" },
      { id: "d", text: "14" }
    ],
    correctOptionId: "a",
    explanation: "Carbon has 6 protons in its nucleus, making its atomic number 6."
  },
  {
    id: "6",
    category: "Indian General Knowledge",
    subcategory: "History",
    difficulty: "easy",
    questionText: "Who was the first Prime Minister of India?",
    options: [
      { id: "a", text: "Jawaharlal Nehru" },
      { id: "b", text: "Mahatma Gandhi" },
      { id: "c", text: "Sardar Patel" },
      { id: "d", text: "Dr. Rajendra Prasad" }
    ],
    correctOptionId: "a",
    explanation: "Jawaharlal Nehru was the first Prime Minister of India from 1947 to 1964."
  }
];

// ───────────── Auth helpers (local-only until the backend in Phase 2) ─────────────
// Passwords are never stored in plain text. A salted SHA-256 hash is a stop-gap;
// the backend will replace this with proper server-side hashing + JWT.
const normalizeEmail = (email) => (email || "").trim().toLowerCase();

const makeSalt = () => {
  const bytes = Crypto.getRandomBytes(16);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const hashPassword = async (password, salt) => {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );
};

// Remove secrets before a user object is saved in the session or passed in navigation
const sanitizeUser = (user) => {
  const safe = { ...user };
  delete safe.password;
  delete safe.passwordHash;
  delete safe.salt;
  return safe;
};

// Development-only admin so the Admin panel can be tested in Expo Go.
// This account is NEVER created in release builds.
const createDevAdmin = async () => {
  const salt = makeSalt();
  return {
    id: "admin",
    email: "admin@quiz.com",
    salt,
    passwordHash: await hashPassword("admin123", salt),
    isAdmin: true
  };
};

// Category Management Functions
export const getAllCategories = async () => {
  try {
    const data = await AsyncStorage.getItem(CATEGORIES_KEY);
    const categories = data ? JSON.parse(data) : [];
    
    // Enhance categories with background image information
    const enhancedCategories = await Promise.all(
      categories.map(async (category) => {
        const backgroundImage = await getCategoryImage(category.id);
        return {
          ...category,
          backgroundImage: backgroundImage || null
        };
      })
    );
    
    return enhancedCategories;
  } catch (error) {
    console.error("Error getting categories:", error);
    return [];
  }
};

export const addCategory = async (category) => {
  try {
    const data = await AsyncStorage.getItem(CATEGORIES_KEY);
    const categories = data ? JSON.parse(data) : [];
    
    const newCategory = {
      id: Date.now().toString(),
      backgroundOpacity: 0.3,
      ...category
    };
    
    categories.push(newCategory);
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    return newCategory.id;
  } catch (error) {
    console.error("Error adding category:", error);
    throw error;
  }
};

export const updateCategory = async (id, updates) => {
  try {
    const data = await AsyncStorage.getItem(CATEGORIES_KEY);
    const categories = data ? JSON.parse(data) : [];
    
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...updates };
      await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    }
  } catch (error) {
    console.error("Error updating category:", error);
    throw error;
  }
};

export const deleteCategory = async (id) => {
  try {
    const data = await AsyncStorage.getItem(CATEGORIES_KEY);
    const categories = data ? JSON.parse(data) : [];
    
    const filtered = categories.filter(c => c.id !== id);
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(filtered));
    
    await deleteCategoryImage(id);
    
    const questions = await getAllQuestions();
    const categoryToDelete = categories.find(c => c.id === id);
    if (categoryToDelete) {
      const filteredQuestions = questions.filter(q => q.category !== categoryToDelete.name);
      await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(filteredQuestions));
    }
  } catch (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
};

export const getCategoryByName = async (categoryName) => {
  try {
    const categories = await getAllCategories();
    return categories.find(c => c.name === categoryName);
  } catch (error) {
    console.error("Error getting category by name:", error);
    return null;
  }
};

export const getAllQuestions = async () => {
  try {
    const data = await AsyncStorage.getItem(QUESTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting questions:", error);
    return [];
  }
};

export const getQuestionsPaginated = async (page = 0, limit = 50) => {
  try {
    const allQuestions = await getAllQuestions();
    const start = page * limit;
    const end = start + limit;
    return {
      questions: allQuestions.slice(start, end),
      totalCount: allQuestions.length,
      hasMore: end < allQuestions.length
    };
  } catch (error) {
    console.error("Error getting paginated questions:", error);
    return { questions: [], totalCount: 0, hasMore: false };
  }
};

export const getQuestionsByFilter = async (category = null, subcategory = null, subject = null, difficulty = null) => {
  try {
    const allQuestions = await getAllQuestions();
    
    let filtered = allQuestions;
    
    if (category) {
      filtered = filtered.filter(q => q.category === category);
    }
    
    if (subcategory) {
      filtered = filtered.filter(q => q.subcategory === subcategory);
    }
    
    if (subject !== null && subject !== undefined && subject !== "") {
      // If subject is provided, only match questions with that exact subject
      filtered = filtered.filter(q => q.subject === subject);
    } else if (subject === null || subject === "" || subject === undefined) {
      // If no subject is specified, only match questions that have no subject
      // BUT if subject param is explicitly undefined (not passed), show all
      // We check: if subject was explicitly passed as null/"", filter to no-subject questions
      // If it was not passed at all (undefined from destructuring), skip filter
      if (subject === null || subject === "") {
        filtered = filtered.filter(q => !q.subject || q.subject === "" || q.subject === null || q.subject === undefined);
      }
    }
    
    if (difficulty) {
      filtered = filtered.filter(q => q.difficulty === difficulty);
    }
    
    return filtered;
  } catch (error) {
    console.error("Error getting filtered questions:", error);
    return [];
  }
};

export const addQuestion = async (question) => {
  try {
    const questions = await getAllQuestions();
    const newQuestion = {
      id: Date.now().toString(),
      ...question
    };
    questions.push(newQuestion);
    await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
    return newQuestion.id;
  } catch (error) {
    console.error("Error adding question:", error);
    throw error;
  }
};

export const updateQuestion = async (id, updates) => {
  try {
    const questions = await getAllQuestions();
    const index = questions.findIndex(q => q.id === id);
    if (index !== -1) {
      questions[index] = { ...questions[index], ...updates };
      await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
    }
  } catch (error) {
    console.error("Error updating question:", error);
    throw error;
  }
};

export const deleteQuestion = async (id) => {
  try {
    const questions = await getAllQuestions();
    const filtered = questions.filter(q => q.id !== id);
    await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error deleting question:", error);
    throw error;
  }
};

export const bulkDeleteQuestions = async (category = null, subcategory = null, subject = null, difficulty = null) => {
  try {
    const allQuestions = await getAllQuestions();
    
    const questionsToKeep = allQuestions.filter(q => {
      let shouldDelete = true;
      
      if (category && q.category !== category) shouldDelete = false;
      if (subcategory && q.subcategory !== subcategory) shouldDelete = false;
      if (subject && q.subject !== subject) shouldDelete = false;
      if (difficulty && q.difficulty !== difficulty) shouldDelete = false;
      
      return !shouldDelete;
    });
    
    const deletedCount = allQuestions.length - questionsToKeep.length;
    
    await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(questionsToKeep));
    return deletedCount;
  } catch (error) {
    console.error("Error bulk deleting questions:", error);
    throw error;
  }
};

export const bulkImportFromCsv = async (csvString, targetCategory, targetSubcategory, targetSubject = null, targetDifficulty = "easy") => {
  try {
    // Full CSV parser: handles quoted commas, "" escaped quotes, multi-line cells, \r\n
    const rows = parseCSV(csvString).filter(row => row.some(cell => cell !== ""));
    if (rows.length === 0) {
      throw new Error("CSV is empty");
    }

    const questions = await getAllQuestions();
    let addedCount = 0;
    const skippedLines = [];

    const firstLineCols = rows[0];
    const firstCol = firstLineCols[0]?.toLowerCase() || "";
    const secondCol = firstLineCols[1]?.toLowerCase() || "";
    
    const isHeader = 
      firstCol === 'id' || 
      firstCol === 's.no' || 
      firstCol === 'sno' ||
      firstCol.includes('serial') ||
      secondCol.includes('question') ||
      firstLineCols.some(col => col.toLowerCase() === 'answer' || col.toLowerCase() === 'explanation');
      
    const startIndex = isHeader ? 1 : 0;

    for (let i = startIndex; i < rows.length; i++) {
      const columns = rows[i];
      
      // We need at least ID, Question, OptionA, OptionB, and CorrectAnswer
      if (columns.length < 6) {
        skippedLines.push(`Row ${i + 1}: Missing columns`);
        console.warn(`Line ${i + 1} has insufficient columns, skipping`);
        continue;
      }

      const id = columns[0];
      const questionText = columns[1];
      const optionA = columns[2];
      const optionB = columns[3];
      const optionC = columns[4] || "";
      const optionD = columns[5] || "";
      const correctAnswer = columns[6];
      const explanation = columns[7] || "";

      if (!id || !questionText || !optionA || !optionB || !correctAnswer) {
        skippedLines.push(`Row ${i + 1}: Missing required fields (Subject, Question, Option A, Option B, or Correct Answer)`);
        console.warn(`Line ${i + 1} has missing required fields, skipping`);
        continue;
      }

      const correctText = correctAnswer.trim();
      const correctLetter = correctText.toUpperCase();
      
      let correctOptionId = 'a';
      if (['A', 'B', 'C', 'D'].includes(correctLetter)) {
        correctOptionId = correctLetter.toLowerCase();
      } else if (['1', '2', '3', '4'].includes(correctLetter)) {
        if (correctLetter === '1') correctOptionId = 'a';
        if (correctLetter === '2') correctOptionId = 'b';
        if (correctLetter === '3') correctOptionId = 'c';
        if (correctLetter === '4') correctOptionId = 'd';
      } else {
        // Try to match by text (exact or partial)
        const optALower = optionA.trim().toLowerCase();
        const optBLower = optionB.trim().toLowerCase();
        const optCLower = optionC.trim().toLowerCase();
        const optDLower = optionD.trim().toLowerCase();
        const correctLower = correctText.toLowerCase();

        if (correctLower === optALower || optALower.includes(correctLower)) correctOptionId = 'a';
        else if (correctLower === optBLower || optBLower.includes(correctLower)) correctOptionId = 'b';
        else if (correctLower === optCLower || optCLower.includes(correctLower)) correctOptionId = 'c';
        else if (correctLower === optDLower || optDLower.includes(correctLower)) correctOptionId = 'd';
      }

      const newQuestion = {
        id: `csv_${Date.now()}_${addedCount}_${Math.random().toString(36).substr(2, 9)}`,
        category: targetCategory,
        subcategory: targetSubcategory,
        difficulty: targetDifficulty,
        questionText: questionText.trim(),
        options: [
          { id: "a", text: optionA.trim() },
          { id: "b", text: optionB.trim() },
          { id: "c", text: optionC.trim() },
          { id: "d", text: optionD.trim() }
        ],
        correctOptionId,
        explanation: explanation ? explanation.trim() : ""
      };

      if (targetSubject && targetSubject.trim() !== "" && targetSubject.trim().toLowerCase() !== "none") {
        newQuestion.subject = targetSubject.trim();
      }

      questions.push(newQuestion);
      addedCount++;

      if (addedCount % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
    console.log(`Successfully imported ${addedCount} CSV questions`);
    return { addedCount, skippedLines };
  } catch (error) {
    console.error("Error importing CSV:", error);
    throw error;
  }
};

export const bulkImportFromJson = async (jsonString, targetCategory, targetSubcategory, targetSubject = null, targetDifficulty = "easy") => {
  try {
    const newQuestions = JSON.parse(jsonString);
    if (!Array.isArray(newQuestions)) {
      throw new Error("JSON must be an array of questions");
    }

    const questions = await getAllQuestions();
    let addedCount = 0;

    for (const q of newQuestions) {
      if (q.questionText && q.options && q.correctOptionId) {
        const newQuestion = {
          id: `json_${Date.now()}_${addedCount}_${Math.random().toString(36).substr(2, 9)}`,
          category: targetCategory,
          subcategory: targetSubcategory,
          difficulty: targetDifficulty,
          questionText: q.questionText,
          options: q.options,
          correctOptionId: q.correctOptionId,
          explanation: q.explanation || ""
        };

        if (targetSubject && targetSubject.trim() !== "" && targetSubject.trim().toLowerCase() !== "none") {
          newQuestion.subject = targetSubject.trim();
        }

        questions.push(newQuestion);
        addedCount++;
      }
    }

    await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
    console.log(`Successfully imported ${addedCount} JSON questions`);
    return addedCount;
  } catch (error) {
    console.error("Error bulk importing JSON:", error);
    throw error;
  }
};

// Parse a whole CSV text into rows of trimmed cells
const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const input = (text || "").replace(/^\uFEFF/, ""); // strip BOM

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  // last cell / row (file without trailing newline)
  row.push(cell.trim());
  rows.push(row);
  return rows;
};

export const getAllUsers = async () => {
  try {
    const data = await AsyncStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting users:", error);
    return [];
  }
};

export const getUserByEmail = async (email) => {
  try {
    const users = await getAllUsers();
    const wanted = normalizeEmail(email);
    return users.find(u => normalizeEmail(u.email) === wanted);
  } catch (error) {
    console.error("Error getting user by email:", error);
    return null;
  }
};

// Create a normal (non-admin) account. Returns { ok: true } or { ok: false, reason }.
export const registerUser = async (email, password) => {
  const normalized = normalizeEmail(email);
  const existing = await getUserByEmail(normalized);
  if (existing) return { ok: false, reason: "exists" };

  const salt = makeSalt();
  const passwordHash = await hashPassword(password, salt);
  await addUser({ email: normalized, salt, passwordHash, isAdmin: false });
  return { ok: true };
};

// Check email + password. Returns a sanitized user (no secrets) or null.
export const authenticateUser = async (email, password) => {
  const user = await getUserByEmail(email);
  if (!user) return null;

  if (user.passwordHash) {
    const hash = await hashPassword(password, user.salt);
    return hash === user.passwordHash ? sanitizeUser(user) : null;
  }

  // Old plain-text account from a previous app version: verify, then upgrade to a hash
  if (user.password && user.password === password) {
    const salt = makeSalt();
    const passwordHash = await hashPassword(password, salt);
    const users = await getAllUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      const upgraded = { ...users[index], salt, passwordHash };
      delete upgraded.password;
      users[index] = upgraded;
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    return sanitizeUser(user);
  }

  return null;
};

export const addUser = async (user) => {
  try {
    const users = await getAllUsers();
    const newUser = {
      id: Date.now().toString(),
      ...user
    };
    users.push(newUser);
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    return newUser.id;
  } catch (error) {
    console.error("Error adding user:", error);
    throw error;
  }
};

export const getUserProgress = async (userId) => {
  try {
    const data = await AsyncStorage.getItem(`${PROGRESS_KEY}_${userId}`);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("Error getting user progress:", error);
    return {};
  }
};

export const updateUserProgress = async (userId, category, subcategory, difficulty, completed, subject = null) => {
  try {
    const progress = await getUserProgress(userId);
    let key;
    
    if (subject) {
      key = `${category}_${subcategory}_${subject}`;
    } else {
      key = `${category}_${subcategory}`;
    }
    
    if (!progress[key]) {
      progress[key] = { easy: false, medium: false, hard: false };
    }
    
    progress[key][difficulty] = completed;
    
    await AsyncStorage.setItem(`${PROGRESS_KEY}_${userId}`, JSON.stringify(progress));
    return progress;
  } catch (error) {
    console.error("Error updating user progress:", error);
    throw error;
  }
};

// Record that one level was passed. The whole difficulty is marked complete
// only when every level of that difficulty has been passed.
// Progress shape per key: { easy, medium, hard, levels: { easy: {1: true}, ... } }
export const markLevelPassed = async (userId, category, subcategory, subject, difficulty, levelNumber, totalLevels) => {
  try {
    const progress = await getUserProgress(userId);
    const key = subject
      ? `${category}_${subcategory}_${subject}`
      : `${category}_${subcategory}`;

    if (!progress[key]) {
      progress[key] = { easy: false, medium: false, hard: false };
    }
    if (!progress[key].levels) {
      progress[key].levels = { easy: {}, medium: {}, hard: {} };
    }
    if (!progress[key].levels[difficulty]) {
      progress[key].levels[difficulty] = {};
    }

    progress[key].levels[difficulty][levelNumber] = true;

    let allPassed = true;
    for (let i = 1; i <= totalLevels; i++) {
      if (!progress[key].levels[difficulty][i]) {
        allPassed = false;
        break;
      }
    }

    // Never take back a difficulty that was already completed
    progress[key][difficulty] = progress[key][difficulty] || allPassed;

    await AsyncStorage.setItem(`${PROGRESS_KEY}_${userId}`, JSON.stringify(progress));
    return { progress: progress[key], difficultyCompleted: progress[key][difficulty] };
  } catch (error) {
    console.error("Error marking level passed:", error);
    throw error;
  }
};

// Points: each passed level = 50 questions, weighted by difficulty (easy 1x, medium 2x, hard 3x).
// Local-only for now: ranks the accounts on this device. Phase 2 moves this to the backend.
const DIFFICULTY_WEIGHT = { easy: 1, medium: 2, hard: 3 };

export const getLeaderboard = async () => {
  try {
    const users = await getAllUsers();
    const rows = [];
    for (const u of users) {
      if (u.isAdmin) continue;
      const progress = await getUserProgress(u.id);
      let levels = 0;
      let points = 0;
      for (const entry of Object.values(progress)) {
        for (const [diff, passed] of Object.entries(entry.levels || {})) {
          const count = Object.values(passed).filter(Boolean).length;
          levels += count;
          points += count * QUESTIONS_PER_LEVEL * (DIFFICULTY_WEIGHT[diff] || 1);
        }
      }
      rows.push({ id: u.id, name: String(u.email || "user").split("@")[0], levels, points });
    }
    rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  } catch (error) {
    console.error("Error building leaderboard:", error);
    return [];
  }
};

// ---------- Phase 1B: per-user extras (mistakes, bookmarks, daily streak, stats, badges) ----------
// All stored per user id so each account on the device has its own data.
const userKey = (name, userId) => `quiz_${name}_${userId}`;

const readJson = async (key, fallback) => {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (error) {
    console.error("Error reading", key, error);
    return fallback;
  }
};

const writeJson = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value));

export const getQuestionsByIds = async (ids) => {
  const all = await getAllQuestions();
  const wanted = new Set(ids);
  return all.filter((q) => wanted.has(q.id));
};

// Mistakes: question ids the user answered wrong; removed again when answered correctly.
export const getMistakeIds = (userId) => readJson(userKey("mistakes", userId), []);

// Bookmarks: question ids the user starred.
export const getBookmarkIds = (userId) => readJson(userKey("bookmarks", userId), []);

export const toggleBookmark = async (userId, questionId) => {
  const ids = await getBookmarkIds(userId);
  const has = ids.includes(questionId);
  const next = has ? ids.filter((id) => id !== questionId) : [...ids, questionId];
  await writeJson(userKey("bookmarks", userId), next);
  return !has;
};

export const removeBookmark = async (userId, questionId) => {
  const ids = await getBookmarkIds(userId);
  await writeJson(userKey("bookmarks", userId), ids.filter((id) => id !== questionId));
};

export const removeMistake = async (userId, questionId) => {
  const ids = await getMistakeIds(userId);
  await writeJson(userKey("mistakes", userId), ids.filter((id) => id !== questionId));
};

// Record one answer. Updates the mistakes list; stats only count when countStats is true
// (so practising old mistakes cannot farm the "correct answers" badges).
export const recordAnswer = async (userId, questionId, correct, countStats = true) => {
  if (!userId) return;
  try {
    const mistakes = await getMistakeIds(userId);
    if (!correct && !mistakes.includes(questionId)) {
      await writeJson(userKey("mistakes", userId), [...mistakes, questionId]);
    } else if (correct && mistakes.includes(questionId)) {
      await writeJson(userKey("mistakes", userId), mistakes.filter((id) => id !== questionId));
    }
    if (countStats) {
      const stats = await readJson(userKey("stats", userId), { answered: 0, correct: 0 });
      stats.answered += 1;
      if (correct) stats.correct += 1;
      await writeJson(userKey("stats", userId), stats);
    }
  } catch (error) {
    console.error("Error recording answer:", error);
  }
};

export const getUserStats = (userId) => readJson(userKey("stats", userId), { answered: 0, correct: 0 });

// ----- Daily challenge -----
export const DAILY_QUESTION_COUNT = 10;

const dateKey = (d = new Date()) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const yesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
};

// Same 10 questions for everyone on a given day (seeded shuffle by date).
const seededRandom = (seedStr) => {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const getDailyQuestions = async () => {
  const all = (await getAllQuestions()).filter((q) => q.options && q.options.length > 1);
  const rand = seededRandom(dateKey());
  const arr = all.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, DAILY_QUESTION_COUNT);
};

export const getDailyStatus = async (userId) => {
  const d = await readJson(userKey("daily", userId), { lastDate: null, streak: 0, best: 0, history: [] });
  const today = dateKey();
  const alive = d.lastDate === today || d.lastDate === yesterdayKey();
  return {
    streak: alive ? d.streak : 0,
    best: d.best || 0,
    doneToday: d.lastDate === today,
    lastScore: d.lastScore ?? null,
    history: d.history || [],
  };
};

export const completeDaily = async (userId, score, total) => {
  const d = await readJson(userKey("daily", userId), { lastDate: null, streak: 0, best: 0, history: [] });
  const today = dateKey();
  if (d.lastDate === today) return getDailyStatus(userId);
  d.streak = d.lastDate === yesterdayKey() ? d.streak + 1 : 1;
  d.best = Math.max(d.best || 0, d.streak);
  d.lastDate = today;
  d.lastScore = `${score}/${total}`;
  d.history = [...(d.history || []), today].slice(-60);
  await writeJson(userKey("daily", userId), d);
  return getDailyStatus(userId);
};

// ----- Achievements (computed, nothing extra stored) -----
export const getAchievements = async (userId) => {
  const progress = await getUserProgress(userId);
  const stats = await getUserStats(userId);
  const daily = await getDailyStatus(userId);

  let levelsPassed = 0;
  let hardPassed = 0;
  let masterCount = 0;
  for (const entry of Object.values(progress)) {
    for (const [diff, passed] of Object.entries(entry.levels || {})) {
      const n = Object.values(passed).filter(Boolean).length;
      levelsPassed += n;
      if (diff === "hard") hardPassed += n;
    }
    if (entry.easy && entry.medium && entry.hard) masterCount += 1;
  }

  const defs = [
    { id: "firstLevel", icon: "flag", value: levelsPassed, target: 1 },
    { id: "levels10", icon: "layers", value: levelsPassed, target: 10 },
    { id: "hardHero", icon: "flame", value: hardPassed, target: 1 },
    { id: "master", icon: "ribbon", value: masterCount, target: 1 },
    { id: "streak3", icon: "calendar", value: daily.best, target: 3 },
    { id: "streak7", icon: "calendar-number", value: daily.best, target: 7 },
    { id: "correct100", icon: "checkmark-done", value: stats.correct, target: 100 },
    { id: "correct500", icon: "trophy", value: stats.correct, target: 500 },
  ];
  return defs.map((d) => ({ ...d, value: Math.min(d.value, d.target), unlocked: d.value >= d.target }));
};

// ----- Delete account (Play Store requirement): wipes this user's local data -----
export const deleteUserAccount = async (userId) => {
  try {
    const users = await getAllUsers();
    const target = users.find((u) => u.id === userId);
    if (!target || target.isAdmin) return false;
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users.filter((u) => u.id !== userId)));
    await AsyncStorage.multiRemove([
      `${PROGRESS_KEY}_${userId}`,
      userKey("mistakes", userId),
      userKey("bookmarks", userId),
      userKey("stats", userId),
      userKey("daily", userId),
      SESSION_KEY,
    ]);
    return true;
  } catch (error) {
    console.error("Error deleting account:", error);
    return false;
  }
};

export const initStorageWithSample = async (forceReset = false) => {
  try {
    if (forceReset) {
      await clearAllData();
    }
    
    let existingCategories = [];
    let categoriesCheckFailed = false;
    try {
      const data = await AsyncStorage.getItem(CATEGORIES_KEY);
      existingCategories = data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn("Categories check failed:", error);
      categoriesCheckFailed = true;
    }
    
    // Only initialize if it's empty AND check didn't fail, OR if forceReset is true
    if ((existingCategories.length === 0 && !categoriesCheckFailed) || forceReset) {
      await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(sampleCategories));
      console.log("Categories initialized");
    }

    let existingQuestions = [];
    let questionsCheckFailed = false;
    try {
      existingQuestions = await getAllQuestions();
    } catch (error) {
      console.warn("Questions check failed:", error);
      questionsCheckFailed = true;
    }
    
    if ((existingQuestions.length === 0 && !questionsCheckFailed) || forceReset) {
      await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(sampleQuestions));
      console.log("Questions initialized");
    }

    let existingUsers = [];
    try {
      existingUsers = await getAllUsers();
    } catch (error) {
      console.warn("Users check failed:", error);
    }
    
    if (__DEV__) {
      // Dev builds only: make sure a test admin exists
      if (!existingUsers.some(u => u.isAdmin)) {
        const devAdmin = await createDevAdmin();
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify([...existingUsers, devAdmin]));
        console.log("Dev admin created");
      }
    } else {
      // Release builds: remove the old hardcoded admin left by earlier app versions
      const cleaned = existingUsers.filter(u => !(u.password === "admin123" && u.isAdmin));
      if (cleaned.length !== existingUsers.length) {
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(cleaned));
      }
    }

    console.log("Storage initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing storage:", error);
    return false;
  }
};

export const clearAllData = async () => {
  try {
    await AsyncStorage.multiRemove([QUESTIONS_KEY, USERS_KEY, CATEGORIES_KEY, IMAGES_KEY]);
    
    const allKeys = await AsyncStorage.getAllKeys();
    const progressKeys = allKeys.filter(key => key.startsWith(PROGRESS_KEY));
    if (progressKeys.length > 0) {
      await AsyncStorage.multiRemove(progressKeys);
    }
    
    try {
      const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(IMAGE_DIR);
        console.log("Images directory cleared");
      }
    } catch (error) {
      console.warn("Error clearing images directory:", error);
    }
    
    console.log("All data cleared");
  } catch (error) {
    console.error("Error clearing data:", error);
    throw error;
  }
};

export const forceResetData = async () => {
  try {
    await initStorageWithSample(true);
    return true;
  } catch (error) {
    console.error("Error force resetting data:", error);
    throw error;
  }
};

export const loginUserSession = async (user) => {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sanitizeUser(user)));
    return true;
  } catch (error) {
    console.error("Error saving session:", error);
    return false;
  }
};

export const logoutUserSession = async () => {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
    return true;
  } catch (error) {
    console.error("Error removing session:", error);
    return false;
  }
};

export const getLoggedInUserSession = async () => {
  try {
    const data = await AsyncStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
};

export const cleanupUnusedImages = async () => {
  try {
    const categories = await getAllCategories();
    const imageMetadata = await getImageMetadata();
    
    const activeCategoryIds = categories.map(c => c.id);
    let cleanedCount = 0;
    
    for (const [categoryId] of Object.entries(imageMetadata)) {
      if (!activeCategoryIds.includes(categoryId)) {
        await deleteCategoryImage(categoryId);
        cleanedCount++;
      }
    }
    
    console.log(`Cleaned up ${cleanedCount} unused images`);
    return cleanedCount;
  } catch (error) {
    console.error("Error cleaning up unused images:", error);
    return 0;
  }
};