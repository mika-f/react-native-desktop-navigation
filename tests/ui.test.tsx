import React from 'react';
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestInstance,
} from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { Pressable, Text, StyleSheet } from 'react-native';
import { nativeFocus } from './react-native';
import {
  NavigationContainer,
  createNavigationRef,
  createStackNavigator,
  createSidebarNavigator,
  createTabNavigator,
  createSplitNavigator,
  NavigationFocusable,
  useFocusEffect,
  useNavigationState,
  serializeNavigationState,
  macosAdapter,
  windowsAdapter,
  type StackScreenProps,
  type StackNavigation,
  type NavigationAction,
} from '../src';
let renderer: ReactTestRenderer;
function render(element: React.ReactElement) {
  act(() => {
    renderer = create(element);
  });
  return renderer;
}
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  nativeFocus.mockClear();
});
const native = (name: string) =>
  renderer.root.findAll((node) => node.type === name);
const button = (label: string) =>
  native('Pressable').find((n) => n.props.accessibilityLabel === label)!;
const click = (label: string) => act(() => button(label).props.onPress());
const key = (node: ReactTestInstance, name: string, modifiers = {}) => {
  const event = {
    nativeEvent: { key: name, ...modifiers },
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  };
  act(() => node.props.onKeyDown(event));
  return event;
};
function rootKeys() {
  return native('View').find(
    (n) => n.props.keyDownEvents && !n.props.accessibilityRole,
  )!;
}
const Stack = createStackNavigator<{
  Home: undefined;
  Post: { id: string };
  Profile: { userId: string };
}>();
const ref = () =>
  createNavigationRef<{
    Home: undefined;
    Post: { id: string };
    Profile: { userId: string };
  }>();
function Post({
  route,
  navigation,
}: StackScreenProps<
  { Home: undefined; Post: { id: string }; Profile: { userId: string } },
  'Post'
>) {
  return (
    <Pressable
      accessibilityLabel={`Post ${route.params.id}`}
      onPress={() => navigation.push('Profile', { userId: '42' })}
    >
      <Text>Open profile</Text>
    </Pressable>
  );
}
it('navigates with typed params and supports Back through a nested stack', () => {
  const Root = createStackNavigator<{ Main: undefined; About: undefined }>();
  const rootRef = createNavigationRef<{ Main: undefined; About: undefined }>();
  function Home({
    navigation,
  }: StackScreenProps<
    { Home: undefined; Post: { id: string }; Profile: { userId: string } },
    'Home'
  >) {
    return (
      <Pressable
        accessibilityLabel="Open post"
        onPress={() => navigation.push('Post', { id: '123' })}
      />
    );
  }
  function Main() {
    return (
      <Stack.Navigator screenOptions={{ animation: 'none' }}>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Post" component={Post} />
        <Stack.Screen
          name="Profile"
          component={({ route }) => <Text>{route.params.userId}</Text>}
        />
      </Stack.Navigator>
    );
  }
  render(
    <NavigationContainer ref={rootRef}>
      <Root.Navigator screenOptions={{ animation: 'none' }}>
        <Root.Screen name="Main" component={Main} />
        <Root.Screen name="About" component={() => <Text>About</Text>} />
      </Root.Navigator>
    </NavigationContainer>,
  );
  click('Open post');
  click('Post 123');
  const active = () => {
    const s = rootRef.getRootState()!;
    const child = Object.values(s.nodes).find((n) => n.parentId === 'root')!;
    return child.state.routes.at(-1)!.name;
  };
  expect(active()).toBe('Profile');
  act(() => rootRef.goBack());
  expect(active()).toBe('Post');
  act(() => rootRef.goBack());
  expect(active()).toBe('Home');
  expect(rootRef.canGoBack()).toBe(false);
  act(() => rootRef.navigate('About'));
  expect(rootRef.getRootState()!.nodes.root.state.routes.at(-1)!.name).toBe(
    'About',
  );
});
it.each(['keep', 'unmount'] as const)(
  'implements inactiveBehavior=%s and focus-effect cleanup',
  (behavior) => {
    const nav = ref();
    const events: string[] = [];
    function Home() {
      const [count, setCount] = React.useState(0);
      useFocusEffect(
        React.useCallback(() => {
          events.push('focus');
          return () => {
            events.push('blur');
          };
        }, []),
      );
      const name = useNavigationState((s) => s.type);
      return (
        <Pressable
          accessibilityLabel={`count ${count}`}
          onPress={() => setCount((c) => c + 1)}
        >
          <Text>{name}</Text>
        </Pressable>
      );
    }
    render(
      <NavigationContainer ref={nav}>
        <Stack.Navigator
          screenOptions={{ animation: 'none', inactiveBehavior: behavior }}
        >
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Post" component={Post} />
        </Stack.Navigator>
      </NavigationContainer>,
    );
    click('count 0');
    expect(button('count 1')).toBeDefined();
    act(() => nav.navigate('Post', { id: '1' }));
    expect(events).toEqual(['focus', 'blur']);
    if (behavior === 'unmount') expect(button('count 1')).toBeUndefined();
    act(() => nav.goBack());
    expect(button(behavior === 'keep' ? 'count 1' : 'count 0')).toBeDefined();
    expect(events).toEqual(['focus', 'blur', 'focus']);
  },
);
it('restores the last registered native focus target on return', () => {
  const nav = ref();
  function Home() {
    return (
      <>
        <NavigationFocusable id="first">
          <Pressable accessibilityLabel="first" />
        </NavigationFocusable>
        <NavigationFocusable id="second">
          <Pressable accessibilityLabel="second" />
        </NavigationFocusable>
      </>
    );
  }
  render(
    <NavigationContainer ref={nav}>
      <Stack.Navigator screenOptions={{ animation: 'none' }}>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Post" component={Post} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  expect(nativeFocus).toHaveBeenCalledWith('first');
  act(() => button('second').props.onFocus({}));
  act(() => nav.navigate('Post', { id: '1' }));
  nativeFocus.mockClear();
  act(() => nav.goBack());
  expect(nativeFocus).toHaveBeenCalledWith('second');
});
it('supports Sidebar sections, skipped items, keyboard activation, and collapse', () => {
  const Sidebar = createSidebarNavigator<{
    A: undefined;
    Disabled: undefined;
    Hidden: undefined;
    B: undefined;
  }>();
  render(
    <NavigationContainer>
      <Sidebar.Navigator>
        <Sidebar.Section title="Library">
          <Sidebar.Screen name="A" component={() => null} />
          <Sidebar.Screen
            name="Disabled"
            component={() => null}
            options={{ disabled: true }}
          />
          <Sidebar.Screen
            name="Hidden"
            component={() => null}
            options={{ hidden: true }}
          />
          <Sidebar.Screen
            name="B"
            component={() => null}
            options={{ badge: 2 }}
          />
        </Sidebar.Section>
      </Sidebar.Navigator>
    </NavigationContainer>,
  );
  const rail = () =>
    native('View').find((n) => n.props.accessibilityRole === 'menu')!;
  expect(button('Hidden')).toBeUndefined();
  expect(button('Disabled').props.accessibilityState.disabled).toBe(true);
  key(rail(), 'ArrowDown');
  expect(nativeFocus).toHaveBeenCalledWith('B');
  key(rail(), 'Enter');
  expect(button('B').props.accessibilityState.selected).toBe(true);
  key(rail(), 'Home');
  key(rail(), 'Enter');
  expect(button('A').props.accessibilityState.selected).toBe(true);
  key(rail(), 'End');
  key(rail(), 'Enter');
  expect(button('B').props.accessibilityState.selected).toBe(true);
  key(rail(), 'ArrowUp');
  key(rail(), 'Enter');
  expect(button('A').props.accessibilityState.selected).toBe(true);
  click('Collapse sidebar');
  expect(StyleSheet.flatten(rail().props.style).width).toBe(56);
});
it('switches Tabs from the focused content with Ctrl+Tab and Ctrl+Shift+Tab', () => {
  const Tabs = createTabNavigator<{ A: undefined; B: undefined }>();
  render(
    <NavigationContainer>
      <Tabs.Navigator>
        <Tabs.Screen name="A" component={() => null} />
        <Tabs.Screen name="B" component={() => null} />
      </Tabs.Navigator>
    </NavigationContainer>,
  );
  key(rootKeys(), 'Tab', { ctrlKey: true });
  expect(button('B').props.accessibilityState.selected).toBe(true);
  key(rootKeys(), 'Tab', { ctrlKey: true, shiftKey: true });
  expect(button('A').props.accessibilityState.selected).toBe(true);
});
it.each([
  { adapter: macosAdapter, key: '[', modifiers: { metaKey: true } },
  { adapter: windowsAdapter, key: 'ArrowLeft', modifiers: { altKey: true } },
])(
  'handles platform Back shortcuts and respects handled/editing events',
  ({ adapter, key: name, modifiers }) => {
    const nav = ref();
    render(
      <NavigationContainer ref={nav} platformAdapter={adapter}>
        <Stack.Navigator screenOptions={{ animation: 'none' }}>
          <Stack.Screen name="Home" component={() => null} />
          <Stack.Screen name="Post" component={Post} />
        </Stack.Navigator>
      </NavigationContainer>,
    );
    act(() => nav.navigate('Post', { id: '1' }));
    expect(
      key(rootKeys(), name, { ...modifiers, handled: true }).stopPropagation,
    ).not.toHaveBeenCalled();
    expect(nav.canGoBack()).toBe(true);
    expect(
      key(rootKeys(), name, { ...modifiers, isTextInput: true })
        .stopPropagation,
    ).not.toHaveBeenCalled();
    expect(nav.canGoBack()).toBe(true);
    expect(key(rootKeys(), name, modifiers).stopPropagation).toHaveBeenCalled();
    expect(nav.canGoBack()).toBe(false);
  },
);
it('can disable all global shortcuts', () => {
  const nav = ref();
  render(
    <NavigationContainer ref={nav} keyboardShortcuts={false}>
      <Stack.Navigator screenOptions={{ animation: 'none' }}>
        <Stack.Screen name="Home" component={() => null} />
        <Stack.Screen name="Post" component={Post} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  act(() => nav.navigate('Post', { id: '1' }));
  key(rootKeys(), '[', { metaKey: true });
  expect(nav.canGoBack()).toBe(true);
});
it('resizes Split by mouse drag and retains mounted state when columns hide and reappear', () => {
  const Split = createSplitNavigator();
  const resize = vi.fn();
  const mounts = vi.fn();
  function Sidebar() {
    React.useEffect(() => {
      mounts();
    }, []);
    return <Text>Sidebar</Text>;
  }
  const layout = ({ width }: { width: number }) =>
    width < 700 ? ['content'] : ['sidebar', 'content'];
  render(
    <NavigationContainer>
      <Split.Navigator layout={layout} onColumnResize={resize}>
        <Split.Column
          id="sidebar"
          component={Sidebar}
          minWidth={180}
          maxWidth={320}
        />
        <Split.Column id="content" component={() => null} minWidth={320} />
      </Split.Navigator>
    </NavigationContainer>,
  );
  const split = () =>
    native('View').find((n) => typeof n.props.onLayout === 'function')!;
  const divider = () =>
    native('View').find((n) => n.props.testID === 'split-divider-sidebar')!;
  act(() => divider().props.onResponderGrant({}));
  act(() => divider().props.onResponderMove({ nativeEvent: { dx: 500 } }));
  expect(resize).toHaveBeenLastCalledWith('sidebar', 320);
  act(() =>
    split().props.onLayout({
      nativeEvent: { layout: { width: 600, height: 800 } },
    }),
  );
  expect(divider()).toBeUndefined();
  expect(
    StyleSheet.flatten(
      native('View').find((n) => n.props.testID === 'split-column-sidebar')!
        .props.style,
    ).display,
  ).toBe('none');
  act(() =>
    split().props.onLayout({
      nativeEvent: { layout: { width: 1000, height: 800 } },
    }),
  );
  expect(divider()).toBeDefined();
  expect(mounts).toHaveBeenCalledOnce();
  expect(divider().props.accessibilityValue.now).toBe(320);
});
it('restores nested screen state after saving and remounting the container', () => {
  const nav = ref();
  const tree = (initialState?: ReturnType<typeof nav.getRootState>) => (
    <NavigationContainer ref={nav} initialState={initialState}>
      <Stack.Navigator screenOptions={{ animation: 'none' }}>
        <Stack.Screen name="Home" component={() => null} />
        <Stack.Screen name="Post" component={Post} />
      </Stack.Navigator>
    </NavigationContainer>
  );
  expect(nav.isReady()).toBe(false);
  nav.navigate('Post', { id: 'ignored' });
  render(tree());
  expect(nav.isReady()).toBe(true);
  act(() => nav.navigate('Post', { id: 'saved' }));
  const snapshot = JSON.parse(serializeNavigationState(nav.getRootState()!));
  act(() => renderer.unmount());
  expect(nav.isReady()).toBe(false);
  render(tree(snapshot));
  expect(button('Post saved')).toBeDefined();
});
it('blocks Back using a screen listener', () => {
  const nav = ref();
  let allow = false;
  function Protected({ navigation }: { navigation: StackNavigation<any> }) {
    React.useEffect(
      () =>
        navigation.addListener('beforeRemove', (event) => {
          if (!allow) event.preventDefault();
        }),
      [navigation],
    );
    return null;
  }
  render(
    <NavigationContainer ref={nav}>
      <Stack.Navigator screenOptions={{ animation: 'none' }}>
        <Stack.Screen name="Home" component={() => null} />
        <Stack.Screen name="Post" component={Protected} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  act(() => nav.navigate('Post', { id: '1' }));
  act(() => nav.goBack());
  expect(nav.canGoBack()).toBe(true);
  allow = true;
  act(() => nav.goBack());
  expect(nav.canGoBack()).toBe(false);
});
it('is stable under StrictMode effect replay', () => {
  const nav = ref();
  render(
    <React.StrictMode>
      <NavigationContainer ref={nav}>
        <Stack.Navigator screenOptions={{ animation: 'none' }}>
          <Stack.Screen name="Home" component={() => null} />
          <Stack.Screen name="Post" component={Post} />
        </Stack.Navigator>
      </NavigationContainer>
    </React.StrictMode>,
  );
  expect(nav.isReady()).toBe(true);
  act(() => nav.navigate('Post', { id: 'strict' }));
  expect(button('Post strict')).toBeDefined();
});
it('restores nested navigator state across unmount and full snapshot restore', () => {
  const Root = createStackNavigator<{ Main: undefined; About: undefined }>();
  const nav = createNavigationRef<{ Main: undefined; About: undefined }>();
  let childNavigation: StackNavigation<any>;
  function Home({ navigation }: { navigation: StackNavigation<any> }) {
    childNavigation = navigation;
    return null;
  }
  function Main() {
    return (
      <Stack.Navigator screenOptions={{ animation: 'none' }}>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Post" component={Post} />
      </Stack.Navigator>
    );
  }
  const tree = (initialState?: ReturnType<typeof nav.getRootState>) => (
    <NavigationContainer ref={nav} initialState={initialState}>
      <Root.Navigator
        screenOptions={{ inactiveBehavior: 'unmount', animation: 'none' }}
      >
        <Root.Screen name="Main" component={Main} />
        <Root.Screen name="About" component={() => null} />
      </Root.Navigator>
    </NavigationContainer>
  );
  render(tree());
  act(() => childNavigation.push('Post', { id: 'nested' }));
  act(() => nav.navigate('About'));
  expect(button('Post nested')).toBeUndefined();
  const saved = JSON.parse(serializeNavigationState(nav.getRootState()!));
  act(() => renderer.unmount());
  render(tree(saved));
  act(() => nav.goBack());
  expect(button('Post nested')).toBeDefined();
  expect(nav.canGoBack()).toBe(true);
  act(() => nav.goBack());
  expect(nav.canGoBack()).toBe(false);
});
it('routes shortcuts to the focused split column after native focus bubbles through ancestors', () => {
  const Split = createSplitNavigator();
  const Root = createStackNavigator<{ Main: undefined }>();
  const nav = createNavigationRef();
  function Left() {
    return (
      <Stack.Navigator id="left">
        <Stack.Screen name="Home" component={() => null} />
        <Stack.Screen name="Post" component={Post} />
      </Stack.Navigator>
    );
  }
  function Right() {
    return (
      <Stack.Navigator id="right">
        <Stack.Screen name="Home" component={() => null} />
        <Stack.Screen name="Post" component={Post} />
      </Stack.Navigator>
    );
  }
  function Main() {
    return (
      <Split.Navigator>
        <Split.Column id="left" component={Left} />
        <Split.Column id="right" component={Right} />
      </Split.Navigator>
    );
  }
  render(
    <NavigationContainer ref={nav}>
      <Root.Navigator>
        <Root.Screen name="Main" component={Main} />
      </Root.Navigator>
    </NavigationContainer>,
  );
  const right = Object.values(nav.getRootState()!.nodes).find(
    (n) => n.id.endsWith('/right') && n.type === 'stack',
  )!;
  act(() =>
    nav.dispatch({
      target: right.id,
      type: 'push',
      payload: { name: 'Post', params: { id: 'right' } },
    }),
  );
  const scene = native('View').find((n) => n.props.testID === 'scene-Post')!;
  act(() => scene.props.onFocus());
  const column = native('View').find((n) => n.props.testID === 'scene-right')!;
  act(() => column.props.onFocus());
  act(() =>
    native('View')
      .find((n) => n.props.testID === 'scene-Main')!
      .props.onFocus(),
  );
  key(rootKeys(), '[', { metaKey: true });
  expect(nav.getRootState()!.nodes[right.id].state.routes).toHaveLength(1);
});
it('updates a newly mounted nested header when only the parent can go back', () => {
  const Root = createStackNavigator<{ Home: undefined; Nested: undefined }>();
  const nav = createNavigationRef<{ Home: undefined; Nested: undefined }>();
  function Nested() {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Home" component={() => null} />
      </Stack.Navigator>
    );
  }
  render(
    <NavigationContainer ref={nav}>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        <Root.Screen name="Home" component={() => null} />
        <Root.Screen name="Nested" component={Nested} />
      </Root.Navigator>
    </NavigationContainer>,
  );
  act(() => nav.navigate('Nested'));
  expect(button('Back')).toBeDefined();
  click('Back');
  expect(nav.canGoBack()).toBe(false);
});
