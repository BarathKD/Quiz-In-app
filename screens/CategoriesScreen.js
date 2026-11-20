import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Alert, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Header from "../components/header";
import BottomNav from "../components/BottomNav";
import LanguageToggle from "../components/LanguageToggle";
import FadeInUp from "../components/FadeInUp";
import PressableScale from "../components/PressableScale";
import MenuRow from "../components/MenuRow";
import { getAllCategories, logoutUserSession, getDailyStatus, getMistakeIds, getBookmarkIds } from "../utils/api";
import { useLang } from "../utils/i18n";
import { colors, fonts, shadow } from "../utils/theme";

export default function CategoriesScreen({ navigation, route }) {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(route.params?.initialTab || "categories");
  const [categories, setCategories] = useState([]);
  const user = route?.params?.user;

  const [daily, setDaily] = useState(null);
  const [counts, setCounts] = useState({ mistakes: 0, bookmarks: 0 });

  const loadExtras = async () => {
    if (!user?.id) return;
    setDaily(await getDailyStatus(user.id));
    setCounts({
      mistakes: (await getMistakeIds(user.id)).length,
      bookmarks: (await getBookmarkIds(user.id)).length,
    });
  };

  useEffect(() => {
    loadCategories();
    loadExtras();
    const unsubscribe = navigation.addListener("focus", loadExtras);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const loadCategories = async () => {
    try {
      const cats = await getAllCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleCategoryPress = (category) => {
    navigation.navigate("Subcategories", { category, user });
  };

  const handleLogout = () => {
    Alert.alert(t("logout"), t("logoutConfirm"), [
      { text: t("cancel") },
      {
        text: t("logout"),
        style: "destructive",
        onPress: async () => {
          await logoutUserSession();
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        },
      },
    ]);
  };

  const renderBanner = () => (
    <View style={[styles.banner, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
      <View style={styles.bannerTop}>
        <Text style={styles.brand}>Quiz-IN</Text>
        <LanguageToggle variant="onPrimary" />
      </View>
      <Text style={styles.greeting}>{t("greeting")}</Text>
      <Text style={styles.greetingSub}>{t("pickCategory")}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {activeTab === "categories" ? (
        <FlatList
          ListHeaderComponent={
            <View>
              {renderBanner()}
              {user?.id ? (
                <FadeInUp index={0} style={styles.dailyWrap}>
                  <PressableScale
                    style={styles.dailyCard}
                    onPress={() => navigation.navigate("DailyChallenge", { user })}
                  >
                    <View style={styles.dailyIcon}>
                      <Ionicons name="flame" size={28} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dailyTitle}>{t("dailyChallenge")}</Text>
                      <Text style={styles.dailySub}>
                        {daily?.doneToday ? t("dailyDone") : t("dailySub")}  •  {t("dailyStreak", { n: daily?.streak || 0 })}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
                  </PressableScale>
                </FadeInUp>
              ) : null}
              <Text style={styles.sectionTitle}>{t("categories")}</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <FadeInUp index={index} style={styles.rowWrap}>
              <PressableScale style={styles.categoryCard} onPress={() => handleCategoryPress(item)}>
                <View style={styles.iconTile}>
                  <Ionicons name="book-outline" size={26} color={colors.primary} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.categoryName} numberOfLines={2}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.categoryDescription} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>
                      {t("subjectsCount", { n: item.subcategories?.length || 0 })}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.muted} />
              </PressableScale>
            </FadeInUp>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t("emptyCategories")}</Text>
              <Text style={styles.emptySubtext}>{t("emptyCategoriesSub")}</Text>
            </View>
          }
        />
      ) : (
        <View style={{ flex: 1 }}>
          <Header title={t("profile")} />
          <ScrollView contentContainerStyle={styles.userProfileContainer}>
            <View style={styles.profileCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{user?.email?.charAt(0).toUpperCase() || 'U'}</Text>
              </View>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profileRole}>{t("student")}</Text>
            </View>

            <MenuRow icon="flame-outline" title={t("dailyChallenge")} subtitle={t("dailySub")}
              onPress={() => navigation.navigate("DailyChallenge", { user })} />
            <MenuRow icon="ribbon-outline" title={t("achievements")}
              onPress={() => navigation.navigate("Achievements", { user })} />
            <MenuRow icon="alert-circle-outline" title={t("mistakes")} subtitle={t("mistakesSub")} badge={counts.mistakes}
              onPress={() => navigation.navigate("Review", { user, mode: "mistakes" })} />
            <MenuRow icon="star-outline" title={t("bookmarks")} subtitle={t("bookmarksSub")} badge={counts.bookmarks}
              onPress={() => navigation.navigate("Review", { user, mode: "bookmarks" })} />
            <MenuRow icon="settings-outline" title={t("settings")}
              onPress={() => navigation.navigate("Settings", { user })} />
            <MenuRow icon="log-out-outline" title={t("logout")} subtitle={t("logoutSub")} onPress={handleLogout} danger />
          </ScrollView>
        </View>
      )}

      <BottomNav navigation={navigation} user={user} activeTab={activeTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  bannerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.onPrimary,
  },
  greeting: {
    fontFamily: fonts.heading,
    fontSize: 30,
    color: colors.onPrimary,
    marginTop: 14,
  },
  greetingSub: {
    fontSize: 16,
    color: colors.onPrimary,
    opacity: 0.92,
    marginTop: 2,
    lineHeight: 24,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.ink,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 10,
  },
  rowWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    ...shadow,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 26,
  },
  categoryDescription: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 21,
  },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: colors.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  chipText: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
  },
  userProfileContainer: {
    padding: 16,
    paddingBottom: 28,
  },
  dailyWrap: { paddingHorizontal: 20, marginTop: 18 },
  dailyCard: {
    backgroundColor: colors.accent, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", ...shadow,
  },
  dailyIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  dailyTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  dailySub: { color: "#FFFFFF", opacity: 0.92, fontSize: 13, lineHeight: 20 },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    color: colors.onPrimary,
    fontWeight: "bold",
  },
  profileEmail: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: colors.muted,
  },
  settingRow: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  settingTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  logoutCardBtn: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.dangerTint,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  logoutTextContainer: {
    flex: 1,
  },
  logoutCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  logoutCardSub: {
    fontSize: 13,
    color: colors.muted,
  },
});
