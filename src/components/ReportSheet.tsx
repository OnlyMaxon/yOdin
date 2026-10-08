import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSheetDrag } from '../hooks/useSheetDrag';
import Text from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import { REPORT_REASONS, ReportReason } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  // Tapping a reason immediately files the report (Instagram-style one tap).
  onSubmit: (reason: ReportReason) => void;
}

// Bottom-sheet list of report reasons, shown for any reportable item (post,
// question, comment, reply).
export default function ReportSheet({ visible, onClose, onSubmit }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.bottom);
  // The Modal animates the sheet in and out by itself; this value exists only
  // so the drag can move it, and is reset each time the sheet reopens.
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragGesture = useSheetDrag(slideAnim, onClose);

  useEffect(() => {
    if (visible) slideAnim.setValue(0);
  }, [visible, slideAnim]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Grab strip: the drag lives here only, so it can never contend with
              the reason list below it. */}
          <GestureDetector gesture={dragGesture}>
            <View style={styles.grabRow}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>
          <View style={styles.header}>
            <Text style={styles.title}>{t('report.title')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{t('report.subtitle')}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => onSubmit(reason)}
              >
                <Text style={styles.rowText}>{t(`report.reasons.${reason}`)}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function makeStyles(c: ColorPalette, bottomInset: number) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: Math.max(bottomInset, 12) + 8,
      paddingTop: 10,
      maxHeight: '80%',
    },
    grabRow: { height: 44, alignItems: 'center', justifyContent: 'center' },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 6,
    },
    title: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.textPrimary },
    subtitle: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    rowText: { fontSize: Typography.fontSizeMD, color: c.textPrimary, flex: 1 },
  });
}
