import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Text from './AppText';
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

// 'files' opens the system document chooser. The grid below it is built from
// MediaStore, which only indexes the gallery -- anything in Downloads, Drive,
// Telegram or another app's provider is invisible to it, so it needs its own
// entry point rather than being merged into the grid.
type GridItem = 'camera' | 'files' | MediaLibrary.Asset;

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PickedAsset[]>([]);

  useEffect(() => {
    if (!visible) return;
    setSelected([]);
    setAssets([]);
    setCursor(undefined);
    setHasMore(true);
    setLoadError(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (permission === null) return; // status not loaded yet
    if (!permission.granted) {
      if (permission.canAskAgain) requestPermission();
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
      setLoadError(null);
    } catch (e) {
      // Without this the grid just stayed empty and looked like "the picker is
      // broken" -- the reason has to reach the user, and the device, to be
      // diagnosable at all.
      setLoadError(e instanceof Error ? e.message : String(e));
      setHasMore(false);
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

  async function openFiles() {
    try {
      // `legacy` swaps the Android photo picker for an ACTION_GET_CONTENT
      // chooser, which is the only one that reaches Downloads and other apps'
      // providers. It needs no storage permission: the chooser hands back a
      // content:// URI the app is granted access to for that file alone.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        legacy: true,
        allowsMultipleSelection: maxSelect > 1,
        selectionLimit: maxSelect,
      });
      if (result.canceled || !result.assets?.length) return;
      onDone(
        result.assets
          .slice(0, maxSelect)
          .map(a => ({ uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 })),
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }

  function renderItem({ item, index }: { item: GridItem; index: number }) {
    if (item === 'camera') {
      return (
        <TouchableOpacity style={[styles.cell, styles.cameraCell]} onPress={openCamera} activeOpacity={0.8}>
          <Ionicons name="camera-outline" size={30} color={colors.secondaryText} />
        </TouchableOpacity>
      );
    }

    if (item === 'files') {
      return (
        <TouchableOpacity style={[styles.cell, styles.cameraCell]} onPress={openFiles} activeOpacity={0.8}>
          <Ionicons name="folder-open-outline" size={28} color={colors.secondaryText} />
        </TouchableOpacity>
      );
    }

    const isPicked = isPickedUri(item.uri);
    const pickedIndex = selected.findIndex(a => a.uri === item.uri);
    const atLimit = !isPicked && selected.length >= maxSelect;

    return (
      <TouchableOpacity
        style={styles.cell}
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

  const data: GridItem[] = ['camera', 'files', ...assets];

  const permanentlyDenied = !!permission && !permission.granted && !permission.canAskAgain;
  const notice = loadError
    ? { title: t('errors.generic'), detail: loadError }
    : permanentlyDenied
      ? { title: t('errors.galleryPermission'), detail: '' }
      : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent navigationBarTranslucent>
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

        {/* The grid always renders: the camera and files tiles work without the
            gallery permission, so replacing the whole list with a notice would
            strand a user who denied it. The notice sits above the tiles. */}
        <FlatList
          data={data}
          keyExtractor={(item) => (typeof item === 'string' ? `__${item}__` : item.id)}
          renderItem={renderItem}
          numColumns={COLS}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            notice ? (
              <View style={styles.notice}>
                <Ionicons
                  name={loadError ? 'alert-circle-outline' : 'images-outline'}
                  size={20}
                  color={loadError ? colors.notification : colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.permText}>{notice.title}</Text>
                  {notice.detail ? <Text style={styles.errDetail}>{notice.detail}</Text> : null}
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={loading ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} /> : null}
        />
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
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: GAP,
      borderRadius: 12,
      backgroundColor: c.primaryLight,
    },
    permText: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
    },
    // The underlying failure, shown small: a picker that fails without saying
    // why is indistinguishable from a picker with no photos in it.
    errDetail: {
      fontSize: Typography.fontSizeXS,
      color: c.textSecondary,
      marginTop: 4,
      opacity: 0.8,
    },
    row: { gap: GAP },
    cell: { width: CELL, height: CELL, overflow: 'hidden' },
    cameraCell: {
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellImg: { width: CELL, height: CELL },
    selectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(108,53,222,0.28)',
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
