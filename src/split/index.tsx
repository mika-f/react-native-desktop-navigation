import React from 'react';
import {
  PanResponder,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { type SplitNavigationState } from '../routers';
import { NavigatorStateContext, useNavigator } from '../core/builder';
import { Scene } from '../core/Scene';
import { useNavigationTheme } from '../core/context';
import { consumeKey, DesktopView, eventHandled } from '../platform';
export interface SplitColumnProps {
  id: string;
  component: React.ComponentType;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  collapsible?: boolean;
}
export interface SplitNavigatorProps {
  children: React.ReactNode;
  id?: string;
  style?: StyleProp<ViewStyle>;
  layout?: (size: { width: number; height: number }) => string[];
  onColumnResize?: (id: string, width: number) => void;
}
function Divider({
  column,
  width,
  resize,
}: {
  column: SplitColumnProps;
  width: number;
  resize: (width: number) => void;
}) {
  const start = React.useRef(width);
  const latest = React.useRef({ width, resize });
  latest.current = { width, resize };
  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = latest.current.width;
        },
        onPanResponderMove: (_, gesture) =>
          latest.current.resize(start.current + gesture.dx),
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );
  const { colors } = useNavigationTheme();
  return (
    <DesktopView
      {...responder.panHandlers}
      testID={`split-divider-${column.id}`}
      accessible
      focusable
      accessibilityRole="adjustable"
      accessibilityLabel={`Resize ${column.id}`}
      accessibilityValue={{
        min: column.minWidth ?? 100,
        max: column.maxWidth,
        now: width,
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        resize(
          width + (event.nativeEvent.actionName === 'increment' ? 10 : -10),
        )
      }
      keyDownEvents={[{ key: 'ArrowLeft' }, { key: 'ArrowRight' }]}
      onKeyDown={(event) => {
        if (
          !eventHandled(event) &&
          ['ArrowLeft', 'ArrowRight'].includes(event.nativeEvent.key)
        ) {
          resize(width + (event.nativeEvent.key === 'ArrowRight' ? 10 : -10));
          consumeKey(event);
        }
      }}
      style={{ width: 6, backgroundColor: colors.border }}
    />
  );
}
export function createSplitNavigator() {
  function Column(_props: SplitColumnProps) {
    return null;
  }
  function Navigator(props: SplitNavigatorProps) {
    const columns: SplitColumnProps[] = [];
    React.Children.forEach(props.children, (child) => {
      if (child == null || typeof child === 'boolean') return;
      if (!React.isValidElement(child) || child.type !== Column)
        throw new Error(
          'Split.Navigator children must be Split.Column elements.',
        );
      columns.push(child.props as SplitColumnProps);
    });
    const { id, state, store } = useNavigator<SplitNavigationState>(
      'split',
      { routes: columns.map((c) => ({ ...c, name: c.id })) },
      props.id,
    );
    const [size, setSize] = React.useState<{
      width: number;
      height: number;
    } | null>(null);
    const layout = props.layout;
    React.useLayoutEffect(() => {
      if (size)
        store.dispatch({
          target: id,
          type: 'layout',
          payload: { ids: layout ? layout(size) : columns.map((c) => c.id) },
        });
    }, [size, layout, id, store]);
    const ordered = [
      ...state.visibleColumnIds,
      ...columns
        .filter((c) => !state.visibleColumnIds.includes(c.id))
        .map((c) => c.id),
    ];
    return (
      <NavigatorStateContext.Provider value={state}>
        <View
          style={[styles.split, props.style]}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setSize((previous) =>
              previous?.width === width && previous.height === height
                ? previous
                : { width, height },
            );
          }}
        >
          {ordered.map((columnId) => {
            const column = columns.find((c) => c.id === columnId)!;
            const route = state.routes.find((r) => r.name === columnId)!;
            const visible = state.visibleColumnIds.includes(columnId);
            const last =
              columnId ===
              state.visibleColumnIds[state.visibleColumnIds.length - 1];
            const resize = (width: number) => {
              store.dispatch({
                target: id,
                type: 'resize',
                payload: { id: columnId, width },
              });
              props.onColumnResize?.(
                columnId,
                (store.getNode(id)!.state as SplitNavigationState).widths[
                  columnId
                ],
              );
            };
            return (
              <React.Fragment key={route.key}>
                <View
                  testID={`split-column-${columnId}`}
                  style={[
                    {
                      width: state.widths[columnId],
                      minWidth: column.minWidth ?? 100,
                      maxWidth: column.maxWidth,
                      flexGrow: last ? 1 : 0,
                      flexShrink: 0,
                    },
                    !visible && { display: 'none' },
                  ]}
                >
                  <Scene
                    nodeId={id}
                    route={route}
                    component={column.component}
                    visible={visible}
                    options={{
                      inactiveBehavior: 'keep',
                      focusBehavior: 'none',
                    }}
                  />
                </View>
                {visible && !last && (
                  <Divider
                    column={column}
                    width={state.widths[columnId]}
                    resize={resize}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </NavigatorStateContext.Provider>
    );
  }
  return { Navigator, Column };
}
const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
});
