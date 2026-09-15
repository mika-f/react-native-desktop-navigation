import React from 'react';
import { Platform, TextInput, View, type ViewProps } from 'react-native';
import { macosAdapter } from './macos';
import { windowsAdapter } from './windows';
export interface KeyboardShortcut {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}
export interface DesktopKeyEvent {
  nativeEvent: KeyboardShortcut & {
    handled?: boolean;
    isTextInput?: boolean;
    target?: unknown;
  };
  defaultPrevented?: boolean;
  isPropagationStopped?: () => boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}
export interface TransitionPreset {
  duration: number;
  offset: number;
}
export interface NavigationPlatformAdapter {
  defaultTransitions: { push: TransitionPreset; pop: TransitionPreset };
  keyboardShortcuts: {
    back: KeyboardShortcut[];
    forward: KeyboardShortcut[];
    nextTab: KeyboardShortcut[];
    previousTab: KeyboardShortcut[];
  };
  sidebar: { defaultWidth: number };
  isTextInputEvent(event: DesktopKeyEvent): boolean;
}
export const defaultPlatformAdapter =
  Platform.OS === 'windows' ? windowsAdapter : macosAdapter;
export function isTextInputEvent(event: DesktopKeyEvent) {
  return (
    event.nativeEvent.isTextInput === true ||
    TextInput.State.currentlyFocusedInput() != null
  );
}
export function matchesShortcut(
  event: DesktopKeyEvent,
  shortcut: KeyboardShortcut,
) {
  return (
    event.nativeEvent.key === shortcut.key &&
    (['metaKey', 'ctrlKey', 'altKey', 'shiftKey'] as const).every(
      (key) => !!event.nativeEvent[key] === !!shortcut[key],
    )
  );
}
export const eventHandled = (event: DesktopKeyEvent) =>
  !!(
    event.defaultPrevented ||
    event.nativeEvent.handled ||
    event.isPropagationStopped?.()
  );
export function consumeKey(event: DesktopKeyEvent) {
  event.preventDefault?.();
  event.stopPropagation?.();
}
export interface DesktopViewProps extends ViewProps {
  onKeyDown?: (event: DesktopKeyEvent) => void;
  keyDownEvents?: KeyboardShortcut[];
  onFocus?: () => void;
  focusable?: boolean;
}
// RN desktop adds these native View props. Keep the platform type extension in one place.
export const DesktopView = View as unknown as React.ComponentType<
  DesktopViewProps & React.RefAttributes<View>
>;
