import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { getUserByEmail, addUser } from "../utils/storage";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    if (!email || !password) return Alert.alert("Enter email and password");
    const user = await getUserByEmail(email);
    if (user && user.password === password) {
      navigation.reset({ index: 0, routes: [{ name: "Classes", params: { user: user } }] });
    } else {
      Alert.alert("Invalid credentials. You can create an account.");
    }
  };

  const signup = async () => {
    if (!email || !password) return Alert.alert("Enter email and password");
    const userExists = await getUserByEmail(email);
    if (userExists) return Alert.alert("User exists. Try login.");
    await addUser({ id: email, email, password, isAdmin: false });
    Alert.alert("Account created. Please login.");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>TN Quiz</Text>
      <TextInput placeholder="Email" style={styles.input} autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Password" style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={styles.btn} onPress={login}><Text style={styles.btnText}>Login</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={signup}><Text>Sign up</Text></TouchableOpacity>
      <TouchableOpacity style={{marginTop:12}} onPress={()=>navigation.navigate("Admin")}>
        <Text style={{color:"#006"}}>Open Admin (for demo)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1, justifyContent:"center", padding:20, backgroundColor:"#fff"},
  logo:{fontSize:32, fontWeight:"800", marginBottom:20, textAlign:"center", color:"#4F46E5"},
  input:{borderWidth:1, borderColor:"#ddd", padding:12, borderRadius:8, marginBottom:12},
  btn:{backgroundColor:"#4F46E5", padding:12, borderRadius:8, alignItems:"center"},
  btnText:{color:"#fff", fontWeight:"700"},
  secondary:{backgroundColor:"#e0f6ea", marginTop:8}
});
