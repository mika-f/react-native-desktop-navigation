import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { type SelectionNavigationState } from '../routers';
import {
  useNavigator,
  resolveOptions,
  NavigatorStateContext,
  type Definition,
} from './builder';
import { Scene } from './Scene';
import { createNavigation } from './navigation';
import { PlatformContext, useNavigationTheme } from './context';
import type { SidebarScreenOptions } from './types';
import {
  consumeKey,
  DesktopView,
  eventHandled,
  matchesShortcut,
} from '../platform';
import type { FocusTarget } from './focus';
export interface SelectionNavigatorProps {
  id?: string;
  initialRouteName?: string;
  screenOptions?: SidebarScreenOptions;
  style?: StyleProp<ViewStyle>;
  position?: 'left' | 'right';
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  collapsible?: boolean;
  collapsedWidth?: number;
  defaultCollapsed?: boolean;
}
export function SelectionNavigator({
  type,
  definitions,
  ...props
}: SelectionNavigatorProps & {
  type: 'sidebar' | 'tabs';
  definitions: Definition<SidebarScreenOptions>[];
}) {
  const platform = React.useContext(PlatformContext);
  const { colors } = useNavigationTheme();
  const configs = definitions.map((d) => ({
    ...d,
    ...props.screenOptions,
    ...(typeof d.options === 'object' ? d.options : {}),
  }));
  const { id, state, store, navigation } =
    useNavigator<SelectionNavigationState>(
      type,
      {
        routes: configs,
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
    return {
      route,
      definition,
      options: resolveOptions(
        definition,
        route,
        createNavigation(store, id, route.key),
        props.screenOptions,
      ),
    };
  });
  React.useLayoutEffect(() => {
    store.updateOptions(id, {
      key: id,
      routes: items.map((i) => ({ name: i.route.name, ...i.options })),
    });
    const current = items.find((i) => i.route.key === state.activeRouteKey);
    if (current?.options.hidden || current?.options.disabled) {
      const next = items.find((i) => !i.options.hidden && !i.options.disabled);
      if (next) navigation.select(next.route.name);
    }
  });
  const enabled = items.filter((i) => !i.options.hidden && !i.options.disabled);
  const [focusedKey, setFocusedKey] = React.useState(state.activeRouteKey);
  const refs = React.useRef(new Map<string, FocusTarget>());
  const sidebar = type === 'sidebar';
  const collapsed = sidebar && state.collapsed;
  const focusItem = (index: number) => {
    const item = enabled[(index + enabled.length) % enabled.length];
    if (!item) return;
    setFocusedKey(item.route.key);
    refs.current.get(item.route.key)?.focus();
  };
  const bindings = sidebar
    ? ['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'].map((key) => ({ key }))
    : [
        ...['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].map((key) => ({
          key,
        })),
        ...platform.keyboardShortcuts.nextTab,
        ...platform.keyboardShortcuts.previousTab,
      ];
  const rail = (
    <DesktopView
      accessibilityRole={sidebar ? 'menu' : 'tablist'}
      keyDownEvents={bindings}
      focusable
      onKeyDown={(event) => {
        if (
          eventHandled(event) ||
          platform.isTextInputEvent(event) ||
          !bindings.some((key) => matchesShortcut(event, key))
        )
          return;
        store.setFocusedNode(id);
        const index = enabled.findIndex((i) => i.route.key === focusedKey);
        const key = event.nativeEvent.key;
        if (
          !sidebar &&
          platform.keyboardShortcuts.nextTab.some((k) =>
            matchesShortcut(event, k),
          )
        )
          navigation.nextTab();
        else if (
          !sidebar &&
          platform.keyboardShortcuts.previousTab.some((k) =>
            matchesShortcut(event, k),
          )
        )
          navigation.previousTab();
        else if (key === 'ArrowUp' || key === 'ArrowLeft') focusItem(index - 1);
        else if (key === 'ArrowDown' || key === 'ArrowRight')
          focusItem(index + 1);
        else if (key === 'Home') focusItem(0);
        else if (key === 'End') focusItem(enabled.length - 1);
        else if (key === 'Enter') {
          const item = enabled.find((i) => i.route.key === focusedKey);
          if (item) navigation.select(item.route.name);
        }
        consumeKey(event);
      }}
      style={[
        { backgroundColor: colors.surface, borderColor: colors.border },
        sidebar
          ? {
              width: collapsed
                ? (props.collapsedWidth ?? 56)
                : Math.min(
                    props.maxWidth ?? Infinity,
                    Math.max(
                      props.minWidth ?? 120,
                      props.width ?? platform.sidebar.defaultWidth,
                    ),
                  ),
              borderRightWidth: StyleSheet.hairlineWidth,
            }
          : { borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <ScrollView
        horizontal={!sidebar}
        contentContainerStyle={!sidebar ? styles.tabItems : undefined}
      >
        {items.map((item, index) => {
          if (item.options.hidden) return null;
          const { route, options, definition } = item;
          const selected = route.key === state.activeRouteKey;
          const section = definition.section;
          const label = options.label ?? options.title ?? route.name;
          return (
            <React.Fragment key={route.key}>
              {sidebar &&
                !collapsed &&
                section?.title &&
                items[index - 1]?.definition.section?.key !== section.key && (
                  <Text
                    accessibilityRole="header"
                    style={[styles.section, { color: colors.mutedText }]}
                  >
                    {section.title}
                  </Text>
                )}
              <Pressable
                ref={(value) => {
                  if (value)
                    refs.current.set(
                      route.key,
                      value as unknown as FocusTarget,
                    );
                  else refs.current.delete(route.key);
                }}
                accessible
                focusable={!options.disabled}
                disabled={options.disabled}
                accessibilityRole={sidebar ? 'menuitem' : 'tab'}
                accessibilityLabel={label}
                accessibilityState={{ selected, disabled: !!options.disabled }}
                onFocus={() => {
                  setFocusedKey(route.key);
                  store.setFocusedNode(id);
                }}
                onPress={() => {
                  store.setFocusedNode(id);
                  navigation.select(route.name);
                }}
                style={[
                  styles.item,
                  {
                    opacity: options.disabled ? 0.45 : 1,
                    backgroundColor: selected
                      ? colors.selectedBackground
                      : 'transparent',
                    borderColor:
                      focusedKey === route.key ? colors.accent : 'transparent',
                  },
                ]}
              >
                {typeof options.icon === 'function'
                  ? options.icon({
                      focused: selected,
                      disabled: !!options.disabled,
                    })
                  : options.icon}
                {(!collapsed || !options.icon) && (
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.text, flexShrink: 1 }}
                  >
                    {collapsed ? label.slice(0, 1) : label}
                  </Text>
                )}
                {!collapsed &&
                  options.badge != null &&
                  (typeof options.badge === 'string' ||
                  typeof options.badge === 'number' ? (
                    <Text style={{ color: colors.mutedText }}>
                      {options.badge}
                    </Text>
                  ) : (
                    options.badge
                  ))}
              </Pressable>
            </React.Fragment>
          );
        })}
      </ScrollView>
      {sidebar && props.collapsible !== false && (
        <Pressable
          accessible
          focusable
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onPress={() => navigation.toggleSidebar()}
          style={styles.item}
        >
          <Text style={{ color: colors.text }}>{collapsed ? '»' : '«'}</Text>
        </Pressable>
      )}
    </DesktopView>
  );
  return (
    <NavigatorStateContext.Provider value={state}>
      <View
        style={[
          styles.container,
          sidebar && {
            flexDirection: props.position === 'right' ? 'row-reverse' : 'row',
          },
          props.style,
        ]}
      >
        {rail}
        <View style={styles.content}>
          {items.map(({ route, definition, options }) => (
            <Scene
              key={route.key}
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
          ))}
        </View>
      </View>
    </NavigatorStateContext.Provider>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, minWidth: 0 },
  tabItems: { flexDirection: 'row' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    margin: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  section: { padding: 10, fontSize: 12, fontWeight: '600' },
});
