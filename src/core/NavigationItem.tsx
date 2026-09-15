import React from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import type { NavigationRoute } from '../routers';
import type { FocusTarget } from './focus';
import type {
  NavigationItemState,
  NavigationItemStyle,
  SidebarScreenOptions,
} from './types';
import { useNavigationTheme } from './context';

function resolveStyle<T extends ViewStyle | TextStyle>(
  style: NavigationItemStyle<T> | undefined,
  state: NavigationItemState,
) {
  return typeof style === 'function' ? style(state) : style;
}
export interface NavigationItemProps {
  route: NavigationRoute;
  options: SidebarScreenOptions;
  selected: boolean;
  focused: boolean;
  collapsed: boolean;
  sidebar: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onPress: () => void;
  itemRef: (target: FocusTarget | null) => void;
}
/** The interactive shell remains owned by navigation when its content is customized. */
export function NavigationItem({
  route,
  options,
  selected,
  focused,
  collapsed,
  sidebar,
  onFocus,
  onBlur,
  onPress,
  itemRef,
}: NavigationItemProps) {
  const { colors } = useNavigationTheme();
  const [pressed, setPressed] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const state: NavigationItemState = {
    selected,
    focused,
    collapsed,
    hovered,
    pressed: pressed && !options.disabled,
    disabled: !!options.disabled,
  };
  const label = options.label ?? options.title ?? route.name;
  const content = (
    <>
      {options.icon != null && (
        <View style={resolveStyle(options.iconContainerStyle, state)}>
          {typeof options.icon === 'function'
            ? options.icon({ focused: selected, disabled: state.disabled })
            : options.icon}
        </View>
      )}
      {(!collapsed || !options.icon) && (
        <Text
          numberOfLines={1}
          style={[
            { color: colors.text, flexShrink: 1 },
            resolveStyle(options.labelStyle, state),
          ]}
        >
          {collapsed ? label.slice(0, 1) : label}
        </Text>
      )}
      {!collapsed &&
        options.badge != null &&
        (typeof options.badge === 'string' ||
        typeof options.badge === 'number' ? (
          <Text
            style={[
              { color: colors.mutedText },
              resolveStyle(options.badgeStyle, state),
            ]}
          >
            {options.badge}
          </Text>
        ) : (
          options.badge
        ))}
    </>
  );
  return (
    <Pressable
      ref={(target) => itemRef(target as unknown as FocusTarget | null)}
      accessible
      focusable={!options.disabled}
      disabled={options.disabled}
      accessibilityRole={sidebar ? 'menuitem' : 'tab'}
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: state.disabled }}
      onFocus={onFocus}
      onBlur={() => {
        setPressed(false);
        onBlur();
      }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        navigationItemStyle,
        {
          opacity: state.disabled ? 0.45 : 1,
          backgroundColor: selected ? colors.selectedBackground : 'transparent',
          borderColor: focused ? colors.accent : 'transparent',
        },
        resolveStyle(options.itemStyle, state),
      ]}
    >
      {options.renderItemContent
        ? options.renderItemContent({
            ...state,
            route,
            label,
            children: content,
          })
        : content}
    </Pressable>
  );
}
export const navigationItemStyle = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    margin: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
}).item;
