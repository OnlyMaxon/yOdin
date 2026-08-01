import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../store/useToastStore';
import { Typography } from '../theme/typography';

const VISIBLE_MS = 2200;

// Single global toast rendered at the app root. Fades + slides up when a message
// is set, auto-dismisses after a couple seconds. Non-interactive (pointerEvents
// none) so it never blocks taps underneath.
export default function Toast() {
  const message = useToastStore((s) => s.message);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    translateY.setValue(24);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 24, duration: 260, useNativeDriver: true }),
      ]).start(() => hide());
    }, VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [message, opacity, translateY, hide]);

  if (!message) return null;

  return (
    <View pointerEvents="none" style={[styles.container, { bottom: insets.bottom + 96 }]}>
      <Animated.View style={[styles.pill, { opacity, transform: [{ translateY }] }]}>
        <Ionicons name="checkmark-circle" size={18} color="#fff" />
        <Text style={styles.text} numberOfLines={2}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(20,18,40,0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  text: {
    color: '#fff',
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightSemiBold,
    flexShrink: 1,
  },
});
