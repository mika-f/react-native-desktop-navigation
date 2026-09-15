import React from 'react';
import { NavigatorStateContext } from './builder';
import { ScreenContext, ScopeContext, useStore } from './context';
import type { Navigation } from './types';
import type { NavigationRoute, NavigationState } from '../routers';
export function useNavigation<N = Navigation>(): N {
  const screen = React.useContext(ScreenContext);
  if (!screen) throw new Error('useNavigation must be used inside a Screen.');
  return screen.navigation as N;
}
export function useRoute<R extends NavigationRoute = NavigationRoute>(): R {
  const screen = React.useContext(ScreenContext);
  if (!screen) throw new Error('useRoute must be used inside a Screen.');
  return screen.route as R;
}
export function useNavigationState<T>(
  selector: (state: NavigationState) => T,
): T {
  const store = useStore();
  const { nodeId } = React.useContext(ScopeContext);
  const snapshot = React.useCallback(
    () => store.getNode(nodeId ?? store.getState().rootNodeId)?.state,
    [store, nodeId],
  );
  const state = React.useSyncExternalStore(store.subscribe, snapshot, snapshot);
  // Screen render can precede the navigator's layout-effect registration.
  const initial = React.useContext(NavigatorStateContext);
  const value = state ?? initial;
  if (!value)
    throw new Error('useNavigationState requires a registered navigator.');
  return selector(value);
}
export function useIsFocused() {
  const screen = React.useContext(ScreenContext);
  return screen?.focused ?? false;
}
export function useFocusEffect(effect: React.EffectCallback) {
  const focused = useIsFocused();
  React.useEffect(() => {
    if (focused) return effect();
  }, [focused, effect]);
}
