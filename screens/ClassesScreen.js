import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import Header from "../components/header";

const classes = [6,7,8,9,10,11,12];

export default function ClassesScreen({ navigation }) {
  return (
    <View style={{flex:1}}>
      <Header title="Select Class" onBack={()=>navigation.goBack()}/>
      <FlatList
        contentContainerStyle={{padding:16}}
        data={classes}
        keyExtractor={(i)=>i.toString()}
        renderItem={({item})=>(
          <TouchableOpacity style={styles.card} onPress={()=>navigation.navigate("Subjects", { classNum: item })}>
            <Text style={styles.classText}>Class {item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card:{padding:20, backgroundColor:"#f2fff5", borderRadius:10, marginBottom:12, alignItems:"center"},
  classText:{fontSize:18, fontWeight:"700", color:"#073"}
});

