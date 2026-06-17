import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Image,
  TextInput,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import { COUNTRIES } from '../data/countries';

const SCREEN_W = Dimensions.get('window').width;
const DRAWER_W = Math.min(Math.round(SCREEN_W * 0.82), 340);

interface Props {
  visible: boolean;
  onClose: () => void;
  // Currently selected nationalities (country names). Empty = all.
  selected: string[];
  // Toggle a single nationality in/out of the selection.
  onToggle: (nationality: string) => void;
  // Clear the selection (back to "all nationalities").
  onClear: () => void;
  // The viewer's own nationality is pinned to the top for quick access.
  myNationality?: string;
}

export default function NationFilterDrawer({ visible, onClose, selected, onToggle, onClear, myNationality }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top, insets.bottom);

  const [render, setRender] = useState(visible);
  const [search, setSearch] = useState('');
  const anim = useRef(new Animated.Value(0)).current; // 0 closed → 1 open

  useEffect(() => {
    if (visible) {
      setRender(true);
      setSearch('');
      Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(
        ({ finished }) => finished && setRender(false),
      );
    }
  }, [visible]);

  if (!render) return null;

  // Own nationality first, then the rest alphabetically — filtered by search.
  const q = search.trim().toLowerCase();
  const list = COUNTRIES
    .filter((c) => c.name.toLowerCase().includes(q))
    .sort((a, b) => {
      if (a.name === myNationality) return -1;
      if (b.name === myNationality) return 1;
      return a.name.localeCompare(b.name);
    });

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_W, 0] });

  return (
    <Modal visible={render} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: anim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
          <View style={styles.header}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} />
            <Text style={styles.appName}>yOdin</Text>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('auth.search')}
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={list}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <TouchableOpacity
                style={[styles.item, selected.length === 0 && styles.itemActive]}
                onPress={onClear}
                activeOpacity={0.7}
              >
                <Text style={styles.flag}>🌍</Text>
                <Text style={[styles.name, selected.length === 0 && styles.nameActive]}>
                  {t('feed.allNations')}
                </Text>
                {selected.length === 0 && <Ionicons name="checkmark" size={18} color={colors.primary} style={styles.check} />}
              </TouchableOpacity>
            }
            renderItem={({ item }) => {
              const active = selected.includes(item.name);
              return (
                <TouchableOpacity
                  style={[styles.item, active && styles.itemActive]}
                  onPress={() => onToggle(item.name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Ionicons
                    name={active ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={active ? colors.primary : colors.textSecondary}
                    style={styles.check}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorPalette, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    root: { flex: 1 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    drawer: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: DRAWER_W,
      backgroundColor: c.surface,
      paddingTop: topInset + 8,
      paddingBottom: bottomInset,
      shadowColor: '#000',
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    logo: { width: 36, height: 36, borderRadius: 9 },
    appName: {
      fontSize: Typography.fontSizeXL,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginVertical: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: c.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: {
      flex: 1,
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      padding: 0,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 13,
    },
    itemActive: { backgroundColor: c.primaryLight },
    flag: { fontSize: 22 },
    name: { flex: 1, fontSize: Typography.fontSizeMD, color: c.textPrimary },
    nameActive: { color: c.primary, fontWeight: Typography.fontWeightSemiBold },
    check: { marginLeft: 'auto' },
  });
}