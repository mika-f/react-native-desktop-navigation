import type {
  NavigationRoute,
  NavigationState,
  Router,
  RouterOptions,
  StackNavigationState,
  SelectionNavigationState,
  SplitNavigationState,
  NavigationAction,
} from './types';
export * from './types';
let sequence = 0;
export const createRouteKey = (name: string) =>
  `${name}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
export function validateRoutes(options: RouterOptions) {
  const names = options.routes.map((r) => r.name);
  if (!names.length)
    throw new Error('A navigator requires at least one screen.');
  if (new Set(names).size !== names.length)
    throw new Error('Duplicate Screen name or Split.Column id.');
  if (options.initialRouteName && !names.includes(options.initialRouteName))
    throw new Error(`Unknown initialRouteName: ${options.initialRouteName}`);
}
const routeFor = (
  options: RouterOptions,
  name: string,
  key = `${options.key}/${name}/initial`,
  params?: unknown,
): NavigationRoute => ({
  key,
  name,
  params:
    params === undefined
      ? options.routes.find((r) => r.name === name)?.initialParams
      : params,
});
const top = (routes: NavigationRoute[]) => routes[routes.length - 1].key;
const eligible = (options: RouterOptions, name: string) =>
  options.routes.some((r) => r.name === name && !r.hidden && !r.disabled);
function withRoutes(
  state: StackNavigationState,
  routes: NavigationRoute[],
  record = true,
): StackNavigationState {
  if (routes === state.routes) return state;
  return {
    ...state,
    routes,
    activeRouteKey: top(routes),
    history:
      state.history &&
      (record
        ? { past: [...state.history.past, state.routes], future: [] }
        : state.history),
  };
}
export const StackRouter: Router<StackNavigationState> = {
  getInitialState(options) {
    validateRoutes(options);
    const route = routeFor(
      options,
      options.initialRouteName ?? options.routes[0].name,
    );
    return {
      type: 'stack',
      key: options.key,
      routes: [route],
      activeRouteKey: route.key,
      nextRouteId: 1,
      ...(options.historyBehavior === 'desktop'
        ? { history: { past: [], future: [] } }
        : {}),
    };
  },
  reduce(state, action, options) {
    const routes = state.routes;
    switch (action.type) {
      case 'navigate':
      case 'push':
      case 'replace':
      case 'popTo': {
        const { name, params } = action.payload;
        const key =
          action.payload.key ?? `${state.key}/${name}/${state.nextRouteId}`;
        const fresh = { ...state, nextRouteId: state.nextRouteId + 1 };
        if (!options.routes.some((r) => r.name === name)) return null;
        if (action.type === 'push')
          return withRoutes(fresh, [
            ...routes,
            routeFor(options, name, key, params),
          ]);
        if (action.type === 'replace')
          return withRoutes(fresh, [
            ...routes.slice(0, -1),
            routeFor(options, name, key, params),
          ]);
        let index = routes.length - 1;
        while (index >= 0 && routes[index].name !== name) index--;
        if (index < 0) {
          if (action.type === 'popTo') {
            console.warn(`popTo: route ${name} is not in the stack.`);
            return state;
          }
          return withRoutes(fresh, [
            ...routes,
            routeFor(options, name, key, params),
          ]);
        }
        if (index === routes.length - 1 && params === undefined) return state;
        return withRoutes(state, [
          ...routes.slice(0, index),
          { ...routes[index], ...(params === undefined ? {} : { params }) },
        ]);
      }
      case 'back':
        if (state.history?.past.length) {
          const past = state.history.past;
          const previous = past[past.length - 1];
          return {
            ...state,
            routes: previous,
            activeRouteKey: top(previous),
            history: {
              past: past.slice(0, -1),
              future: [routes, ...state.history.future],
            },
          };
        }
        if (state.history) return null;
        return routes.length > 1
          ? withRoutes(state, routes.slice(0, -1))
          : null;
      case 'forward': {
        if (!state.history?.future.length) return null;
        const [next, ...future] = state.history.future;
        return {
          ...state,
          routes: next,
          activeRouteKey: top(next),
          history: { past: [...state.history.past, routes], future },
        };
      }
      case 'pop': {
        const count = action.payload?.count ?? 1;
        if (!Number.isInteger(count) || count < 1) {
          console.warn('pop count must be a positive integer.');
          return state;
        }
        if (count >= routes.length)
          console.warn('pop exceeds the stack root; keeping the root screen.');
        return routes.length > 1
          ? withRoutes(
              state,
              routes.slice(0, Math.max(1, routes.length - count)),
            )
          : state;
      }
      case 'popToRoot':
        return routes.length > 1
          ? withRoutes(state, routes.slice(0, 1))
          : state;
      default:
        return null;
    }
  },
};
function selectionRouter(
  type: 'sidebar' | 'tabs',
): Router<SelectionNavigationState> {
  return {
    getInitialState(options) {
      validateRoutes(options);
      const routes = options.routes.map((r) => routeFor(options, r.name));
      const name =
        options.initialRouteName ??
        options.routes.find((r) => !r.hidden && !r.disabled)?.name;
      if (!name || !eligible(options, name))
        throw new Error('Initial selection must be a visible, enabled screen.');
      return {
        type,
        key: options.key,
        routes,
        activeRouteKey: routes.find((r) => r.name === name)!.key,
        collapsed: options.defaultCollapsed ?? false,
      };
    },
    reduce(state, action, options) {
      if (action.type === 'navigate' || action.type === 'select') {
        const name = action.payload.name;
        const route = state.routes.find((r) => r.name === name);
        if (!route) return null;
        if (!eligible(options, name)) return state;
        const params =
          action.type === 'navigate' ? action.payload.params : undefined;
        if (route.key === state.activeRouteKey && params === undefined)
          return state;
        return {
          ...state,
          activeRouteKey: route.key,
          routes:
            params === undefined
              ? state.routes
              : state.routes.map((r) =>
                  r.key === route.key ? { ...r, params } : r,
                ),
        };
      }
      if (
        type === 'tabs' &&
        (action.type === 'nextTab' || action.type === 'previousTab')
      ) {
        const routes = state.routes.filter((r) => eligible(options, r.name));
        if (!routes.length) return state;
        const index = routes.findIndex((r) => r.key === state.activeRouteKey);
        const next =
          (index + (action.type === 'nextTab' ? 1 : -1) + routes.length) %
          routes.length;
        return { ...state, activeRouteKey: routes[next].key };
      }
      if (
        type === 'sidebar' &&
        ['collapseSidebar', 'expandSidebar', 'toggleSidebar'].includes(
          action.type,
        )
      ) {
        const collapsed =
          action.type === 'toggleSidebar'
            ? !state.collapsed
            : action.type === 'collapseSidebar';
        return collapsed === state.collapsed ? state : { ...state, collapsed };
      }
      return null;
    },
  };
}
export const SidebarRouter = selectionRouter('sidebar');
export const TabRouter = selectionRouter('tabs');
export function clampColumnWidth(
  width: number,
  config: { minWidth?: number; maxWidth?: number },
) {
  const min = config.minWidth ?? 100,
    max = config.maxWidth ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isFinite(min) || min < 0 || !Number.isFinite(max) || max < min)
    throw new Error('Invalid column width constraints.');
  return Math.min(max, Math.max(min, Number.isFinite(width) ? width : min));
}
export const SplitRouter: Router<SplitNavigationState> = {
  getInitialState(options) {
    validateRoutes(options);
    if (options.routes.length < 2 || options.routes.length > 3)
      throw new Error('Split requires 2–3 columns.');
    const routes = options.routes.map((r) => routeFor(options, r.name));
    return {
      type: 'split',
      key: options.key,
      routes,
      activeRouteKey: routes[0].key,
      widths: Object.fromEntries(
        options.routes.map((r) => [
          r.name,
          clampColumnWidth(r.defaultWidth ?? r.minWidth ?? 240, r),
        ]),
      ),
      visibleColumnIds: routes.map((r) => r.name),
    };
  },
  reduce(state, action, options) {
    if (action.type === 'resize') {
      const config = options.routes.find((r) => r.name === action.payload.id);
      if (!config) return null;
      const width = clampColumnWidth(action.payload.width, config);
      return state.widths[config.name] === width
        ? state
        : { ...state, widths: { ...state.widths, [config.name]: width } };
    }
    if (action.type === 'layout') {
      const ids = action.payload.ids;
      if (
        !ids.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !state.routes.some((r) => r.name === id))
      )
        throw new Error('Split layout must return unique, known column ids.');
      if (ids.join('\0') === state.visibleColumnIds.join('\0')) return state;
      const active = state.routes.find((r) => r.key === state.activeRouteKey)!;
      return {
        ...state,
        visibleColumnIds: [...ids],
        activeRouteKey: ids.includes(active.name)
          ? active.key
          : state.routes.find((r) => r.name === ids[0])!.key,
      };
    }
    return null;
  },
};
export const routers = {
  stack: StackRouter,
  sidebar: SidebarRouter,
  tabs: TabRouter,
  split: SplitRouter,
};
export function reduceNavigation(
  state: NavigationState,
  action: NavigationAction,
  options: RouterOptions,
): NavigationState | null {
  return (routers[state.type] as Router).reduce(state, action, options);
}
