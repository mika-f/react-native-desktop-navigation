import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { NavigationStore } from './store';
import {
  DefaultTheme,
  PlatformContext,
  ScopeContext,
  StoreContext,
  ThemeContext,
} from './context';
import type { NavigationRefHandle, NavigationTheme } from './types';
import type { ParamListBase, RootNavigationState } from '../routers';
import {
  consumeKey,
  defaultPlatformAdapter,
  DesktopView,
  eventHandled,
  matchesShortcut,
  type KeyboardShortcut,
  type NavigationPlatformAdapter,
} from '../platform';
export interface KeyboardShortcutOptions {
  back?: KeyboardShortcut[];
  forward?: KeyboardShortcut[];
  nextTab?: KeyboardShortcut[];
  previousTab?: KeyboardShortcut[];
}
export interface NavigationContainerProps {
  children: React.ReactNode;
  initialState?: RootNavigationState;
  onStateChange?: (state: RootNavigationState) => void;
  keyboardShortcuts?: boolean | KeyboardShortcutOptions;
  platformAdapter?: NavigationPlatformAdapter;
  theme?: NavigationTheme;
  style?: StyleProp<ViewStyle>;
}
function Container(
  {
    children,
    initialState,
    onStateChange,
    keyboardShortcuts = true,
    platformAdapter = defaultPlatformAdapter,
    theme = DefaultTheme,
    style,
  }: NavigationContainerProps,
  ref: React.ForwardedRef<NavigationRefHandle<ParamListBase>>,
) {
  const [store] = React.useState(() => new NavigationStore(initialState));
  const callback = React.useRef(onStateChange);
  callback.current = onStateChange;
  React.useEffect(
    () =>
      store.subscribe(() => {
        if (store.isReady()) callback.current?.(store.getState());
      }),
    [store],
  );
  React.useImperativeHandle(
    ref,
    () => ({
      isReady: store.isReady,
      navigate: (name, params) => {
        if (store.isReady())
          store.dispatch({ type: 'navigate', payload: { name, params } });
      },
      dispatch: (action) => {
        if (store.isReady()) store.dispatch(action);
      },
      goBack: () => {
        if (store.isReady()) store.dispatch({ type: 'back' });
      },
      goForward: () => {
        if (store.isReady()) store.dispatch({ type: 'forward' });
      },
      canGoBack: () => store.isReady() && store.canDispatch('back'),
      canGoForward: () => store.isReady() && store.canDispatch('forward'),
      getRootState: store.getState,
    }),
    [store],
  );
  const shortcuts = {
    ...platformAdapter.keyboardShortcuts,
    ...(typeof keyboardShortcuts === 'object' ? keyboardShortcuts : {}),
  };
  return (
    <StoreContext.Provider value={store}>
      <ScopeContext.Provider value={{}}>
        <PlatformContext.Provider value={platformAdapter}>
          <ThemeContext.Provider value={theme}>
            <DesktopView
              style={[
                { flex: 1, backgroundColor: theme.colors.background },
                style,
              ]}
              focusable
              keyDownEvents={
                keyboardShortcuts ? Object.values(shortcuts).flat() : []
              }
              onKeyDown={(event) => {
                if (
                  !keyboardShortcuts ||
                  eventHandled(event) ||
                  platformAdapter.isTextInputEvent(event)
                )
                  return;
                for (const type of [
                  'back',
                  'forward',
                  'nextTab',
                  'previousTab',
                ] as const) {
                  if (
                    shortcuts[type].some((key) =>
                      matchesShortcut(event, key),
                    ) &&
                    store.dispatch({ type })
                  ) {
                    consumeKey(event);
                    break;
                  }
                }
              }}
            >
              {children}
            </DesktopView>
          </ThemeContext.Provider>
        </PlatformContext.Provider>
      </ScopeContext.Provider>
    </StoreContext.Provider>
  );
}
export const NavigationContainer = React.forwardRef(Container) as <
  P extends ParamListBase = ParamListBase,
>(
  props: NavigationContainerProps & { ref?: React.Ref<NavigationRefHandle<P>> },
) => React.ReactElement;
