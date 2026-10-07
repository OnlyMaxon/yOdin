import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import TextInput from './AppTextInput';
import Text from './AppText';
import AppImage from './AppImage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Gif, searchGifs, isGifSearchAvailable } from '../services/gifService';

interface Props {
  visible: boolean;
  onPick: (gif: Gif) => void;
  onClose: () => void;
}

const SCREEN_W = Dimensions.get('window').width;
const COLS = 2;
const GAP = 6;
const CELL = Math.floor((SCREEN_W - GAP * (COLS + 1)) / COLS);

// A free GIPHY key allows 100 calls an hour across the whole app, so the query
// waits for a pause in typing rather than firing on every keystroke.
const DEBOUNCE_MS = 400;

export default function GifPicker({ visible, onPick, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top, insets.bottom);

  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const results = await searchGifs(query);
      // The query may have moved on while this request was in flight.
      if (cancelled) return;
      setGifs(results);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancelText}>{t('newPost.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>GIF</Text>
          {/* GIPHY's terms require this mark wherever their results are shown. */}
          <Text style={styles.attribution}>Powered by GIPHY</Text>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.search}
            placeholder={t('auth.search')}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoFocus
          />
        </View>

        {!isGifSearchAvailable() ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={44} color={colors.textSecondary} />
            <Text style={styles.emptyText}>EXPO_PUBLIC_GIPHY_API_KEY</Text>
          </View>
        ) : (
          <FlatList
            data={gifs}
            keyExtractor={(g) => g.id}
            numColumns={COLS}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.85} onPress={() => onPick(item)}>
                <AppImage source={{ uri: item.preview }} style={styles.cell} contentFit="cover" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
              ) : (
                <Text style={styles.emptyText}>—</Text>
              )
            }
          />
        )}
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorPalette, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, paddingTop: topInset },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    cancelText: { fontSize: Typography.fontSizeMD, color: c.textSecondary },
    title: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightBold, color: c.textPrimary },
    attribution: { fontSize: Typography.fontSizeXS, color: c.textSecondary },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.muted,
      borderWidth: 1,
      borderColor: c.border,
    },
    search: { flex: 1, paddingVertical: 10, fontSize: Typography.fontSizeMD, color: c.textPrimary },
    grid: { padding: GAP, paddingBottom: bottomInset + GAP },
    row: { gap: GAP },
    cell: { width: CELL, height: CELL, borderRadius: 10, marginBottom: GAP, backgroundColor: c.muted },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    emptyText: { fontSize: Typography.fontSizeSM, color: c.textSecondary, textAlign: 'center', marginTop: 24 },
  });
}
