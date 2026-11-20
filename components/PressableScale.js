import React, { useRef } from "react";
import { Animated, Pressable } from "react-native";

// A button/card that shrinks slightly while pressed. Put the visual style
// (background, padding, border) in `style`; it is applied to the animated view.
export default function PressableScale({ onPress, disabled, style, children, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

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
