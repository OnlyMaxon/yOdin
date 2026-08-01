import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
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
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorPalette, bottomInset: number) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: Math.max(bottomInset, 12) + 8,
      paddingTop: 10,
      maxHeight: '80%',
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: 8 },
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
