import React from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
import { useNavigationTheme } from '../core/context';
import type {
  StackNavigation,
  StackScreenOptions,
  HeaderProps,
} from '../core/types';
export interface StackNavigatorProps {
  children: React.ReactNode;
  id?: string;
  initialRouteName?: string;
  historyBehavior?: HistoryBehavior;
  screenOptions?:
    | StackScreenOptions
    | ((context: {
        navigation: StackNavigation;
        route: import('../routers').NavigationRoute;
      }) => StackScreenOptions);
  style?: StyleProp<ViewStyle>;
}
function renderAction(
  action: StackScreenOptions['headerLeft'],
  props: HeaderProps,
) {
  return typeof action === 'function' ? action(props) : action;
}
export function StackHeader(props: HeaderProps) {
  const { options, route, navigation, canGoBack } = props;
  const { colors } = useNavigationTheme();
  if (options.headerShown === false) return null;
  if (options.header !== undefined)
    return (
      <>
        {typeof options.header === 'function'
          ? options.header(props)
          : options.header}
      </>
    );
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.action}>
        {options.headerLeft !== undefined
          ? renderAction(options.headerLeft, props)
          : canGoBack && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                focusable
                onPress={() => navigation.goBack()}
              >
                <Text style={{ color: colors.accent }}>‹ Back</Text>
              </Pressable>
            )}
      </View>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[styles.title, { color: colors.text }]}
      >
        {options.title ?? route.name}
      </Text>
      <View style={styles.action}>
        {renderAction(options.headerRight, props)}
      </View>
    </View>
  );
}
export function createStackNavigator<
  P extends ParamListBase = ParamListBase,
>() {
  function Screen<N extends RouteName<P>>(
    _props: ScreenConfig<P, N, StackScreenOptions, StackNavigation<P>>,
  ) {
    return null;
  }
  function Navigator(
    props: Omit<StackNavigatorProps, 'initialRouteName'> & {
      initialRouteName?: RouteName<P>;
    },
  ) {
    const definitions = readScreens<StackScreenOptions>(props.children, Screen);
    const { id, state, store } = useNavigator<StackNavigationState>(
      'stack',
      {
        routes: definitions,
        initialRouteName: props.initialRouteName,
        historyBehavior: props.historyBehavior,
      },
      props.id,
    );
    const getCanGoBack = React.useCallback(
      () => store.canDispatch('back', id),
      [store, id],
    );
    const canGoBack = React.useSyncExternalStore(
      store.subscribe,
      getCanGoBack,
      getCanGoBack,
    );
    const scenes = state.routes.map((route) => {
      const definition = definitions.find((d) => d.name === route.name)!;
      if (!definition)
        throw new Error(
          `Screen ${route.name} was removed. Remount the navigator to change its screen list.`,
        );
      const navigation = createNavigation(store, id, route.key);
      return {
        route,
        definition,
        navigation,
        options: resolveOptions(
          definition,
          route,
          navigation,
          props.screenOptions,
        ),
      };
    });
    let visibleStart = scenes.length - 1;
    while (
      visibleStart > 0 &&
      ['modal', 'dialog'].includes(
        scenes[visibleStart].options.presentation ?? 'card',
      )
    )
      visibleStart--;
    return (
      <NavigatorStateContext.Provider value={state}>
        <View style={[styles.stack, props.style]}>
          {scenes.map(({ route, definition, navigation, options }, index) => (
            <Scene
              key={route.key}
              nodeId={id}
              route={route}
              component={definition.component}
              visible={index >= visibleStart}
              options={options}
              animation={options.animation ?? 'default'}
              overlay={
                options.presentation === 'card'
                  ? undefined
                  : options.presentation
              }
            >
              <StackHeader
                route={route}
                navigation={navigation}
                options={options}
                canGoBack={canGoBack}
              />
            </Scene>
          ))}
        </View>
      </NavigatorStateContext.Provider>
    );
  }
  return { Navigator, Screen };
}
const styles = StyleSheet.create({
  stack: { flex: 1, overflow: 'hidden' },
  header: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, textAlign: 'center', fontWeight: '600' },
  action: { minWidth: 60 },
});
