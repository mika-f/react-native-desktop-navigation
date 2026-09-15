import React from 'react';
import type { NavigationStore } from './store';
import type { NavigationRoute } from '../routers';
import type { AnyNavigation } from './navigation';
import type { NavigationTheme } from './types';
import { defaultPlatformAdapter } from '../platform';
export const StoreContext = React.createContext<NavigationStore | null>(null);
export const ScopeContext = React.createContext<{
  nodeId?: string;
  routeKey?: string;
}>({});
export const ScreenContext = React.createContext<{
  navigation: AnyNavigation;
  route: NavigationRoute;
  focused: boolean;
} | null>(null);
export const PlatformContext = React.createContext(defaultPlatformAdapter);
export const DefaultTheme: NavigationTheme = {
  dark: false,
  colors: {
    background: '#ffffff',
    surface: '#f5f5f7',
    text: '#202124',
    mutedText: '#64656b',
    border: '#d8d8dc',
    accent: '#0067c0',
    selectedBackground: '#dcecff',
  },
};
export const ThemeContext = React.createContext(DefaultTheme);
export const useNavigationTheme = () => React.useContext(ThemeContext);
export function useStore() {
  const store = React.useContext(StoreContext);
  if (!store)
    throw new Error('Navigation must be rendered inside NavigationContainer.');
  return store;
}
