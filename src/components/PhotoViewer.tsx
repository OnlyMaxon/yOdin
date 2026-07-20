import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppImage from './AppImage';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

// Fullscreen, swipeable photo viewer with a page counter.
export default function PhotoViewer({ visible, images, initialIndex = 0, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(initialIndex);

  // The component stays mounted while `visible` toggles, so reset the counter to
  // the requested index each time it opens (otherwise it shows the last page).
  useEffect(() => {
    if (visible) setPage(initialIndex);
  }, [visible, initialIndex]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <PagerView
          style={styles.pager}
          initialPage={initialIndex}
          onPageSelected={(e) => setPage(e.nativeEvent.position)}
        >
          {images.map((uri, i) => (
            <View key={`${uri}-${i}`} style={styles.page}>
              <AppImage source={{ uri }} style={styles.image} contentFit="contain" />
            </View>
          ))}
        </PagerView>

        {images.length > 1 && (
          <View style={[styles.counter, { top: insets.top + 12 }]}>
            <Text style={styles.counterText}>{page + 1} / {images.length}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' },
  pager: { flex: 1 },
  page: { width: SCREEN_W, height: SCREEN_H, alignItems: 'center', justifyContent: 'center' },
  image: { width: SCREEN_W, height: SCREEN_H },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  counterText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
