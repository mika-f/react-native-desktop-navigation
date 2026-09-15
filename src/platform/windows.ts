import { isTextInputEvent, type NavigationPlatformAdapter } from './index';
export const windowsAdapter: NavigationPlatformAdapter = {
  defaultTransitions: {
    push: { duration: 160, offset: 16 },
    pop: { duration: 120, offset: -16 },
  },
  keyboardShortcuts: {
    back: [{ key: 'ArrowLeft', altKey: true }],
    forward: [{ key: 'ArrowRight', altKey: true }],
    nextTab: [{ key: 'Tab', ctrlKey: true }],
    previousTab: [{ key: 'Tab', ctrlKey: true, shiftKey: true }],
  },
  sidebar: { defaultWidth: 240 },
  isTextInputEvent,
};
