import type React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type {
  ParamListBase,
  RouteName,
  RouteArgs,
  NavigationRoute,
  NavigationState,
  NavigationAction,
  RootNavigationState,
} from '../routers';
import type { NavigationEvent, NavigationEventType } from './store';
export interface Navigation<P extends ParamListBase = ParamListBase> {
  navigate(...args: RouteArgs<P>): void;
  goBack(): void;
  goForward(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  dispatch(action: NavigationAction): void;
  getState(): NavigationState;
  getParent(): Navigation | undefined;
  isFocused(): boolean;
  addListener(
    type: NavigationEventType,
    listener: (event: NavigationEvent) => void,
  ): () => void;
}
export interface StackNavigation<P extends ParamListBase = ParamListBase>
  extends Navigation<P> {
  push(...args: RouteArgs<P>): void;
  replace(...args: RouteArgs<P>): void;
  pop(count?: number): void;
  popTo(...args: RouteArgs<P>): void;
  popToRoot(): void;
}
export interface SidebarNavigation<P extends ParamListBase = ParamListBase>
  extends Navigation<P> {
  select(name: RouteName<P>): void;
  collapseSidebar(): void;
  expandSidebar(): void;
  toggleSidebar(): void;
}
export interface TabNavigation<P extends ParamListBase = ParamListBase>
  extends Navigation<P> {
  select(name: RouteName<P>): void;
  nextTab(): void;
  previousTab(): void;
}
export type StackScreenProps<
  P extends ParamListBase,
  N extends RouteName<P>,
> = { navigation: StackNavigation<P>; route: NavigationRoute<N, P[N]> };
export type SidebarScreenProps<
  P extends ParamListBase,
  N extends RouteName<P>,
> = { navigation: SidebarNavigation<P>; route: NavigationRoute<N, P[N]> };
export type TabScreenProps<P extends ParamListBase, N extends RouteName<P>> = {
  navigation: TabNavigation<P>;
  route: NavigationRoute<N, P[N]>;
};
export type FocusBehavior = 'none' | 'first' | 'restore';
export interface CommonScreenOptions {
  title?: string;
  focusBehavior?: FocusBehavior;
  inactiveBehavior?: 'keep' | 'unmount';
  contentStyle?: StyleProp<ViewStyle>;
}
export interface HeaderActionProps {
  navigation: StackNavigation;
  route: NavigationRoute;
  canGoBack: boolean;
}
export interface HeaderProps extends HeaderActionProps {
  options: StackScreenOptions;
}
export type StackAnimation =
  | 'default'
  | 'none'
  | 'fade'
  | 'slide-horizontal'
  | 'slide-vertical';
export interface StackScreenOptions extends CommonScreenOptions {
  headerShown?: boolean;
  header?: React.ReactNode | ((props: HeaderProps) => React.ReactNode);
  headerLeft?:
    | React.ReactNode
    | ((props: HeaderActionProps) => React.ReactNode);
  headerRight?:
    | React.ReactNode
    | ((props: HeaderActionProps) => React.ReactNode);
  animation?: StackAnimation;
  presentation?: 'card' | 'modal' | 'dialog';
}
export interface SidebarScreenOptions extends CommonScreenOptions {
  label?: string;
  icon?:
    | React.ReactNode
    | ((props: { focused: boolean; disabled: boolean }) => React.ReactNode);
  badge?: React.ReactNode;
  hidden?: boolean;
  disabled?: boolean;
}
export interface TabScreenOptions extends SidebarScreenOptions {}
export interface NavigationTheme {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    border: string;
    accent: string;
    selectedBackground: string;
  };
}
export interface NavigationRef<P extends ParamListBase> {
  current: NavigationRefHandle<P> | null;
  isReady(): boolean;
  navigate(...args: RouteArgs<P>): void;
  goBack(): void;
  goForward(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  dispatch(action: NavigationAction): void;
  getRootState(): RootNavigationState | undefined;
}
export interface NavigationRefHandle<P extends ParamListBase>
  extends Omit<NavigationRef<P>, 'current'> {}
