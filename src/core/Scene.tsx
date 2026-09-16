import React from 'react';
import {
  Animated,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { NavigationRoute } from '../routers';
import { DesktopView } from '../platform';
import {
  PlatformContext,
  ScopeContext,
  ScreenContext,
  useStore,
  useNavigationTheme,
} from './context';
import { createNavigation } from './navigation';
import { FocusContext, type FocusRegistry, type FocusTarget } from './focus';
import type { CommonScreenOptions, StackAnimation } from './types';
export interface SceneProps {
  nodeId: string;
  route: NavigationRoute;
  component: React.ComponentType<any>;
  visible: boolean;
  /** Native content slots must be laid out before restoring keyboard focus. */
  focusReady?: boolean;
  options: CommonScreenOptions;
  animation?: StackAnimation;
  overlay?: 'modal' | 'dialog';
  overlayStyle?: StyleProp<ViewStyle>;
  dialogStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}
export function Scene({
  nodeId,
  route,
  component: Component,
  visible,
  focusReady = true,
  options,
  animation = 'none',
  overlay,
  overlayStyle,
  dialogStyle,
  children,
}: SceneProps) {
  const store = useStore();
  const { colors } = useNavigationTheme();
  const platform = React.useContext(PlatformContext);
  const snapshot = React.useCallback(
    () => store.isRouteFocused(nodeId, route.key),
    [store, nodeId, route.key],
  );
  const focused = React.useSyncExternalStore(
    store.subscribe,
    snapshot,
    snapshot,
  );
  const navigation = React.useMemo(
    () => createNavigation(store, nodeId, route.key),
    [store, nodeId, route.key],
  );
  const targets = React.useRef(new Map<string, FocusTarget>());
  const last = React.useRef<string | undefined>(undefined);
  const registry = React.useMemo<FocusRegistry>(
    () => ({
      register(id, target) {
        targets.current.set(id, target);
        return () => {
          targets.current.delete(id);
        };
      },
      record(id) {
        last.current = id;
        store.setFocusedNode(nodeId);
      },
    }),
    [store, nodeId],
  );
  const mounted = visible || options.inactiveBehavior !== 'unmount';
  React.useEffect(() => {
    if (!focused || !visible || !focusReady || options.focusBehavior === 'none')
      return;
    const previous =
      options.focusBehavior !== 'first' && last.current
        ? targets.current.get(last.current)
        : undefined;
    (previous ?? targets.current.values().next().value)?.focus();
  }, [focused, visible, focusReady, options.focusBehavior, mounted]);
  const [progress] = React.useState(() => new Animated.Value(1));
  React.useEffect(() => {
    if (!visible || animation === 'none') {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const transition = Animated.timing(progress, {
      toValue: 1,
      duration: platform.defaultTransitions.push.duration,
      // react-native-macos's Fabric/bridgeless host does not reliably
      // connect native-driven Animated values, leaving views stuck at
      // their initial (invisible) frame. Drive this on the JS thread
      // instead so the entrance transition actually completes.
      useNativeDriver: false,
    });
    transition.start();
    return () => transition.stop();
  }, [visible, animation, progress, platform]);
  if (!mounted) return null;
  const offset = platform.defaultTransitions.push.offset;
  const animatedStyle =
    animation === 'none'
      ? undefined
      : {
          opacity: progress,
          transform:
            animation === 'fade'
              ? []
              : [
                  {
                    [animation === 'slide-vertical'
                      ? 'translateY'
                      : 'translateX']: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [offset, 0],
                    }),
                  },
                ],
        };
  return (
    <ScopeContext.Provider value={{ nodeId, routeKey: route.key }}>
      <ScreenContext.Provider value={{ navigation, route, focused }}>
        <FocusContext.Provider value={registry}>
          <DesktopView
            testID={`scene-${route.name}`}
            onFocus={() => store.focusRoute(nodeId, route.key)}
            pointerEvents={visible ? 'auto' : 'none'}
            accessibilityElementsHidden={!visible}
            importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
            accessibilityViewIsModal={!!overlay && visible}
            style={[
              styles.scene,
              options.sceneStyle,
              overlay && styles.overlay,
              overlay === 'dialog' && styles.dialogBackdrop,
              overlay && overlayStyle,
              !visible && styles.hidden,
            ]}
          >
            <Animated.View
              style={[
                styles.content,
                overlay === 'dialog' && [
                  styles.dialog,
                  { backgroundColor: colors.surface },
                ],
                options.contentStyle,
                overlay === 'dialog' && dialogStyle,
                animatedStyle as never,
              ]}
            >
              {children}
              <Component navigation={navigation} route={route} />
            </Animated.View>
          </DesktopView>
        </FocusContext.Provider>
      </ScreenContext.Provider>
    </ScopeContext.Provider>
  );
}
const styles = StyleSheet.create({
  scene: { flex: 1 },
  content: { flex: 1 },
  hidden: { display: 'none' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 1,
  },
  dialogBackdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  dialog: {
    flex: 0,
    width: '80%',
    maxWidth: 640,
    maxHeight: '90%',
    minHeight: 160,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
