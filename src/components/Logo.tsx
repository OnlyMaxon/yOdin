import React from 'react';
import { View, StyleSheet } from 'react-native';
import Text from './AppText';
import WanderingEye from './WanderingEye';
import { Typography } from '../theme/typography';

type Props = {
  size?: number;
  color?: string;
};

export default function Logo({ size = 60, color = '#fff' }: Props) {
  const eyeScale = size / 60;

  return (
    <View style={styles.row}>
      <Text style={[styles.text, { fontSize: size, lineHeight: size * 1.13, color }]}>y</Text>
      <View style={{ transform: [{ scale: eyeScale }] }}>
        <WanderingEye />
      </View>
      <Text style={[styles.text, { fontSize: size, lineHeight: size * 1.13, color }]}>din</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontWeight: Typography.fontWeightBold,
    letterSpacing: -1.5,
  },
});
