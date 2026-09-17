import { StyleSheet } from 'react-native';

/**
 * Hides inactive content while keeping it mounted in the native view tree.
 *
 * Fabric does not mount `display: 'none'` subtrees. React Native Windows'
 * NativeAnimated retries a native-driven animation whose view is not mounted
 * on every UI batch without backing off, so a hidden scene containing one
 * (e.g. a ScrollView with `stickyHeaderIndices`) starves the UI thread and
 * freezes the app. Taking the content out of flow and making it transparent
 * avoids unmounting while still occupying no layout space.
 */
export const hiddenStyle = StyleSheet.create({
  hidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    zIndex: -1,
  },
}).hidden;
