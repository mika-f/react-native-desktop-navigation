import type { NavigationStore } from './store';
import type { ParamListBase, NavigationAction } from '../routers';
import type {
  StackNavigation,
  SidebarNavigation,
  TabNavigation,
  NavigationRef,
} from './types';
export type AnyNavigation<P extends ParamListBase = ParamListBase> =
  StackNavigation<P> & SidebarNavigation<P> & TabNavigation<P>;
export function createNavigation<P extends ParamListBase = ParamListBase>(
  store: NavigationStore,
  id: string,
  routeKey?: string,
): AnyNavigation<P> {
  const dispatch = (action: NavigationAction) => {
    store.dispatch({ ...action, target: action.target ?? id });
  };
  const routeAction =
    (type: 'navigate' | 'push' | 'replace' | 'popTo') =>
    (...[name, params]: [string, unknown?]) =>
      dispatch({ type, payload: { name, params } });
  return {
    navigate: routeAction('navigate'),
    push: routeAction('push'),
    replace: routeAction('replace'),
    popTo: routeAction('popTo'),
    dispatch,
    goBack: () => dispatch({ type: 'back' }),
    goForward: () => dispatch({ type: 'forward' }),
    canGoBack: () => store.canDispatch('back', id),
    canGoForward: () => store.canDispatch('forward', id),
    pop: (count) => dispatch({ type: 'pop', payload: { count } }),
    popToRoot: () => dispatch({ type: 'popToRoot' }),
    select: (name) => dispatch({ type: 'select', payload: { name } }),
    collapseSidebar: () => dispatch({ type: 'collapseSidebar' }),
    expandSidebar: () => dispatch({ type: 'expandSidebar' }),
    toggleSidebar: () => dispatch({ type: 'toggleSidebar' }),
    nextTab: () => dispatch({ type: 'nextTab' }),
    previousTab: () => dispatch({ type: 'previousTab' }),
    getState: () => {
      const node = store.getNode(id);
      if (!node) throw new Error('Navigator is not mounted.');
      return node.state;
    },
    getParent: () => {
      const node = store.getNode(id);
      return node?.parentId
        ? createNavigation(store, node.parentId, node.parentRouteKey)
        : undefined;
    },
    isFocused: () =>
      routeKey ? store.isRouteFocused(id, routeKey) : store.isNodeFocused(id),
    addListener: (type, listener) =>
      store.addListener(
        routeKey ?? store.getNode(id)?.state.activeRouteKey ?? id,
        type,
        listener,
      ),
  };
}
export function createNavigationRef<
  P extends ParamListBase = ParamListBase,
>(): NavigationRef<P> {
  const ref: NavigationRef<P> = {
    current: null,
    isReady: () => ref.current?.isReady() ?? false,
    navigate: (...args) => ref.current?.navigate(...args),
    goBack: () => ref.current?.goBack(),
    goForward: () => ref.current?.goForward(),
    canGoBack: () => ref.current?.canGoBack() ?? false,
    canGoForward: () => ref.current?.canGoForward() ?? false,
    dispatch: (action) => ref.current?.dispatch(action),
    getRootState: () => ref.current?.getRootState(),
  };
  return ref;
}
