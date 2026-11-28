/*
 * SubjectImageManager
 * What: admin tool to set a background image for a quiz category.
 *       The admin picks a subcategory (and optionally a subject), chooses a picture from the phone gallery,
 *       sets the white overlay opacity, then saves. The quiz screens show this image behind the questions.
 * Props (from the parent admin screen):
 *   category = the category object being edited ({ id, name, subcategories, subjects, subjectImages })
 *   onClose  = function called when the admin presses Cancel (parent hides this component)
 * Data: utils/api.js -> getCategoryImage, saveCategoryImage, deleteCategoryImage, getAllCategories.
 *       Opacity is also saved in AsyncStorage key 'quiz_categories' (category.subjectImages).
 * If the image does not show or does not save, check: the key format in saveImage(), and loadExistingImage().
 * Note: this file is not imported by screens/AdminScreen.js at the moment.
 */
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { saveCategoryImage, getCategoryImage, deleteCategoryImage, getAllCategories } from "../../utils/api";

export default function SubjectImageManager({ category, onClose }) {
  // State: which subcategory / subject the admin selected (subject is optional, null = all subjects).
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  // State: imageUri = picture shown in preview (saved or newly picked).
  // imageData = newly picked picture ({ uri, base64, width, height }); null until the admin picks one.
  // opacity = white overlay strength (0.1 to 0.8). loading = true while saving.
  const [imageUri, setImageUri] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [opacity, setOpacity] = useState(0.3);
  const [loading, setLoading] = useState(false);

  // Lists from the category prop. hasNestedStructure = true when category.subjects is an object like { subcategory: [subjects] }.
  const subcategories = category?.subcategories || [];
  const hasNestedStructure = category?.subjects && typeof category.subjects === 'object';

  // Helper: returns the subject list of the selected subcategory (empty if none or if the category has no nested subjects).
  const getSubjects = () => {
    if (!selectedSubcategory) return [];
    if (hasNestedStructure) {
      return category.subjects[selectedSubcategory] || [];
    }
    return [];
  };

  // Effect: each time the selected subcategory or subject changes, load the image that is already saved for it.
  useEffect(() => {
    loadExistingImage();
  }, [selectedSubcategory, selectedSubject]);

  // Helper: asks utils/api.js for the saved image of this category/subcategory/subject.
  // If none is found, clear the preview. Errors are only logged.
  const loadExistingImage = async () => {
    if (!selectedSubcategory) return;
    
    try {
      const uri = await getCategoryImage(category.id, selectedSubcategory, selectedSubject);
      if (uri) {
        setImageUri(uri);
        console.log("Loaded existing image:", uri);
      } else {
        setImageUri(null);
        setImageData(null);
      }
    } catch (error) {
      console.error("Error loading existing image:", error);
    }
  };

  // Handler: open the phone gallery and let the admin pick one image (cropped 16:9, quality 0.8).
  // base64 is requested so saveImage() can send the picture as text to utils/api.js. Nothing is saved here.
  const pickImage = async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
      allowsMultipleSelection: false,
    });

    // result.canceled = true when the admin closes the gallery without choosing.
    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      
      // Reject files bigger than 5 MB.
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert("Error", "Image too large. Please select an image under 5MB.");
        return;
      }
      
      // Show the preview now and keep the base64 data for saveImage().
      setImageUri(asset.uri);
      setImageData({
        uri: asset.uri,
        base64: asset.base64,
        width: asset.width,
        height: asset.height
      });
      Alert.alert("Success", "Image selected. Click 'Save Image' to apply.");
    }
  } catch (error) {
    console.error('Error picking image:', error);
    Alert.alert("Error", "Failed to pick image: " + error.message);
  }
};

  // Handler: save the picked image. Needs a selected subcategory and a picked image (imageData.base64).
  const saveImage = async () => {
    if (!selectedSubcategory) {
      Alert.alert("Error", "Please select a subcategory");
      return;
    }

    if (!imageData || !imageData.base64) {
      Alert.alert("Error", "Please select an image first");
      return;
    }

    setLoading(true);
    try {
      console.log("Saving image for:", {
        category: category.id,
        subcategory: selectedSubcategory,
        subject: selectedSubject
      });

      // utils/api.js saves the image file and returns its path.
      const path = await saveCategoryImage(
        category.id, 
        imageData.base64, 
        selectedSubcategory, 
        selectedSubject
      );

      // Also remember the opacity inside the category data, so the quiz screens know how strong the overlay is.
      const categories = await getAllCategories();
      const catIndex = categories.findIndex(c => c.id === category.id);
      if (catIndex !== -1) {
        if (!categories[catIndex].subjectImages) {
          categories[catIndex].subjectImages = {};
        }
        
        // Key = 'subcategory_subject', or only 'subcategory' when no subject is selected.
        const key = selectedSubject ? 
          `${selectedSubcategory}_${selectedSubject}` : 
          selectedSubcategory;
        
        categories[catIndex].subjectImages[key] = {
          opacity: opacity,
          hasImage: true
        };
        
        // Write the updated category list back to local storage.
        await AsyncStorage.setItem('quiz_categories', JSON.stringify(categories));
      }

      Alert.alert(
        "Success", 
        `Image saved successfully!\nPath: ${path}\nOpacity: ${Math.round(opacity * 100)}%`
      );
      
      // Clear the picked data; the saved image stays in the preview.
      setImageData(null);
    } catch (error) {
      console.error("Error saving image:", error);
      Alert.alert("Error", "Failed to save image: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler: remove the saved image. Asks for confirmation first; utils/api.js deleteCategoryImage runs only on the Delete button.
  const removeImage = async () => {
    if (!selectedSubcategory) {
      Alert.alert("Error", "Please select a subcategory");
      return;
    }

    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to remove this background image?",
      [
        { text: "Cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCategoryImage(category.id, selectedSubcategory, selectedSubject);
              setImageUri(null);
              setImageData(null);
              Alert.alert("Success", "Background image removed");
            } catch (error) {
              console.error("Error removing image:", error);
              Alert.alert("Error", "Failed to remove image");
            }
          }
        }
      ]
    );
  };

  // Render: header, subcategory chips, optional subject chips, info line, image controls, preview, opacity slider, Cancel/Save buttons.
  return (
    <ScrollView style={styles.container}>
      {/* Header: title and the category name */}
      <View style={styles.header}>
        <Text style={styles.title}>Manage Background Images</Text>
        <Text style={styles.subtitle}>Category: {category?.name}</Text>
      </View>

      {/* Subcategory chips: tapping one selects it and clears the subject and the preview */}
      <View style={styles.section}>
        <Text style={styles.label}>Select Subcategory:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.optionsRow}>
            {subcategories.map(sub => (
              <TouchableOpacity
                key={sub}
                style={[
                  styles.option,
                  selectedSubcategory === sub && styles.selectedOption
                ]}
                onPress={() => {
                  setSelectedSubcategory(sub);
                  setSelectedSubject(null);
                  setImageUri(null);
                  setImageData(null);
                }}
              >
                <Text style={[
                  styles.optionText,
                  selectedSubcategory === sub && styles.selectedText
                ]}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Subject chips (optional): only when the category has nested subjects for the selected subcategory.
          'All Subjects' = no subject (selectedSubject null). */}
      {selectedSubcategory && hasNestedStructure && getSubjects().length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Select Subject (Optional):</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[
                  styles.option,
                  !selectedSubject && styles.selectedOption
                ]}
                onPress={() => {
                  setSelectedSubject(null);
                  setImageUri(null);
                  setImageData(null);
                }}
              >
                <Text style={[
                  styles.optionText,
                  !selectedSubject && styles.selectedText
                ]}>All Subjects</Text>
              </TouchableOpacity>
              {getSubjects().map(subject => (
                <TouchableOpacity
                  key={subject}
                  style={[
                    styles.option,
                    selectedSubject === subject && styles.selectedOption
                  ]}
                  onPress={() => {
                    setSelectedSubject(subject);
                    setImageUri(null);
                    setImageData(null);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    selectedSubject === subject && styles.selectedText
                  ]}>{subject}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Info line: shows which category > subcategory > subject will get the image */}
      {selectedSubcategory && (
        <View style={styles.selectionInfo}>
          <Text style={styles.selectionText}>
            Setting image for: {category?.name} › {selectedSubcategory}
            {selectedSubject && ` › ${selectedSubject}`}
          </Text>
        </View>
      )}

      {/* Everything below shows only after a subcategory is selected */}
      {selectedSubcategory && (
        <>
          <View style={styles.imageControls}>
            <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
              <Text style={styles.btnText}>📷 Choose Image</Text>
            </TouchableOpacity>
            
            {imageUri && (
              <TouchableOpacity style={styles.removeBtn} onPress={removeImage}>
                <Text style={styles.btnText}>🗑️ Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Preview: the picture with a white overlay. The overlay color uses the opacity state */}
          {imageUri && (
            <View style={styles.preview}>
              <Text style={styles.previewLabel}>Preview:</Text>
              <View style={styles.previewContainer}>
                <Image 
                  source={{ uri: imageUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <View style={[
                  styles.previewOverlay,
                  { backgroundColor: `rgba(255, 255, 255, ${opacity})` }
                ]}>
                  <Text style={styles.overlayText}>Quiz Background</Text>
                </View>
              </View>
            </View>
          )}

          {/* Opacity slider (range 0.1 to 0.8); only after an image is available */}
          {imageUri && (
            <View style={styles.opacitySection}>
              <Text style={styles.label}>
                Background Opacity: {Math.round(opacity * 100)}%
              </Text>
              <Text style={styles.helpText}>
                Higher opacity = more white overlay (better text readability)
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={0.1}
                maximumValue={0.8}
                value={opacity}
                onValueChange={setOpacity}
                minimumTrackTintColor="#0C6478"
                maximumTrackTintColor="#d3d3d3"
              />
              <View style={styles.opacityLabels}>
                <Text style={styles.labelText}>More Transparent</Text>
                <Text style={styles.labelText}>More Opaque</Text>
              </View>
            </View>
          )}

          {/* Buttons: Cancel calls onClose; Save is disabled while saving or when no new image was picked */}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={onClose}
            >
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveBtn, loading && styles.disabledBtn]} 
              onPress={saveImage}
              disabled={loading || !imageData}
            >
              <Text style={styles.btnText}>
                {loading ? "Saving..." : "Save Image"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// Styles for this component.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  header: {
    marginBottom: 20
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: "#666"
  },
  section: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8
  },
  helpText: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8
  },
  optionsRow: {
    flexDirection: "row"
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    marginRight: 8
  },
  selectedOption: {
    backgroundColor: "#0C6478"
  },
  optionText: {
    fontSize: 14,
    color: "#666"
  },
  selectedText: {
    color: "#fff",
    fontWeight: "600"
  },
  selectionInfo: {
    backgroundColor: "#e3f2fd",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  selectionText: {
    fontSize: 13,
    color: "#1976d2",
    fontWeight: "600"
  },
  imageControls: {
    flexDirection: "row",
    marginBottom: 16
  },
  pickBtn: {
    flex: 1,
    backgroundColor: "#0C6478",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 8
  },
  removeBtn: {
    flex: 1,
    backgroundColor: "#f44336",
    padding: 14,
    borderRadius: 8,
    alignItems: "center"
  },
  preview: {
    marginBottom: 16
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8
  },
  previewContainer: {
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative"
  },
  previewImage: {
    width: "100%",
    height: "100%"
  },
  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center"
  },
  overlayText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333"
  },
  opacitySection: {
    marginBottom: 16
  },
  slider: {
    width: "100%",
    height: 40
  },
  opacityLabels: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  labelText: {
    fontSize: 11,
    color: "#888"
  },
  actions: {
    flexDirection: "row",
    marginTop: 20
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#6c757d",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 8
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#0C6478",
    padding: 14,
    borderRadius: 8,
    alignItems: "center"
  },
  disabledBtn: {
    opacity: 0.5
  },
  btnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  }
});