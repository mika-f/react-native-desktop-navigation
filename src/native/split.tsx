import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { splitColumnConfig, type SplitNavigationState } from '../routers';
import { useNavigator, NavigatorStateContext } from '../core/builder';
import { Scene } from '../core/Scene';
import { ScopeContext, SplitColumnContext } from '../core/context';
import { NativeSurface, type NativeAppearance } from './host';

export interface NativeSplitColumnProps {
  id: string;
  component: React.ComponentType;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}
export interface NativeSplitNavigatorProps {
  children: React.ReactNode;
  id?: string;
  style?: StyleProp<ViewStyle>;
  appearance?: NativeAppearance;
  layout?: (size: { width: number; height: number }) => string[];
  onColumnResize?: (id: string, width: number) => void;
}
export function createSplitNavigator() {
  function Column(_props: NativeSplitColumnProps) {
    return null;
  }
  function Navigator(props: NativeSplitNavigatorProps) {
    const columns: NativeSplitColumnProps[] = [];
    React.Children.forEach(props.children, (child) => {
      if (child == null || typeof child === 'boolean') return;
      if (!React.isValidElement(child) || child.type !== Column)
        throw new Error(
          'Split.Navigator children must be Split.Column elements.',
        );
      columns.push(child.props as NativeSplitColumnProps);
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
    React.useLayoutEffect(() => {
      if (!size) return;
      const ids = props.layout ? props.layout(size) : columns.map((c) => c.id);
      store.dispatch({ type: 'layout', target: id, payload: { ids } });
    });
    return (
      <NavigatorStateContext.Provider value={state}>
        <NativeSurface
          style={props.style}
          onMeasurements={(frames) => {
            const before = store.getNode(id)?.state as
              | SplitNavigationState
              | undefined;
            if (!before) return;
            const widths = Object.fromEntries(
              before.visibleColumnIds
                .filter((key) => frames[key]?.width > 0)
                .map((key) => [key, frames[key].width]),
            );
            store.dispatch({
              type: 'layout',
              target: id,
              payload: { ids: before.visibleColumnIds, widths },
            });
            const after = store.getNode(id)!.state as SplitNavigationState;
            for (const key of before.visibleColumnIds)
              if (after.widths[key] !== before.widths[key])
                props.onColumnResize?.(key, after.widths[key]);
          }}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setSize((previous) =>
              previous?.width === width && previous.height === height
                ? previous
                : { width, height },
            );
          }}
          configuration={{
            mode: 'split',
            items: columns.map((c) => ({ key: c.id, title: c.id })),
            activeKey: state.activeRouteKey,
            appearance: props.appearance,
            columns: state.visibleColumnIds.map((key) => {
              const c = columns.find((c) => c.id === key)!;
              const constraints = splitColumnConfig(state, {
                ...c,
                name: c.id,
              });
              return {
                key,
                width: state.widths[key],
                minWidth: constraints.minWidth ?? 100,
                maxWidth: constraints.maxWidth,
              };
            }),
          }}
          onRequest={(request) => {
            if (
              request.type !== 'resize' ||
              !state.visibleColumnIds.includes(request.key)
            )
              return;
            const before = store.getNode(id)!.state as SplitNavigationState;
            store.dispatch({
              type: 'resize',
              target: id,
              payload: { id: request.key, width: request.width },
            });
            const after = store.getNode(id)!.state as SplitNavigationState;
            if (before.widths[request.key] !== after.widths[request.key])
              props.onColumnResize?.(request.key, after.widths[request.key]);
          }}
          slots={state.routes.map((route) => {
            const column = columns.find((c) => c.id === route.name)!;
            if (!column)
              throw new Error(
                `Missing Column: ${route.name}. Remount to change the column list.`,
              );
            const visible = state.visibleColumnIds.includes(route.name);
            return {
              key: route.name,
              visible,
              content: (ready) => (
                <SplitColumnContext.Provider value={null}>
                  <ScopeContext.Provider
                    value={{ nodeId: id, routeKey: route.key }}
                  >
                    <View style={[{ flex: 1 }, column.style]}>
                      <Scene
                        focusReady={ready}
                        nodeId={id}
                        route={route}
                        component={column.component}
                        visible={visible}
                        options={{
                          focusBehavior: 'none',
                          inactiveBehavior: 'keep',
                          contentStyle: column.contentStyle,
                        }}
                      />
                    </View>
                  </ScopeContext.Provider>
                </SplitColumnContext.Provider>
              ),
            };
          })}
        />
      </NavigatorStateContext.Provider>
    );
  }
  return { Navigator, Column };
}
