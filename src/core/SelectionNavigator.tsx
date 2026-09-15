import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { type SelectionNavigationState } from '../routers';
import {
  useNavigator,
  resolveOptions,
  NavigatorStateContext,
  type Definition,
} from './builder';
import { NavigationItem, navigationItemStyle } from './NavigationItem';
import { Scene } from './Scene';
import { createNavigation } from './navigation';
import { PlatformContext, useNavigationTheme } from './context';
import type { SidebarScreenOptions, SidebarFooterProps } from './types';
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
  barStyle?: StyleProp<ViewStyle>;
  barContentStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  sectionStyle?: StyleProp<ViewStyle>;
  sectionTitleStyle?: StyleProp<TextStyle>;
  /** Hide the default button independently of programmatic collapse actions. */
  collapseButtonShown?: boolean;
  sidebarFooterStyle?: StyleProp<ViewStyle>;
  /** Replace the entire footer. Return null to remove it without reserving space. */
  renderSidebarFooter?: (props: SidebarFooterProps) => React.ReactNode;
  collapseButtonStyle?: StyleProp<ViewStyle>;
  collapseLabelStyle?: StyleProp<TextStyle>;
  renderCollapseButtonContent?: (props: {
    collapsed: boolean;
    children: React.ReactNode;
  }) => React.ReactNode;
  position?: 'left' | 'right';
  /** Use 'fill' to follow the width of a containing Split.Column. */
  width?: number | 'fill';
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
  const visibleItems = items.filter((i) => !i.options.hidden);
  const enabled = visibleItems.filter((i) => !i.options.disabled);
  const [focusedKey, setFocusedKey] = React.useState('');
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
  const collapseContent = (
    <Text style={[{ color: colors.text }, props.collapseLabelStyle]}>
      {collapsed ? '»' : '«'}
    </Text>
  );
  const collapseButton =
    sidebar &&
    props.collapsible !== false &&
    props.collapseButtonShown !== false ? (
      <Pressable
        accessible
        focusable
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onPress={() => navigation.toggleSidebar()}
        style={[navigationItemStyle, props.collapseButtonStyle]}
      >
        {props.renderCollapseButtonContent
          ? props.renderCollapseButtonContent({
              collapsed,
              children: collapseContent,
            })
          : collapseContent}
      </Pressable>
    ) : null;
  const footer =
    sidebar && props.renderSidebarFooter
      ? props.renderSidebarFooter({
          collapsed,
          collapseSidebar: navigation.collapseSidebar,
          expandSidebar: navigation.expandSidebar,
          toggleSidebar: navigation.toggleSidebar,
          children: collapseButton,
        })
      : collapseButton;
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
        const index = enabled.findIndex(
          (i) => i.route.key === (focusedKey || state.activeRouteKey),
        );
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
          const item = enabled.find(
            (i) => i.route.key === (focusedKey || state.activeRouteKey),
          );
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
                : props.width === 'fill'
                  ? '100%'
                  : Math.min(
                      props.maxWidth ?? Infinity,
                      Math.max(
                        props.minWidth ?? 120,
                        props.width ?? platform.sidebar.defaultWidth,
                      ),
                    ),
              maxWidth: '100%',
              ...(props.position === 'right'
                ? { borderLeftWidth: StyleSheet.hairlineWidth }
                : { borderRightWidth: StyleSheet.hairlineWidth }),
            }
          : { borderBottomWidth: StyleSheet.hairlineWidth },
        props.barStyle,
      ]}
    >
      <ScrollView
        horizontal={!sidebar}
        contentContainerStyle={[
          !sidebar && styles.tabItems,
          props.barContentStyle,
        ]}
      >
        {visibleItems.map((item, index) => {
          const { route, options, definition } = item;
          const selected = route.key === state.activeRouteKey;
          const section = definition.section;

          return (
            <React.Fragment key={route.key}>
              {sidebar &&
                !collapsed &&
                section?.title &&
                visibleItems[index - 1]?.definition.section?.key !==
                  section.key && (
                  <View style={[props.sectionStyle, section.style]}>
                    {section.renderTitle ? (
                      section.renderTitle({ title: section.title })
                    ) : (
                      <Text
                        accessibilityRole="header"
                        style={[
                          styles.section,
                          { color: colors.mutedText },
                          props.sectionTitleStyle,
                          section.titleStyle,
                        ]}
                      >
                        {section.title}
                      </Text>
                    )}
                  </View>
                )}
              <NavigationItem
                route={route}
                options={options}
                selected={selected}
                focused={focusedKey === route.key}
                collapsed={collapsed}
                sidebar={sidebar}
                itemRef={(value) => {
                  if (value) refs.current.set(route.key, value);
                  else refs.current.delete(route.key);
                }}
                onFocus={() => {
                  setFocusedKey(route.key);
                  store.setFocusedNode(id);
                }}
                onBlur={() =>
                  setFocusedKey((current) =>
                    current === route.key ? '' : current,
                  )
                }
                onPress={() => {
                  store.setFocusedNode(id);
                  navigation.select(route.name);
                }}
              />
            </React.Fragment>
          );
        })}
      </ScrollView>
      {sidebar && footer != null && footer !== false && (
        <View testID="sidebar-footer" style={props.sidebarFooterStyle}>
          {footer}
        </View>
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
        <View style={[styles.content, props.contentStyle]}>
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
  section: { padding: 10, fontSize: 12, fontWeight: '600' },
});
