import React, { useEffect } from "react";
import { View, Text, StyleSheet,Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getLoggedInUserSession } from "../utils/storage";

export default function SplashScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const user = await getLoggedInUserSession();
        
        const timer = setTimeout(() => {
          if (user) {
            if (user.isAdmin) {
              navigation.replace("Admin", { user });
            } else {
              navigation.replace("Categories", { user });
            }
          } else {
            navigation.replace("Login");
          }
        }, 2000);
        
        return () => clearTimeout(timer);
      } catch (error) {
        console.error("Auth check failed:", error);
        navigation.replace("Login");
      }
    };
    
    checkLogin();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        {/*splashimage*/}
        <Image source={require('../assets/images/splash.png')} style={styles.logo} />
        {/*<Text style={styles.title}>Quiz-IN</Text>*/}
        <Text style={styles.subtitle}>Hardest Game Ever</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f7f7f7" },
  box: { alignItems: "center" },
  logo:{ width: 250, height: 250, resizeMode: 'contain' , color: 'black', backgroundColor: '#f7f7f7' },
  title: { fontSize: 36, fontWeight: "800", color: "#4F46E5" },
  subtitle: { marginTop: 8, fontSize: 14, color: "#666" }
});

