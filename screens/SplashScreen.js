import React, { useEffect } from "react";
import { View, Text, StyleSheet,Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getLoggedInUserSession } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors } from "../utils/theme";

export default function SplashScreen() {
  const navigation = useNavigation();
  const { t } = useLang();

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
        <Text style={styles.subtitle}>{t("tagline")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  box: { alignItems: "center" },
  logo:{ width: 250, height: 250, resizeMode: 'contain' },
  title: { fontSize: 36, fontWeight: "800", color: colors.primary },
  subtitle: { marginTop: 8, fontSize: 16, color: colors.muted }
});

