import React from 'react';
import type { ParamListBase, RouteName } from '../routers';
import { readScreens, type ScreenConfig } from '../core/builder';
import {
  SelectionNavigator,
  type SelectionNavigatorProps,
} from '../core/SelectionNavigator';
import type {
  SidebarNavigation,
  SidebarScreenOptions,
  SidebarSectionOptions,
} from '../core/types';
export interface SidebarNavigatorOptions extends SelectionNavigatorProps {}
export function createSidebarNavigator<
  P extends ParamListBase = ParamListBase,
>() {
  function Screen<N extends RouteName<P>>(
    _props: ScreenConfig<P, N, SidebarScreenOptions, SidebarNavigation<P>>,
  ) {
    return null;
  }
  function Section(
    _props: SidebarSectionOptions & { children: React.ReactNode },
  ) {
    return null;
  }
  function Navigator(
    props: Omit<SidebarNavigatorOptions, 'initialRouteName'> & {
      initialRouteName?: RouteName<P>;
      children: React.ReactNode;
    },
  ) {
    return (
      <SelectionNavigator
        {...props}
        type="sidebar"
        definitions={readScreens(props.children, Screen, Section)}
      />
    );
  }
  return { Navigator, Screen, Section };
}
