/*
 * CategoryList
 * What: shows the categories as cards in the admin panel (Categories tab).
 * Props (from screens/AdminScreen.js):
 *   categories = array of category objects ({ id, name, description, subcategories, subjects })
 *   onEdit(category)   = called when Edit is pressed (AdminScreen opens the edit form)
 *   onDelete(category) = called when Delete is pressed (AdminScreen asks to confirm, then deletes via utils/api.js)
 * This component only displays data; it does not call the API itself.
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";

export default function CategoryList({ categories, onEdit, onDelete }) {
  // Render helper: one card for one category (FlatList gives { item }).
  const renderCategoryItem = ({ item }) => (
    <View style={styles.card}>
      {/* Card title (category name, one line only) */}
      <View style={styles.categoryHeader}>
        <Text numberOfLines={1} style={styles.cardTitle}>{item.name}</Text>
      </View>
      
      {/* Description is optional, so show it only when it exists */}
      {item.description && (
        <Text style={styles.cardDescription}>{item.description}</Text>
      )}
      
      {/* Structure info. Two data shapes exist:
          1) nested: subjects is an object { subcategory: [subjects] } -> show the first 2 entries and '... and more'
          2) direct: only a subcategories list -> show it as text */}
      {item.subjects && typeof item.subjects === 'object' ? (
        <View>
          <Text style={styles.cardInfo}>
            Nested Structure: {(item.subcategories || []).length} categories
          </Text>
          {Object.entries(item.subjects).slice(0, 2).map(([sub, subjects]) => (
            <Text key={sub} style={styles.cardSubInfo}>
              • {sub}: {subjects.join(", ")}
            </Text>
          ))}
          {Object.keys(item.subjects).length > 2 && (
            <Text style={styles.cardSubInfo}>• ... and more</Text>
          )}
        </View>
      ) : (
        <Text style={styles.cardInfo}>
          Direct subjects: {(item.subcategories || []).join(", ")}
        </Text>
      )}
      

      {/* Action buttons: pass the whole category object to the parent handlers */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.small} onPress={() => onEdit(item)}>
          <Text style={styles.smallText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.small, { marginLeft: 8, backgroundColor: "#ffebee" }]} 
          onPress={() => onDelete(item)}
        >
          <Text style={[styles.smallText, { color: "#c62828" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render: scrollEnabled is false because the parent admin screen already scrolls (avoids nested scrolling).
  return (
    <FlatList 
      data={categories} 
      keyExtractor={c => c.id} 
      renderItem={renderCategoryItem}
      style={styles.list}
      scrollEnabled={false}
    />
  );
}

// Styles for this component.
const styles = StyleSheet.create({
  list: {
    marginTop: 8
  },
  card: {
    padding: 12, 
    borderWidth: 1, 
    borderColor: "#eee", 
    borderRadius: 8, 
    marginTop: 8,
    backgroundColor: "#fff"
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cardTitle: {
    fontWeight: "700", 
    fontSize: 15,
    flex: 1
  },
  cardDescription: {
    color: "#666", 
    marginTop: 4,
    fontSize: 14
  },
  cardInfo: {
    color: "#666", 
    marginTop: 4,
    fontSize: 12
  },
  cardSubInfo: {
    color: "#888", 
    marginTop: 2,
    fontSize: 11,
    marginLeft: 8
  },

  cardActions: {
    flexDirection: "row", 
    marginTop: 8
  },
  small: {
    padding: 8, 
    backgroundColor: "#e3f2fd", 
    borderRadius: 6
  },
  smallText: {
    fontSize: 12,
    fontWeight: "600"
  }
});