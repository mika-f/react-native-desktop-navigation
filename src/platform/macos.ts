import { isTextInputEvent, type NavigationPlatformAdapter } from './index';
export const macosAdapter: NavigationPlatformAdapter = {
  defaultTransitions: {
    push: { duration: 160, offset: 12 },
    pop: { duration: 120, offset: -12 },
  },
  keyboardShortcuts: {
    back: [{ key: '[', metaKey: true }],
    forward: [{ key: ']', metaKey: true }],
    nextTab: [{ key: 'Tab', ctrlKey: true }],
    previousTab: [{ key: 'Tab', ctrlKey: true, shiftKey: true }],
  },
  sidebar: { defaultWidth: 220 },
  isTextInputEvent,
};
