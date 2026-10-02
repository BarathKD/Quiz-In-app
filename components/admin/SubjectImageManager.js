import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { saveCategoryImage, getCategoryImage, deleteCategoryImage, getAllCategories } from "../../utils/storage";

export default function SubjectImageManager({ category, onClose }) {
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [opacity, setOpacity] = useState(0.3);
  const [loading, setLoading] = useState(false);

  const subcategories = category?.subcategories || [];
  const hasNestedStructure = category?.subjects && typeof category.subjects === 'object';

  const getSubjects = () => {
    if (!selectedSubcategory) return [];
    if (hasNestedStructure) {
      return category.subjects[selectedSubcategory] || [];
    }
    return [];
  };

  useEffect(() => {
    loadExistingImage();
  }, [selectedSubcategory, selectedSubject]);

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

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert("Error", "Image too large. Please select an image under 5MB.");
        return;
      }
      
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

      const path = await saveCategoryImage(
        category.id, 
        imageData.base64, 
        selectedSubcategory, 
        selectedSubject
      );

      const categories = await getAllCategories();
      const catIndex = categories.findIndex(c => c.id === category.id);
      if (catIndex !== -1) {
        if (!categories[catIndex].subjectImages) {
          categories[catIndex].subjectImages = {};
        }
        
        const key = selectedSubject ? 
          `${selectedSubcategory}_${selectedSubject}` : 
          selectedSubcategory;
        
        categories[catIndex].subjectImages[key] = {
          opacity: opacity,
          hasImage: true
        };
        
        await AsyncStorage.setItem('quiz_categories', JSON.stringify(categories));
      }

      Alert.alert(
        "Success", 
        `Image saved successfully!\nPath: ${path}\nOpacity: ${Math.round(opacity * 100)}%`
      );
      
      setImageData(null);
    } catch (error) {
      console.error("Error saving image:", error);
      Alert.alert("Error", "Failed to save image: " + error.message);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Background Images</Text>
        <Text style={styles.subtitle}>Category: {category?.name}</Text>
      </View>

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

      {selectedSubcategory && (
        <View style={styles.selectionInfo}>
          <Text style={styles.selectionText}>
            Setting image for: {category?.name} › {selectedSubcategory}
            {selectedSubject && ` › ${selectedSubject}`}
          </Text>
        </View>
      )}

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
                minimumTrackTintColor="#6366F1"
                maximumTrackTintColor="#d3d3d3"
              />
              <View style={styles.opacityLabels}>
                <Text style={styles.labelText}>More Transparent</Text>
                <Text style={styles.labelText}>More Opaque</Text>
              </View>
            </View>
          )}

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
    backgroundColor: "#6366F1"
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
    backgroundColor: "#6366F1",
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
    backgroundColor: "#6366F1",
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