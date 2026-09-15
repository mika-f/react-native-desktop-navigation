import React from 'react';
import {
  routers,
  type NavigationState,
  type Router,
  type RouterOptions,
  type ParamListBase,
  type RouteName,
  type NavigationRoute,
} from '../routers';
import { ScopeContext, useStore } from './context';
import { createNavigation, type AnyNavigation } from './navigation';
export const NavigatorStateContext =
  React.createContext<NavigationState | null>(null);
export interface ScreenConfig<
  P extends ParamListBase,
  N extends RouteName<P>,
  O,
  Nav = AnyNavigation<P>,
> {
  name: N;
  component: React.ComponentType<{
    navigation: Nav;
    route: NavigationRoute<N, P[N]>;
  }>;
  initialParams?: P[N];
  options?:
    | O
    | ((context: { navigation: Nav; route: NavigationRoute<N, P[N]> }) => O);
}
export interface Definition<O> {
  name: string;
  component: React.ComponentType<any>;
  initialParams?: unknown;
  options?:
    | O
    | ((context: { navigation: AnyNavigation; route: NavigationRoute }) => O);
  section?: { key: string; title?: string };
}
export function readScreens<O>(
  children: React.ReactNode,
  Screen: React.ElementType,
  Section?: React.ElementType,
): Definition<O>[] {
  const result: Definition<O>[] = [];
  function visit(items: React.ReactNode, section?: Definition<O>['section']) {
    React.Children.forEach(items, (child) => {
      if (!React.isValidElement(child)) {
        if (child != null && typeof child !== 'boolean')
          throw new Error('Navigator children must be Screen elements.');
        return;
      }
      const props = child.props as {
        children?: React.ReactNode;
        title?: string;
      };
      if (child.type === React.Fragment) visit(props.children, section);
      else if (Section && child.type === Section)
        visit(props.children, {
          key: String(child.key ?? result.length),
          title: props.title,
        });
      else if (child.type === Screen)
        result.push({ ...(child.props as Definition<O>), section });
      else
        throw new Error(
          'Navigator children must be Screen, Section, or Fragment elements.',
        );
    });
  }
  visit(children);
  if (
    !result.length ||
    new Set(result.map((r) => r.name)).size !== result.length
  )
    throw new Error('Navigator requires unique Screen names.');
  return result;
}
export function useNavigator<S extends NavigationState>(
  type: S['type'],
  options: Omit<RouterOptions, 'key'>,
  explicitId?: string,
) {
  const store = useStore();
  const parent = React.useContext(ScopeContext);
  const id = parent.nodeId
    ? `${parent.nodeId}/${parent.routeKey}/${explicitId ?? type}`
    : (explicitId ?? 'root');
  const config: RouterOptions = { ...options, key: id };
  const [initial] = React.useState(
    () =>
      (store.getNode(id)?.state as S | undefined) ??
      (routers[type] as Router<S>).getInitialState(config),
  );
  const getSnapshot = React.useCallback(
    () => (store.getNode(id)?.state as S | undefined) ?? initial,
    [store, id, initial],
  );
  const state = React.useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    getSnapshot,
  );
  React.useLayoutEffect(
    () =>
      store.register(
        {
          id,
          parentId: parent.nodeId,
          parentRouteKey: parent.routeKey,
          type,
          state: initial,
        },
        config,
      ),
    [store, id],
  );
  React.useLayoutEffect(() => {
    store.updateOptions(id, config);
  });
  const navigation = React.useMemo(
    () => createNavigation(store, id),
    [store, id],
  );
  return { id, state, store, navigation };
}
export function resolveOptions<O>(
  definition: Definition<O>,
  route: NavigationRoute,
  navigation: AnyNavigation,
  defaults?:
    | O
    | ((context: { route: NavigationRoute; navigation: AnyNavigation }) => O),
): O {
  const context = { route, navigation };
  return {
    ...(typeof defaults === 'function'
      ? (defaults as (c: typeof context) => O)(context)
      : defaults),
    ...(typeof definition.options === 'function'
      ? (definition.options as (c: typeof context) => O)(context)
      : definition.options),
  } as O;
}
