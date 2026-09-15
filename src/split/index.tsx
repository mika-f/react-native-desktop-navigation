import React from 'react';
import {
  PanResponder,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { splitColumnConfig, type SplitNavigationState } from '../routers';
import { NavigatorStateContext, useNavigator } from '../core/builder';
import { Scene } from '../core/Scene';
import { SplitColumnContext, useNavigationTheme } from '../core/context';
import { consumeKey, DesktopView, eventHandled } from '../platform';
export interface SplitColumnProps {
  id: string;
  component: React.ComponentType;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  /** Follow a directly nested Sidebar when it collapses (default: true). */
  collapsible?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Hide the entire resize handle, including its space and keyboard target. */
  dividerShown?: boolean;
  dividerStyle?: SplitDividerStyle;
  renderDivider?: (props: SplitDividerRenderProps) => React.ReactNode;
}
export interface SplitDividerRenderProps {
  columnId: string;
  width: number;
  dragging: boolean;
}
export type SplitDividerStyle =
  | StyleProp<ViewStyle>
  | ((props: SplitDividerRenderProps) => StyleProp<ViewStyle>);
export interface SplitNavigatorProps {
  children: React.ReactNode;
  id?: string;
  style?: StyleProp<ViewStyle>;
  columnStyle?: StyleProp<ViewStyle>;
  /** Hide the entire resize handle, including its space and keyboard target. */
  dividerShown?: boolean;
  dividerStyle?: SplitDividerStyle;
  renderDivider?: (props: SplitDividerRenderProps) => React.ReactNode;
  layout?: (size: { width: number; height: number }) => string[];
  onColumnResize?: (id: string, width: number) => void;
}
function Divider({
  column,
  width,
  resize,
  style,
  renderContent,
  onWidthChange,
}: {
  column: SplitColumnProps;
  width: number;
  resize: (width: number) => void;
  style?: SplitDividerStyle;
  renderContent?: (props: SplitDividerRenderProps) => React.ReactNode;
  onWidthChange: (width: number) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
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
          setDragging(true);
        },
        onPanResponderMove: (_, gesture) =>
          latest.current.resize(start.current + gesture.dx),
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );
  const { colors } = useNavigationTheme();
  const context = { columnId: column.id, width, dragging };
  return (
    <DesktopView
      {...responder.panHandlers}
      testID={`split-divider-${column.id}`}
      onLayout={(event) => onWidthChange(event.nativeEvent.layout.width)}
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
      style={[
        { width: 6, backgroundColor: colors.border },
        typeof style === 'function' ? style(context) : style,
        typeof column.dividerStyle === 'function'
          ? column.dividerStyle(context)
          : column.dividerStyle,
      ]}
    >
      {(column.renderDivider ?? renderContent)?.(context)}
    </DesktopView>
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
    const [dividerWidths, setDividerWidths] = React.useState<
      Record<string, number>
    >({});
    const [collapsedWidths, setCollapsedWidths] = React.useState<
      Record<string, number | null>
    >({});
    const onSidebarChange = React.useCallback(
      (columnId: string, width: number | null) => {
        setCollapsedWidths((previous) => {
          if (previous[columnId] === width) return previous;
          return { ...previous, [columnId]: width };
        });
      },
      [],
    );
    const layout = props.layout;
    const dividerSpace = (ids: string[]) =>
      ids.slice(0, -1).reduce((total, columnId) => {
        const column = columns.find((c) => c.id === columnId);
        return (
          total +
          ((column?.dividerShown ?? props.dividerShown ?? true)
            ? (dividerWidths[columnId] ?? 6)
            : 0)
        );
      }, 0);
    React.useLayoutEffect(() => {
      const ids = size
        ? layout
          ? layout(size)
          : columns.map((c) => c.id)
        : state.visibleColumnIds;
      const before = store.getNode(id)!.state as SplitNavigationState;
      store.dispatch({
        target: id,
        type: 'layout',
        payload: {
          ids,
          availableWidth: size ? size.width - dividerSpace(ids) : undefined,
          collapsedWidths: Object.fromEntries(
            columns
              .filter((c) => c.collapsible === false || c.id in collapsedWidths)
              .map((c) => [
                c.id,
                c.collapsible === false ? null : collapsedWidths[c.id],
              ]),
          ),
        },
      });
      const after = store.getNode(id)!.state as SplitNavigationState;
      if (before.collapsedColumns !== after.collapsedColumns) {
        for (const columnId of Object.keys(after.widths)) {
          if (before.widths[columnId] !== after.widths[columnId])
            props.onColumnResize?.(columnId, after.widths[columnId]);
        }
      }
    });
    const ordered = [
      ...state.visibleColumnIds,
      ...columns
        .filter((c) => !state.visibleColumnIds.includes(c.id))
        .map((c) => c.id),
    ];
    return (
      <NavigatorStateContext.Provider value={state}>
        <View style={[styles.split, props.style]}>
          <View
            testID="split-layout"
            style={styles.row}
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
              const constraints = splitColumnConfig(state, {
                ...column,
                name: columnId,
              });
              const route = state.routes.find((r) => r.name === columnId)!;
              const visible = state.visibleColumnIds.includes(columnId);
              const last =
                columnId ===
                state.visibleColumnIds[state.visibleColumnIds.length - 1];
              const resize = (width: number) => {
                const before = store.getNode(id)!.state as SplitNavigationState;
                store.dispatch({
                  target: id,
                  // Native layout precedes input. The fallback supports pre-layout imperative use.
                  type: size ? 'resizeBoundary' : 'resize',
                  payload: { id: columnId, width },
                });
                const after = store.getNode(id)!.state as SplitNavigationState;
                for (const changedId of after.visibleColumnIds) {
                  if (before.widths[changedId] !== after.widths[changedId])
                    props.onColumnResize?.(changedId, after.widths[changedId]);
                }
              };
              return (
                <React.Fragment key={route.key}>
                  <View
                    testID={`split-column-${columnId}`}
                    style={[
                      props.columnStyle,
                      column.style,
                      {
                        overflow: 'hidden',
                        width: state.widths[columnId],
                        minWidth: constraints.minWidth ?? 100,
                        maxWidth: constraints.maxWidth,
                        flexBasis: 'auto',
                        flexGrow:
                          !size && last && !state.collapsedColumns?.[columnId]
                            ? 1
                            : 0,
                        flexShrink: 0,
                      },
                      !visible && { display: 'none' },
                    ]}
                  >
                    <SplitColumnContext.Provider
                      value={{ nodeId: id, columnId, onSidebarChange }}
                    >
                      <Scene
                        nodeId={id}
                        route={route}
                        component={column.component}
                        visible={visible}
                        options={{
                          inactiveBehavior: 'keep',
                          focusBehavior: 'none',
                          contentStyle: column.contentStyle,
                        }}
                      />
                    </SplitColumnContext.Provider>
                  </View>
                  {visible &&
                    !last &&
                    (column.dividerShown ?? props.dividerShown ?? true) && (
                      <Divider
                        column={{
                          ...column,
                          minWidth: constraints.minWidth,
                          maxWidth: constraints.maxWidth,
                        }}
                        width={state.widths[columnId]}
                        resize={resize}
                        style={props.dividerStyle}
                        renderContent={props.renderDivider}
                        onWidthChange={(width) => {
                          if (!Number.isFinite(width) || width < 0) return;
                          setDividerWidths((previous) =>
                            previous[columnId] === width
                              ? previous
                              : { ...previous, [columnId]: width },
                          );
                        }}
                      />
                    )}
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </NavigatorStateContext.Provider>
    );
  }
  return { Navigator, Column };
}
const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  row: { flex: 1, minWidth: 0, flexDirection: 'row', overflow: 'hidden' },
});
