// components/FadeInUp.js - animation wrapper: children fade in and move up a little.
// PROPS: index (list position; later rows start later, max 8 steps), delay (ms per step), style (style of the wrapper view), children.
// Used in many screens around cards and list rows.
import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

// Fades a block in while it rises 14px. Give each list row its index so
// rows appear one after another. Uses the native driver (opacity + transform
// only), so it stays smooth on low-end Android phones.
export default function FadeInUp({ index = 0, delay = 70, style, children }) {
  // Animation value 0 -> 1.
  const progress = useRef(new Animated.Value(0)).current;

  // Effect: start the animation when the component appears. The delay grows with index but is capped at index 8, so long lists do not wait too long.
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index, 8) * delay,
      useNativeDriver: true,
    }).start();
  }, [progress, index, delay]);

  // Render: opacity and translateY are both driven by progress.
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
