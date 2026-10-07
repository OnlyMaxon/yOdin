import { useRef, MutableRefObject, useMemo } from 'react';
import { Animated, Keyboard } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

// Drag a bottom sheet down to dismiss it. Pass the same Animated.Value the
// sheet already uses for its slide-in and the gesture drives it directly, so
// the sheet follows the finger and springs back from wherever it was released.
//
// Drag this far, or flick faster than this, and the sheet closes. The flick
// counts on its own so a short, fast gesture works without dragging all the way.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 700; // px/s -- gesture-handler reports velocity in px/s

// How far a finger must travel down before the drag takes over, and how far
// sideways before it is abandoned. Together these let a vertical pull win while
// a horizontal swipe still reaches the tab pager behind the sheet.
const ACTIVATE_DY = 10;
const CANCEL_DX = 20;

/**
 * Built on react-native-gesture-handler rather than PanResponder: the sheets
 * live inside a react-native Modal, which on Android is its own window, and the
 * responder system did not deliver the drag there at all.
 *
 * The returned gesture must be attached with <GestureDetector>, and the modal's
 * content wrapped in its own <GestureHandlerRootView> -- a Modal sits outside
 * the app-level root in App.tsx, so without one no gesture inside it can work.
 *
 * @param slideAnim  the sheet's translateY value
 * @param onClose    called once the gesture passes the dismiss threshold
 */
export function useSheetDrag(slideAnim: Animated.Value, onClose: () => void) {
  // Read through a ref: the gesture is built once and would otherwise close
  // over the first render's onClose forever.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  return useMemo(() => {
    function settleBack() {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }

    return Gesture.Pan()
      // Callbacks touch Animated and React state, so they belong on the JS
      // thread; nothing here is a worklet.
      .runOnJS(true)
      .activeOffsetY(ACTIVATE_DY)
      .failOffsetX([-CANCEL_DX, CANCEL_DX])
      .onUpdate((e) => {
        // Downwards only -- dragging up must not lift the sheet off its edge.
        if (e.translationY > 0) slideAnim.setValue(e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
          Keyboard.dismiss();
          onCloseRef.current();
        } else {
          settleBack();
        }
      });
    // slideAnim is a stable ref value and never changes identity.
  }, [slideAnim]);
}
