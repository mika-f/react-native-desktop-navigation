import React from 'react';
import type {
  HistoryBehavior,
  ParamListBase,
  RouteName,
  StackNavigationState,
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
import type { StackNavigation, StackScreenOptions } from '../core/types';
import { StackHeader } from '../stack';
import { NativeSurface, type NativeAppearance } from './host';
import type { StyleProp, ViewStyle } from 'react-native';

/** Native stacks currently support card presentation without RN entrance animations. */
export type NativeStackScreenOptions = Omit<
  StackScreenOptions,
  'animation' | 'presentation' | 'overlayStyle' | 'dialogStyle'
>;
export interface NativeStackNavigatorProps {
  children: React.ReactNode;
  id?: string;
  initialRouteName?: string;
  historyBehavior?: HistoryBehavior;
  screenOptions?:
    | NativeStackScreenOptions
    | ((context: {
        navigation: StackNavigation;
        route: import('../routers').NavigationRoute;
      }) => NativeStackScreenOptions);
  style?: StyleProp<ViewStyle>;
  appearance?: NativeAppearance;
}
export function createStackNavigator<
  P extends ParamListBase = ParamListBase,
>() {
  function Screen<N extends RouteName<P>>(
    _props: ScreenConfig<P, N, NativeStackScreenOptions, StackNavigation<P>>,
  ) {
    return null;
  }
  function Navigator(
    props: Omit<NativeStackNavigatorProps, 'initialRouteName'> & {
      initialRouteName?: RouteName<P>;
    },
  ) {
    const definitions = readScreens<NativeStackScreenOptions>(
      props.children,
      Screen,
    );
    const { id, state, store } = useNavigator<StackNavigationState>(
      'stack',
      {
        routes: definitions,
        initialRouteName: props.initialRouteName,
        historyBehavior: props.historyBehavior,
      },
      props.id,
    );
    const snapshot = React.useCallback(
      () => store.canDispatch('back', id),
      [store, id],
    );
    const canGoBack = React.useSyncExternalStore(
      store.subscribe,
      snapshot,
      snapshot,
    );
    const scenes = state.routes.map((route) => {
      const definition = definitions.find((d) => d.name === route.name);
      if (!definition)
        throw new Error(
          `Missing Screen: ${route.name}. Remount to change the screen list.`,
        );
      const navigation = createNavigation(store, id, route.key);
      const options = resolveOptions(
        definition,
        route,
        navigation,
        props.screenOptions,
      );
      // Any RN header customization selects the existing customizable header.
      const customHeader = Object.keys(options).some(
        (key) =>
          key.startsWith('header') &&
          !['headerShown', 'headerBackTitle'].includes(key),
      );
      return { route, definition, navigation, options, customHeader };
    });
    const active = scenes.find(
      (scene) => scene.route.key === state.activeRouteKey,
    )!;
    return (
      <NavigatorStateContext.Provider value={state}>
        <NativeSurface
          style={props.style}
          configuration={{
            mode: 'stack',
            items: scenes.map((s) => ({
              key: s.route.key,
              title: s.options.title ?? s.route.name,
            })),
            activeKey: state.activeRouteKey,
            appearance: props.appearance,
            headerShown:
              active.options.headerShown !== false && !active.customHeader,
            canGoBack,
            backTitle: active.options.headerBackTitle ?? 'Back',
          }}
          onRequest={(request) => {
            if (request.type === 'back')
              store.dispatch({ type: 'back', target: id });
            if (request.type === 'pop' && request.count < state.routes.length)
              store.dispatch({
                type: 'pop',
                target: id,
                payload: { count: request.count },
              });
          }}
          slots={scenes.map(
            ({ route, definition, navigation, options, customHeader }) => ({
              key: route.key,
              visible: route.key === state.activeRouteKey,
              content: (ready) => (
                <Scene
                  focusReady={ready}
                  nodeId={id}
                  route={route}
                  component={definition.component}
                  visible={route.key === state.activeRouteKey}
                  options={options}
                >
                  {customHeader && (
                    <StackHeader
                      route={route}
                      navigation={navigation}
                      options={options}
                      canGoBack={canGoBack}
                    />
                  )}
                </Scene>
              ),
            }),
          )}
        />
      </NavigatorStateContext.Provider>
    );
  }
  return { Navigator, Screen };
}
