// Same context, Store, Router and hooks as the JS-rendered navigators.
export {
  NavigationContainer,
  type NavigationContainerProps,
  type KeyboardShortcutOptions,
} from '../core/NavigationContainer';
export { createNavigationRef } from '../core/navigation';
export {
  useNavigation,
  useRoute,
  useNavigationState,
  useFocusEffect,
  useIsFocused,
} from '../core/hooks';
export { NavigationFocusable, type FocusTarget } from '../core/focus';
export { DefaultTheme, useNavigationTheme } from '../core/context';
export {
  NavigationStore,
  serializeNavigationState,
  restoreNavigationState,
  type NavigationEvent,
  type NavigationEventType,
} from '../core/store';
export * from '../routers';
export type {
  Navigation,
  StackNavigation,
  SidebarNavigation,
  StackScreenProps,
  SidebarScreenProps,
  SidebarFooterProps,
  NavigationTheme,
  NavigationRef,
} from '../core/types';
export {
  createStackNavigator,
  type NativeStackNavigatorProps,
  type NativeStackScreenOptions,
} from './stack';
export {
  createSidebarNavigator,
  type NativeSidebarNavigatorProps,
  type NativeSidebarScreenOptions,
} from './sidebar';
export {
  createSplitNavigator,
  type NativeSplitNavigatorProps,
  type NativeSplitColumnProps,
} from './split';
export type { NativeAppearance } from './host';

export type {
  NativeSidebarIcon,
  NativeSidebarIconOption,
  NativeSidebarIconState,
} from './icons';
