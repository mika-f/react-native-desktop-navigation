import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type {
  ParamListBase,
  RouteName,
  SelectionNavigationState,
} from '../routers';
import {
  useNavigator,
  readScreens,
  resolveOptions,
  NavigatorStateContext,
  type ScreenConfig,
} from '../core/builder';
import { Scene } from '../core/Scene';
import { createNavigation } from '../core/navigation';
import type { CommonScreenOptions, SidebarNavigation } from '../core/types';
import { NativeSurface, type NativeAppearance } from './host';
import { resolveNativeIcon, type NativeSidebarIconOption } from './icons';

export interface NativeSidebarScreenOptions extends CommonScreenOptions {
  label?: string;
  icon?: NativeSidebarIconOption;
  /** Square slot size for React icons, in points / DIPs (default 24). */
  iconSize?: number;
  hidden?: boolean;
  disabled?: boolean;
}
export interface NativeSidebarNavigatorProps {
  children: React.ReactNode;
  id?: string;
  initialRouteName?: string;
  defaultCollapsed?: boolean;
  width?: number;
  style?: StyleProp<ViewStyle>;
  appearance?: NativeAppearance;
  screenOptions?: NativeSidebarScreenOptions;
}
export function createSidebarNavigator<
  P extends ParamListBase = ParamListBase,
>() {
  function Screen<N extends RouteName<P>>(
    _props: ScreenConfig<
      P,
      N,
      NativeSidebarScreenOptions,
      SidebarNavigation<P>
    >,
  ) {
    return null;
  }
  function Section(_props: { title?: string; children: React.ReactNode }) {
    return null;
  }
  function Navigator(
    props: Omit<NativeSidebarNavigatorProps, 'initialRouteName'> & {
      initialRouteName?: RouteName<P>;
    },
  ) {
    if (
      props.width !== undefined &&
      (!Number.isFinite(props.width) || props.width < 100)
    )
      throw new Error(
        'Native sidebar width must be a finite number of at least 100.',
      );
    const definitions = readScreens<NativeSidebarScreenOptions>(
      props.children,
      Screen,
      Section,
    );
    const { id, state, store, navigation } =
      useNavigator<SelectionNavigationState>(
        'sidebar',
        {
          routes: definitions.map((d) => ({
            ...d,
            ...props.screenOptions,
            ...(typeof d.options === 'object' ? d.options : {}),
          })),
          initialRouteName: props.initialRouteName,
          defaultCollapsed: props.defaultCollapsed,
        },
        props.id,
      );
    const items = state.routes.map((route) => {
      const definition = definitions.find((d) => d.name === route.name);
      if (!definition)
        throw new Error(
          `Missing Screen: ${route.name}. Remount to change the screen list.`,
        );
      const options = resolveOptions(
        definition,
        route,
        createNavigation(store, id, route.key),
        props.screenOptions,
      );
      const iconState = {
        focused: route.key === state.activeRouteKey,
        disabled: options.disabled ?? false,
      };
      const icon =
        typeof options.icon === 'function'
          ? options.icon(iconState)
          : options.icon;
      return {
        route,
        definition,
        options,
        icon,
        nativeIcon: resolveNativeIcon(icon, iconState, options.iconSize),
      };
    });
    React.useLayoutEffect(() => {
      store.updateOptions(id, {
        key: id,
        routes: items.map((i) => ({ name: i.route.name, ...i.options })),
      });
      const active = items.find((i) => i.route.key === state.activeRouteKey);
      if (active?.options.disabled || active?.options.hidden) {
        const next = items.find(
          (i) => !i.options.disabled && !i.options.hidden,
        );
        if (next) navigation.select(next.route.name);
      }
    });
    return (
      <NavigatorStateContext.Provider value={state}>
        <NativeSurface
          style={props.style}
          configuration={{
            mode: 'sidebar',
            items: items.map((i) => ({
              key: i.route.key,
              title: i.options.label ?? i.options.title ?? i.route.name,
              hidden: i.options.hidden,
              disabled: i.options.disabled,
              section: i.definition.section?.title,
              icon: i.nativeIcon,
            })),
            activeKey: state.activeRouteKey,
            collapsed: state.collapsed,
            paneWidth: props.width ?? 240,
            appearance: props.appearance,
          }}
          icons={items.flatMap((i) =>
            React.isValidElement(i.icon) && !i.options.hidden
              ? [{ key: i.route.key, content: i.icon }]
              : [],
          )}
          onRequest={(request) => {
            if (request.type === 'collapse')
              store.dispatch({
                target: id,
                type: request.collapsed ? 'collapseSidebar' : 'expandSidebar',
              });
            if (request.type === 'select') {
              const item = items.find(
                (i) =>
                  i.route.key === request.key &&
                  !i.options.hidden &&
                  !i.options.disabled,
              );
              if (item) {
                store.setFocusedNode(id);
                navigation.select(item.route.name);
              }
            }
          }}
          slots={items.map(({ route, definition, options }) => ({
            key: route.key,
            visible:
              route.key === state.activeRouteKey &&
              !options.hidden &&
              !options.disabled,
            content: (ready) => (
              <Scene
                focusReady={ready}
                nodeId={id}
                route={route}
                component={definition.component}
                visible={
                  route.key === state.activeRouteKey &&
                  !options.hidden &&
                  !options.disabled
                }
                options={options}
              />
            ),
          }))}
        />
      </NavigatorStateContext.Provider>
    );
  }
  return { Navigator, Screen, Section };
}
