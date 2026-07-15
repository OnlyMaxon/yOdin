import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

export interface PickedAsset {
  uri: string;
  width: number;
  height: number;
}

interface Props {
  visible: boolean;
  maxSelect: number;
  onDone: (assets: PickedAsset[]) => void;
  onCancel: () => void;
}

const SCREEN_W = Dimensions.get('window').width;
const COLS = 3;
const GAP = 2;
const CELL = Math.floor((SCREEN_W - GAP * (COLS - 1)) / COLS);
const PAGE_SIZE = 60;

type GridItem = 'camera' | MediaLibrary.Asset;

export default function PhotoPickerSheet({ visible, maxSelect, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top, insets.bottom);

  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PickedAsset[]>([]);

  useEffect(() => {
    if (!visible) return;
    setSelected([]);
    setAssets([]);
    setCursor(undefined);
    setHasMore(true);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (!permission?.granted) {
      if (permission?.canAskAgain !== false) requestPermission();
      return;
    }
    loadPage(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, permission?.granted]);

  async function loadPage(after?: string, reset = false) {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: PAGE_SIZE,
        after,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      setAssets(prev => (after ? [...prev, ...result.assets] : result.assets));
      setCursor(result.endCursor);
      setHasMore(result.hasNextPage);
    } finally {
      setLoading(false);
    }
  }

  const loadMore = useCallback(() => {
    if (!loading && hasMore && cursor) loadPage(cursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasMore, cursor]);

  function isPickedUri(uri: string) {
    return selected.some(a => a.uri === uri);
  }

  function toggleSelect(asset: MediaLibrary.Asset) {
    setSelected(prev => {
      if (prev.some(a => a.uri === asset.uri)) {
        return prev.filter(a => a.uri !== asset.uri);
      }
      if (prev.length >= maxSelect) return prev;
      return [...prev, { uri: asset.uri, width: asset.width, height: asset.height }];
    });
  }

  async function openCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      onDone([{ uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 }]);
    }
  }

  function renderItem({ item, index }: { item: GridItem; index: number }) {
    if (item === 'camera') {
      return (
        <TouchableOpacity style={[styles.cell, styles.cameraCell]} onPress={openCamera} activeOpacity={0.8}>
          <Ionicons name="camera-outline" size={30} color={colors.primary} />
        </TouchableOpacity>
      );
    }

    const isPicked = isPickedUri(item.uri);
    const pickedIndex = selected.findIndex(a => a.uri === item.uri);
    const atLimit = !isPicked && selected.length >= maxSelect;
    const isRightEdge = (index + 1) % COLS === 0;

    return (
      <TouchableOpacity
        style={[styles.cell, !isRightEdge && styles.cellGap]}
        activeOpacity={0.85}
        onPress={() => !atLimit && toggleSelect(item)}
      >
        <Image source={{ uri: item.uri }} style={styles.cellImg} />
        {isPicked && <View style={styles.selectedOverlay} />}
        {isPicked && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pickedIndex + 1}</Text>
          </View>
        )}
        {atLimit && <View style={styles.dimOverlay} />}
      </TouchableOpacity>
    );
  }

  const data: GridItem[] = ['camera', ...assets];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerSide}>
            <Text style={styles.cancelText}>{t('newPost.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('newPost.selectPhotos')}</Text>
          <TouchableOpacity
            onPress={() => onDone(selected)}
            style={styles.headerSide}
            disabled={selected.length === 0}
          >
            <Text style={[styles.doneText, selected.length === 0 && styles.doneDisabled]}>
              {t('newPost.done')}{selected.length > 0 ? ` (${selected.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {permission && !permission.granted && !permission.canAskAgain ? (
          <View style={styles.center}>
            <Ionicons name="images-outline" size={52} color={colors.textSecondary} />
            <Text style={styles.permText}>{t('errors.galleryPermission')}</Text>
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => (item === 'camera' ? '__camera__' : item.id)}
            renderItem={renderItem}
            numColumns={COLS}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            columnWrapperStyle={styles.row}
            contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 16 }}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={loading ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} /> : null}
          />
        )}
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorPalette, topInset: number, _bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, paddingTop: topInset },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerSide: { minWidth: 64 },
    title: {
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textPrimary,
    },
    cancelText: {
      fontSize: Typography.fontSizeMD,
      color: c.textSecondary,
    },
    doneText: {
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.primary,
      textAlign: 'right',
    },
    doneDisabled: { color: c.textSecondary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    permText: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    row: { gap: GAP },
    cell: { width: CELL, height: CELL, overflow: 'hidden' },
    cellGap: { marginRight: 0 },
    cameraCell: {
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellImg: { width: CELL, height: CELL },
    selectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(111,66,193,0.28)',
    },
    dimOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255,255,255,0.5)',
    },
    badge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontSize: Typography.fontSizeXS,
      color: '#fff',
      fontWeight: Typography.fontWeightBold,
    },
  });
}
