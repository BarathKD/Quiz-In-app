// components/PressableScale.js - button wrapper that shrinks a little when pressed.
// PROPS: onPress, disabled, style (applied to the inner animated view, so put background/padding here), children. Any other props go to Pressable.
// Used for buttons and cards in many screens (login, daily challenge, MenuRow, ProgressRow).
import React, { useRef } from "react";
import { Animated, Pressable } from "react-native";

// A button/card that shrinks slightly while pressed. Put the visual style
// (background, padding, border) in `style`; it is applied to the animated view.
export default function PressableScale({ onPress, disabled, style, children, ...rest }) {
  // Current scale (1 = normal size).
  const scale = useRef(new Animated.Value(1)).current;

  // Helper: smooth spring animation to a new scale.
  const animateTo = (value) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  // Render: Pressable handles touch; press in -> scale 0.97, press out -> back to 1.
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
