import React from 'react';
import { View, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../theme/spacing';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// Standard content surface: white card, generous radius, soft brand-tinted
// elevation. Pass onPress to make the whole card tappable. Shared so Feed /
// Forum / Profile stop drifting apart.
export default function Card({ children, onPress, style }: Props) {
  const { colors } = useTheme();
  const cardStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 18,
      elevation: 3,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}
