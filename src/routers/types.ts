export type ParamListBase = Record<string, unknown>;
export type RouteName<P extends ParamListBase> = Extract<keyof P, string>;
export type RouteArgs<P extends ParamListBase> = {
  [N in RouteName<P>]: undefined extends P[N]
    ? [name: N, params?: P[N]]
    : [name: N, params: P[N]];
}[RouteName<P>];
export interface NavigationRoute<
  Name extends string = string,
  Params = unknown,
> {
  key: string;
  name: Name;
  params: Params;
}
export type HistoryBehavior = 'stack' | 'desktop';
export interface StackHistoryState {
  past: NavigationRoute[][];
  future: NavigationRoute[][];
}
export interface StackNavigationState {
  type: 'stack';
  key: string;
  routes: NavigationRoute[];
  activeRouteKey: string;
  history?: StackHistoryState;
  /** Monotonic route instance counter; independent of back/forward history. */
  nextRouteId: number;
}
export interface SelectionNavigationState {
  type: 'sidebar' | 'tabs';
  key: string;
  routes: NavigationRoute[];
  activeRouteKey: string;
  collapsed: boolean;
}
export interface SplitNavigationState {
  type: 'split';
  key: string;
  routes: NavigationRoute[];
  activeRouteKey: string;
  widths: Record<string, number>;
  visibleColumnIds: string[];
}
export type NavigationState =
  | StackNavigationState
  | SelectionNavigationState
  | SplitNavigationState;
export interface NavigationNode {
  id: string;
  parentId?: string;
  parentRouteKey?: string;
  type: NavigationState['type'];
  state: NavigationState;
}
export interface RootNavigationState {
  version: 1;
  rootNodeId: string;
  activeNodeId?: string;
  nodes: Record<string, NavigationNode>;
}
export type NavigationAction = { target?: string } & (
  | {
      type: 'navigate' | 'push' | 'replace' | 'popTo';
      payload: { name: string; params?: unknown; key?: string };
    }
  | { type: 'select'; payload: { name: string } }
  | { type: 'pop'; payload?: { count?: number } }
  | {
      type:
        | 'back'
        | 'forward'
        | 'popToRoot'
        | 'nextTab'
        | 'previousTab'
        | 'collapseSidebar'
        | 'expandSidebar'
        | 'toggleSidebar';
    }
  | { type: 'resize'; payload: { id: string; width: number } }
  | { type: 'layout'; payload: { ids: string[] } }
);
export interface RouteConfig {
  name: string;
  initialParams?: unknown;
  hidden?: boolean;
  disabled?: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
}
export interface RouterOptions {
  key: string;
  routes: RouteConfig[];
  initialRouteName?: string;
  historyBehavior?: HistoryBehavior;
  defaultCollapsed?: boolean;
}
export interface Router<S extends NavigationState = NavigationState> {
  getInitialState(options: RouterOptions): S;
  /** null means unhandled and allows the store to bubble to the parent. */
  reduce(state: S, action: NavigationAction, options: RouterOptions): S | null;
}
