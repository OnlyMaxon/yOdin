import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Text from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import Avatar from './Avatar';
import EmptyState from './EmptyState';
import { fetchUsersByIds } from '../services/userService';
import { getFlagEmoji } from '../utils/flagEmoji';
import { User } from '../types';

interface Props {
  visible: boolean;
  participantIds: string[];
  onClose: () => void;
  // Opens a participant's profile (parent closes this + the post modal first).
  onOpenProfile?: (userId: string) => void;
}

// WhatsApp-style attendee sheet: everyone who tapped "I'm going" on an event,
// tappable through to their profile.
export default function EventParticipantsModal({ visible, participantIds, onClose, onOpenProfile }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.bottom);
  const [users, setUsers] = useState<User[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setUsers(null);
    if (participantIds.length === 0) {
      setUsers([]);
      return;
    }
    fetchUsersByIds(participantIds)
      .then((u) => { if (active) setUsers(u); })
      .catch(() => { if (active) setUsers([]); });
    return () => { active = false; };
  }, [visible, participantIds.join(',')]);

  function renderRow({ item }: { item: User }) {
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={onOpenProfile ? 0.7 : 1}
        disabled={!onOpenProfile}
        onPress={() => onOpenProfile?.(item.uid)}
      >
        <Avatar photoURL={item.photoURL} name={`${item.firstName} ${item.lastName}`} size={48} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {getFlagEmoji(item.countryCode)}  {item.nationality}
          </Text>
        </View>
        {onOpenProfile ? <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} /> : null}
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>
              {t('participants.title')}{users ? `  ${users.length}` : ''}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {users === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.uid}
              renderItem={renderRow}
              contentContainerStyle={users.length === 0 ? styles.center : { paddingVertical: 8 }}
              ListEmptyComponent={
                <EmptyState icon="people-outline" text={t('participants.empty')} topOffset={20} />
              }
            />
          )}
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
      minHeight: '40%',
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: 8 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    title: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.textPrimary },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    info: { flex: 1 },
    name: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary },
    meta: { fontSize: Typography.fontSizeSM, color: c.textSecondary, marginTop: 2 },
  });
}
