import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const EYE_SIZE = 50;
const PUPIL_SIZE = 19;
const MAX_OFFSET = EYE_SIZE / 2 - PUPIL_SIZE / 2 - 5;

// Predefined positions the pupil visits in order
const WAYPOINTS = [
  { x: 0,              y: 0 },
  { x: MAX_OFFSET,     y: 2 },
  { x: MAX_OFFSET * 0.6,  y: -MAX_OFFSET * 0.8 },
  { x: -MAX_OFFSET * 0.4, y: -MAX_OFFSET },
  { x: -MAX_OFFSET,    y: 0 },
  { x: -MAX_OFFSET * 0.5, y: MAX_OFFSET * 0.7 },
  { x: MAX_OFFSET * 0.3,  y: MAX_OFFSET * 0.9 },
  { x: 0,              y: 0 },
];

export default function WanderingEye() {
  const pupilX    = useRef(new Animated.Value(0)).current;
  const pupilY    = useRef(new Animated.Value(0)).current;
  const eyeScaleY = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let idx = 0;

    function step() {
      if (!active) return;
      idx = (idx + 1) % WAYPOINTS.length;
      const { x, y } = WAYPOINTS[idx];
      const blink = Math.random() < 0.55;
      const moveDuration = 220 + Math.random() * 180;

      const move = Animated.parallel([
        Animated.timing(pupilX, {
          toValue: x,
          duration: moveDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pupilY, {
          toValue: y,
          duration: moveDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

      const sequence = blink
        ? Animated.sequence([
            move,
            Animated.timing(eyeScaleY, { toValue: 0.07, duration: 70,  useNativeDriver: true }),
            Animated.timing(eyeScaleY, { toValue: 1,    duration: 100, useNativeDriver: true }),
          ])
        : move;

      sequence.start(() => {
        if (active) timer = setTimeout(step, 60 + Math.random() * 140);
      });
    }

    step();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <Animated.View style={[styles.eye, { transform: [{ scaleY: eyeScaleY }] }]}>
      <Animated.View
        style={[styles.pupil, { transform: [{ translateX: pupilX }, { translateY: pupilY }] }]}
      >
        <View style={styles.highlight} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  eye: {
    width: EYE_SIZE,
    height: EYE_SIZE,
    borderRadius: EYE_SIZE / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  pupil: {
    width: PUPIL_SIZE,
    height: PUPIL_SIZE,
    borderRadius: PUPIL_SIZE / 2,
    backgroundColor: '#1A0060',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  highlight: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.65)',
    top: 3,
    left: 4,
  },
});
