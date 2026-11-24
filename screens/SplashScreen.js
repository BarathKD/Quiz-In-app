import React, { useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getLoggedInUserSession, USE_SERVER } from "../utils/api";
import { fonts } from "../utils/theme";

// Animated opening: 3D-looking cards float in, merge into the logo, then Tamil + English taglines appear.
// Always shows both languages. Uses only core Animated (works in Expo Go). No red or yellow.
const { width: W } = Dimensions.get("window");
const HOLD_MS = 700; // pause on the finished logo before moving on
const BG = "#062F3A";

const CARDS = [
  { icon: "help", color: "#0C6478", x: -0.30, y: -150 },
  { icon: "bulb", color: "#7B4BC0", x: 0.30, y: -120 },
  { icon: "trophy", color: "#2E7D4F", x: -0.34, y: 40 },
  { icon: "star", color: "#2F8FB5", x: 0.34, y: 70 },
  { icon: "school", color: "#9168D6", x: -0.12, y: 150 },
  { icon: "flash", color: "#3FA56B", x: 0.14, y: -40 },
];

export default function SplashScreen() {
  const navigation = useNavigation();
  const done = useRef(false);
  const skip = useRef(false);
  const target = useRef(null);
  const animDone = useRef(false);

  const enter = useRef(CARDS.map(() => new Animated.Value(0))).current;
  const spin = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const merge = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const tagTa = useRef(new Animated.Value(0)).current;
  const tagEn = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const go = () => {
    if (done.current || !target.current) return;
    if (!animDone.current && !skip.current) return; // wait for the full animation unless the user taps to skip
    done.current = true;
    navigation.replace(target.current.name, target.current.params);
  };

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ])),
    ];
    loops.forEach((l) => l.start());

    const timeline = Animated.sequence([
      Animated.stagger(110, enter.map((v) => Animated.spring(v, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }))),
      Animated.delay(250),
      Animated.timing(merge, { toValue: 1, duration: 520, easing: Easing.in(Easing.back(1.2)), useNativeDriver: true }),
      Animated.spring(logo, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(shine, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(tagTa, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(tagEn, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]),
      ]),
    ]);
    let timer;
    timeline.start(({ finished }) => {
      if (!finished) return;
      timer = setTimeout(() => { animDone.current = true; go(); }, HOLD_MS);
    });

    (async () => {
      let next;
      try {
        const user = await getLoggedInUserSession();
        if (!user) next = { name: "Login" };
        else if (user.isAdmin && !USE_SERVER) next = { name: "Admin", params: { user } };
        else next = { name: "Categories", params: { user } };
      } catch (error) {
        console.error("Auth check failed:", error);
        next = { name: "Login" };
      }
      target.current = next;
      go(); // moves on only when the animation has finished (or the user tapped to skip)
    })();

    return () => {
      clearTimeout(timer);
      loops.forEach((l) => l.stop());
      timeline.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSkip = () => {
    skip.current = true;
    go(); // if the login check is still running, it navigates as soon as it finishes
  };

  const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const rotateYSlow = spin.interpolate({ inputRange: [0, 1], outputRange: ["20deg", "-340deg"] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });
  const logoScale = logo.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-160, 160] });

  const cards = useMemo(() => CARDS, []);

  return (
    <Pressable style={styles.container} onPress={onSkip}>
      <Animated.View style={[styles.blob, { backgroundColor: "#0C6478", top: -90, left: -90, opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[styles.blob, { backgroundColor: "#7B4BC0", bottom: -110, right: -100, opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[styles.blobSmall, { backgroundColor: "#2E7D4F", bottom: 120, left: -60, opacity: glowOpacity }]} />

      <View style={styles.stage}>
        {cards.map((c, i) => {
          const x0 = c.x * W;
          const appear = enter[i];
          const tx = merge.interpolate({ inputRange: [0, 1], outputRange: [x0, 0] });
          const ty = merge.interpolate({ inputRange: [0, 1], outputRange: [c.y, 0] });
          const mScale = merge.interpolate({ inputRange: [0, 1], outputRange: [1, 0.1] });
          const mFade = merge.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
          const pop = appear.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
          return (
            <Animated.View
              key={c.icon}
              style={[
                styles.card,
                {
                  backgroundColor: c.color,
                  opacity: Animated.multiply(appear, mFade),
                  transform: [
                    { perspective: 700 },
                    { translateX: tx },
                    { translateY: Animated.add(ty, bobY) },
                    { scale: Animated.multiply(pop, mScale) },
                    { rotateY: i % 2 ? rotateY : rotateYSlow },
                    { rotateZ: i % 2 ? "-8deg" : "8deg" },
                  ],
                },
              ]}
            >
              <View style={styles.cardShine} />
              <Ionicons name={c.icon} size={34} color="#F4F9F8" />
            </Animated.View>
          );
        })}

        <Animated.View style={[styles.logoWrap, { opacity: logo, transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoBox}>
            <Text style={styles.logoTamil}>வினாடி வினா</Text>
            <Text style={styles.logoText}>Quiz-IN</Text>
            <Animated.View style={[styles.shine, { transform: [{ translateX: shineX }, { rotate: "18deg" }] }]} />
          </View>
        </Animated.View>
      </View>

      <View style={styles.taglines}>
        <Animated.Text style={[styles.tagTa, { opacity: tagTa }]}>கேள். கற்றுக்கொள். வெல்!</Animated.Text>
        <Animated.Text style={[styles.tagEn, { opacity: tagEn }]}>Ask. Learn. Win!</Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  blob: { position: "absolute", width: 300, height: 300, borderRadius: 150 },
  blobSmall: { position: "absolute", width: 160, height: 160, borderRadius: 80 },
  stage: { width: W, height: 360, alignItems: "center", justifyContent: "center" },
  card: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(244,249,248,0.35)",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  cardShine: {
    position: "absolute",
    top: 0, left: 0, right: 0, height: 26,
    borderTopLeftRadius: 17, borderTopRightRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  logoWrap: { position: "absolute", alignItems: "center" },
  logoBox: {
    backgroundColor: "#0C6478",
    paddingHorizontal: 34,
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(244,249,248,0.45)",
    elevation: 14,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  logoText: { fontFamily: fonts.heading, fontSize: 46, color: "#F4F9F8", lineHeight: 62 },
  logoTamil: { fontFamily: fonts.headingSemi, fontSize: 20, color: "#CBB8F0", marginBottom: -6 },
  shine: { position: "absolute", top: -20, bottom: -20, width: 36, backgroundColor: "rgba(255,255,255,0.28)" },
  taglines: { height: 80, alignItems: "center", marginTop: 8 },
  tagTa: { fontFamily: fonts.headingSemi, fontSize: 20, color: "#DCEEF2" },
  tagEn: { fontFamily: fonts.headingSemi, fontSize: 17, color: "#9FD3C0", marginTop: 4, letterSpacing: 1 },
});
