// SplashScreen.js - first screen (initialRouteName in App.js). Plays an intro animation and, at the same time, checks if a user is already logged in.
// ROUTE PARAMS: none.
// NAVIGATES TO (navigation.replace): "Login" (no session), "Admin" (local-mode admin) or "Categories" (logged in user).
// TALKS TO: utils/api.js (getLoggedInUserSession, USE_SERVER).
// It moves on only when BOTH are done: the session check finished AND the animation finished (or user tapped to skip). See go().
// If the app is stuck on this screen, check go() and the session check inside useEffect.
import React, { useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getLoggedInUserSession, USE_SERVER } from "../utils/api";
import { fonts } from "../utils/theme";

// Animated opening: 3D-looking cards float in, merge into the logo, then Tamil + English taglines appear.
// Always shows both languages. Uses only core Animated (works in Expo Go). No red or yellow.
// Screen width, used to place the floating cards.
const { width: W } = Dimensions.get("window");
const HOLD_MS = 700; // pause on the finished logo before moving on
// Splash has its own fixed colors (not from utils/theme.js) because it is a special dark intro screen.
const BG = "#062F3A";

// Floating cards: icon, color, and start position (x = fraction of screen width, y = pixels from center).
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
  // Refs (do not cause re-render): done = already navigated, skip = user tapped, target = where to go next, animDone = animation finished.
  const done = useRef(false);
  const skip = useRef(false);
  const target = useRef(null);
  const animDone = useRef(false);

  // Animated values: enter = each card appears; spin/bob/glow = looping effects; merge = cards fly into center; logo/shine = logo show; tagTa/tagEn = Tamil and English taglines.
  const enter = useRef(CARDS.map(() => new Animated.Value(0))).current;
  const spin = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const merge = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const tagTa = useRef(new Animated.Value(0)).current;
  const tagEn = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  // Navigation gate. Called from 3 places (animation end, session check end, tap). It navigates only once, and only when the target is known and the animation is done or skipped.
  const go = () => {
    if (done.current || !target.current) return;
    if (!animDone.current && !skip.current) return; // wait for the full animation unless the user taps to skip
    done.current = true;
    navigation.replace(target.current.name, target.current.params);
  };

  // Effect (runs once): start the animations and, in parallel, check the saved login session.
  useEffect(() => {
    // Endless loops: card spin, up-down bobbing, background glow.
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

    // One-time timeline: cards appear -> merge to center -> logo pops -> shine and taglines show.
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
    // When the timeline ends, wait HOLD_MS, then mark animation done and try to navigate.
    timeline.start(({ finished }) => {
      if (!finished) return;
      timer = setTimeout(() => { animDone.current = true; go(); }, HOLD_MS);
    });

    // Session check: decides the next screen. Any error means go to Login.
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

    // Cleanup when screen closes: stop timer and animations.
    return () => {
      clearTimeout(timer);
      loops.forEach((l) => l.stop());
      timeline.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler: tap anywhere to skip the animation.
  const onSkip = () => {
    skip.current = true;
    go(); // if the login check is still running, it navigates as soon as it finishes
  };

  // Interpolations: convert 0..1 animated values into degrees, pixels, scale and opacity used in the render below.
  const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const rotateYSlow = spin.interpolate({ inputRange: [0, 1], outputRange: ["20deg", "-340deg"] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });
  const logoScale = logo.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-160, 160] });

  // Constant list for rendering the cards.
  const cards = useMemo(() => CARDS, []);

  // Render: background blobs, card stage (cards + logo), then the taglines. Whole screen is Pressable for skip.
  return (
    <Pressable style={styles.container} onPress={onSkip}>
      {/* Soft glowing background blobs */}
      <Animated.View style={[styles.blob, { backgroundColor: "#0C6478", top: -90, left: -90, opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[styles.blob, { backgroundColor: "#7B4BC0", bottom: -110, right: -100, opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[styles.blobSmall, { backgroundColor: "#2E7D4F", bottom: 120, left: -60, opacity: glowOpacity }]} />

      {/* Stage: floating cards that merge into the logo */}
      <View style={styles.stage}>
        {/* One floating card per CARDS item */}
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

        {/* Logo box (Tamil name + Quiz-IN + shine line) */}
        <Animated.View style={[styles.logoWrap, { opacity: logo, transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoBox}>
            <Text style={styles.logoTamil}>வினாடி வினா</Text>
            <Text style={styles.logoText}>Quiz-IN</Text>
            <Animated.View style={[styles.shine, { transform: [{ translateX: shineX }, { rotate: "18deg" }] }]} />
          </View>
        </Animated.View>
      </View>

      {/* Taglines in Tamil and English (always both languages) */}
      <View style={styles.taglines}>
        <Animated.Text style={[styles.tagTa, { opacity: tagTa }]}>கேள். கற்றுக்கொள். வெல்!</Animated.Text>
        <Animated.Text style={[styles.tagEn, { opacity: tagEn }]}>Ask. Learn. Win!</Animated.Text>
      </View>
    </Pressable>
  );
}

// Styles.
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
