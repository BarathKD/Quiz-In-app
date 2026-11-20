import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

// Fades a block in while it rises 14px. Give each list row its index so
// rows appear one after another. Uses the native driver (opacity + transform
// only), so it stays smooth on low-end Android phones.
export default function FadeInUp({ index = 0, delay = 70, style, children }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index, 8) * delay,
      useNativeDriver: true,
    }).start();
  }, [progress, index, delay]);

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
