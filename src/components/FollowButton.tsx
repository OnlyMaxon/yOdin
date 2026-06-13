import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { followUser, unfollowUser } from '../services/userService';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

interface Props {
  targetUid: string;
  large?: boolean;
}

export default function FollowButton({ targetUid, large }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [busy, setBusy] = useState(false);

  // Never show a follow button for yourself (or when signed out).
  if (!profile || profile.uid === targetUid) return null;

  const following = profile.following?.includes(targetUid) ?? false;

  async function toggle() {
    if (busy || !profile) return;
    setBusy(true);
    const prev = profile.following ?? [];
    const next = following ? prev.filter((id) => id !== targetUid) : [...prev, targetUid];
    setProfile({ ...profile, following: next });
    try {
      if (following) await unfollowUser(profile.uid, targetUid);
      else await followUser(profile.uid, targetUid);
    } catch {
      setProfile({ ...profile, following: prev }); // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <TouchableOpacity
      style={[
        large ? styles.btnLarge : styles.btn,
        following ? styles.btnFollowing : styles.btnFollow,
      ]}
      onPress={toggle}
      disabled={busy}
      activeOpacity={0.85}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={following ? colors.textSecondary : '#fff'} />
      ) : (
        <Text style={[styles.txt, following ? styles.txtFollowing : styles.txtFollow]}>
          {following ? t('profile.following') : t('profile.follow')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    btn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 84,
    },
    btnLarge: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 140,
    },
    btnFollow: { backgroundColor: c.primary },
    btnFollowing: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: c.border,
    },
    txt: { fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightSemiBold },
    txtFollow: { color: '#fff' },
    txtFollowing: { color: c.textSecondary },
  });
}