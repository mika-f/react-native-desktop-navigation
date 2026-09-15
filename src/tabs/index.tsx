import React from 'react';
import type { ParamListBase, RouteName } from '../routers';
import { readScreens, type ScreenConfig } from '../core/builder';
import {
  SelectionNavigator,
  type SelectionNavigatorProps,
} from '../core/SelectionNavigator';
import type { TabNavigation, TabScreenOptions } from '../core/types';
export type TabNavigatorOptions = Pick<
  SelectionNavigatorProps,
  | 'id'
  | 'initialRouteName'
  | 'screenOptions'
  | 'style'
  | 'barStyle'
  | 'barContentStyle'
  | 'contentStyle'
>;
export function createTabNavigator<P extends ParamListBase = ParamListBase>() {
  function Screen<N extends RouteName<P>>(
    _props: ScreenConfig<P, N, TabScreenOptions, TabNavigation<P>>,
  ) {
    return null;
  }
  function Navigator(
    props: Omit<TabNavigatorOptions, 'initialRouteName'> & {
      initialRouteName?: RouteName<P>;
      children: React.ReactNode;
    },
  ) {
    return (
      <SelectionNavigator
        {...props}
        type="tabs"
        definitions={readScreens(props.children, Screen)}
      />
    );
  }
  return { Navigator, Screen };
}
