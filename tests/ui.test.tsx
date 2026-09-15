import React from 'react';
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestInstance,
} from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { Pressable, Text, View, StyleSheet } from 'react-native';
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
  restoreNavigationState,
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
function parentView(node: ReactTestInstance) {
  let parent = node.parent;
  while (parent && String(parent.type) !== 'View') parent = parent.parent;
  if (!parent) throw new Error('Expected a native parent View');
  return parent;
}
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

it('customizes Stack header parts, scene visibility, and themed dialog surfaces', () => {
  const nav = ref();
  render(
    <NavigationContainer
      ref={nav}
      theme={{
        dark: true,
        colors: {
          background: '#101010',
          surface: '#202020',
          text: '#ffffff',
          mutedText: '#aaa',
          border: '#555',
          accent: '#0ff',
          selectedBackground: '#333',
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          animation: 'none',
          headerStyle: { height: 72, backgroundColor: '#123456' },
          headerTitleStyle: { fontSize: 24 },
          headerLeftContainerStyle: { paddingLeft: 20 },
          headerRightContainerStyle: { paddingRight: 22 },
          headerTintColor: '#abcdef',
          headerBackTitle: '戻る',
          headerBackTitleStyle: { fontWeight: '900' },
          headerBackButtonStyle: { padding: 12 },
          sceneStyle: { display: 'flex', padding: 4 },
        }}
      >
        <Stack.Screen name="Home" component={() => null} />
        <Stack.Screen
          name="Post"
          component={Post}
          options={{
            presentation: 'dialog',
            overlayStyle: { backgroundColor: '#0009', padding: 40 },
            dialogStyle: { borderRadius: 20, maxWidth: 480 },
          }}
        />
        <Stack.Screen name="Profile" component={() => null} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  act(() => nav.navigate('Post', { id: 'design' }));
  const back = button('戻る');
  expect(StyleSheet.flatten(back.props.style).padding).toBe(12);
  const backText = back.findAll((n) => String(n.type) === 'Text')[0];
  expect(StyleSheet.flatten(backText.props.style)).toMatchObject({
    color: '#abcdef',
    fontWeight: '900',
  });
  const title = native('Text').find(
    (n) =>
      n.props.accessibilityRole === 'header' && n.props.children === 'Post',
  )!;
  expect(StyleSheet.flatten(title.props.style)).toMatchObject({
    color: '#abcdef',
    fontSize: 24,
  });
  expect(StyleSheet.flatten(parentView(title).props.style)).toMatchObject({
    backgroundColor: '#123456',
    height: 72,
  });
  const scene = native('View').find((n) => n.props.testID === 'scene-Post')!;
  expect(StyleSheet.flatten(scene.props.style)).toMatchObject({
    backgroundColor: '#0009',
    padding: 40,
  });
  const dialog = scene.findAll((n) => String(n.type) === 'AnimatedView')[0];
  expect(StyleSheet.flatten(dialog.props.style)).toMatchObject({
    backgroundColor: '#202020',
    borderRadius: 20,
    maxWidth: 480,
  });
  click('戻る');
  expect(nav.canGoBack()).toBe(false);
  act(() => nav.navigate('Profile', { userId: '1' }));
  expect(
    StyleSheet.flatten(
      native('View').find((n) => n.props.testID === 'scene-Home')!.props.style,
    ).display,
  ).toBe('none');
});

it.each(['sidebar', 'tabs'] as const)(
  'keeps custom %s items interactive and exposes selection, focus, hover, press, and disabled state',
  (type) => {
    const Factory =
      type === 'sidebar' ? createSidebarNavigator : createTabNavigator;
    const Navigator = Factory<{
      A: undefined;
      B: undefined;
      Disabled: undefined;
    }>();
    const seen = vi.fn();
    render(
      <NavigationContainer>
        <Navigator.Navigator
          barStyle={{ backgroundColor: '#234567', padding: 7 }}
          barContentStyle={{ gap: 15 }}
          contentStyle={{ padding: 30 }}
          screenOptions={{
            itemStyle: (state) => ({
              backgroundColor: state.pressed
                ? '#pressed'
                : state.selected
                  ? '#selected'
                  : '#idle',
              borderColor: state.focused ? '#focused' : '#blurred',
              padding: state.hovered ? 21 : 12,
              opacity: state.disabled ? 0.2 : 1,
            }),
            labelStyle: ({ selected }) => ({ fontSize: selected ? 22 : 16 }),
            badgeStyle: { color: '#badge' },
            iconContainerStyle: { marginRight: 9 },
            renderItemContent: (props) => {
              seen(props);
              return (
                <View testID={`custom-${props.route.name}`}>
                  {props.children}
                </View>
              );
            },
          }}
        >
          <Navigator.Screen
            name="A"
            component={() => null}
            options={{ badge: 8, icon: <Text>Icon</Text> }}
          />
          <Navigator.Screen name="B" component={() => null} />
          <Navigator.Screen
            name="Disabled"
            component={() => null}
            options={{ disabled: true }}
          />
        </Navigator.Navigator>
      </NavigationContainer>,
    );
    expect(StyleSheet.flatten(button('A').props.style)).toMatchObject({
      backgroundColor: '#selected',
      borderColor: '#blurred',
    });
    expect(
      button('A')
        .findAll((n) => String(n.type) === 'Text' && n.props.children === 'A')
        .map((n) => StyleSheet.flatten(n.props.style).fontSize),
    ).toEqual([22]);
    expect(
      button('A')
        .findAll((n) => String(n.type) === 'Text' && n.props.children === 8)
        .map((n) => StyleSheet.flatten(n.props.style).color),
    ).toEqual(['#badge']);
    act(() => button('B').props.onFocus());
    expect(StyleSheet.flatten(button('B').props.style).borderColor).toBe(
      '#focused',
    );
    act(() => button('B').props.onHoverIn());
    expect(StyleSheet.flatten(button('B').props.style).padding).toBe(21);
    act(() => button('B').props.onPressIn());
    expect(StyleSheet.flatten(button('B').props.style).backgroundColor).toBe(
      '#pressed',
    );
    act(() => button('B').props.onPressOut());
    click('B');
    expect(button('B').props.accessibilityState.selected).toBe(true);
    expect(StyleSheet.flatten(button('Disabled').props.style).opacity).toBe(
      0.2,
    );
    expect(button('Disabled').props.disabled).toBe(true);
    const rail = native('View').find(
      (n) =>
        n.props.accessibilityRole === (type === 'sidebar' ? 'menu' : 'tablist'),
    )!;
    expect(StyleSheet.flatten(rail.props.style)).toMatchObject({
      padding: 7,
      backgroundColor: '#234567',
    });
    key(rail, 'Home');
    key(rail, 'Enter');
    expect(button('A').props.accessibilityState.selected).toBe(true);
    expect(seen).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'B', selected: true, focused: true }),
    );
  },
);

it('customizes Sidebar sections and collapse content while retaining its accessible button', () => {
  const Sidebar = createSidebarNavigator<{ Hidden: undefined; A: undefined }>();
  render(
    <NavigationContainer>
      <Sidebar.Navigator
        sectionStyle={{ marginTop: 14 }}
        sectionTitleStyle={{ fontSize: 18 }}
        collapseButtonStyle={{ padding: 20 }}
        collapseLabelStyle={{ color: '#abc' }}
        renderCollapseButtonContent={({ collapsed, children }) => (
          <View testID={collapsed ? 'expand-content' : 'collapse-content'}>
            {children}
          </View>
        )}
      >
        <Sidebar.Section
          title="Library"
          style={{ padding: 8 }}
          titleStyle={{ color: '#def' }}
        >
          <Sidebar.Screen
            name="Hidden"
            component={() => null}
            options={{ hidden: true }}
          />
          <Sidebar.Screen name="A" component={() => null} />
        </Sidebar.Section>
      </Sidebar.Navigator>
    </NavigationContainer>,
  );
  const title = native('Text').find((n) => n.props.children === 'Library')!;
  expect(StyleSheet.flatten(title.props.style)).toMatchObject({
    fontSize: 18,
    color: '#def',
  });
  expect(StyleSheet.flatten(parentView(title).props.style)).toMatchObject({
    marginTop: 14,
    padding: 8,
  });
  expect(
    StyleSheet.flatten(button('Collapse sidebar').props.style).padding,
  ).toBe(20);
  click('Collapse sidebar');
  expect(button('Expand sidebar').props.accessibilityRole).toBe('button');
  expect(
    native('View').find((n) => n.props.testID === 'expand-content'),
  ).toBeDefined();
});

it('styles Split columns and custom resize handles without losing constraints, state, or serializability', () => {
  const Split = createSplitNavigator();
  const nav = createNavigationRef();
  const mounts = vi.fn();
  function Column() {
    React.useEffect(() => {
      mounts();
    }, []);
    return null;
  }
  render(
    <NavigationContainer ref={nav}>
      <Split.Navigator
        columnStyle={{ padding: 5 }}
        dividerStyle={({ dragging }) => ({
          width: 14,
          backgroundColor: dragging ? '#drag' : '#rest',
        })}
        renderDivider={({ width, dragging }) => (
          <Text>{`${width}:${dragging}`}</Text>
        )}
      >
        <Split.Column
          id="left"
          component={Column}
          minWidth={180}
          maxWidth={320}
          style={{ width: 999, backgroundColor: '#column' }}
          contentStyle={{ padding: 17 }}
        />
        <Split.Column id="right" component={() => null} />
      </Split.Navigator>
    </NavigationContainer>,
  );
  const divider = () =>
    native('View').find((n) => n.props.testID === 'split-divider-left')!;
  const column = () =>
    native('View').find((n) => n.props.testID === 'split-column-left')!;
  expect(StyleSheet.flatten(column().props.style)).toMatchObject({
    width: 180,
    backgroundColor: '#column',
    padding: 5,
  });
  expect(StyleSheet.flatten(divider().props.style)).toMatchObject({
    width: 14,
    backgroundColor: '#rest',
  });
  act(() => divider().props.onResponderGrant({}));
  expect(StyleSheet.flatten(divider().props.style).backgroundColor).toBe(
    '#drag',
  );
  act(() => divider().props.onResponderMove({ nativeEvent: { dx: 999 } }));
  expect(divider().props.accessibilityValue.now).toBe(320);
  expect(
    divider().findAll((n) => String(n.type) === 'Text')[0].props.children,
  ).toBe('320:true');
  act(() => divider().props.onResponderRelease({}));
  expect(StyleSheet.flatten(divider().props.style).backgroundColor).toBe(
    '#rest',
  );
  expect(mounts).toHaveBeenCalledOnce();
  const json = serializeNavigationState(nav.getRootState()!);
  expect(JSON.parse(json).nodes.root.state.widths.left).toBe(320);
  expect(json).not.toContain('#column');
  expect(json).not.toContain('renderDivider');
});

it('removes the entire Split divider and its interaction surface without remounting columns', () => {
  const Split = createSplitNavigator();
  const mounted = vi.fn();
  const handle = vi.fn(() => <Text>Grip</Text>);
  function Content() {
    React.useEffect(() => {
      mounted();
    }, []);
    return null;
  }
  const tree = (shown: boolean) => (
    <NavigationContainer>
      <Split.Navigator dividerShown={shown} renderDivider={handle}>
        <Split.Column id="left" component={Content} />
        <Split.Column id="right" component={Content} />
      </Split.Navigator>
    </NavigationContainer>
  );
  render(tree(true));
  expect(
    native('View').filter((n) => n.props.accessibilityRole === 'adjustable'),
  ).toHaveLength(1);
  handle.mockClear();
  act(() => renderer.update(tree(false)));
  expect(
    native('View').filter((n) => n.props.accessibilityRole === 'adjustable'),
  ).toHaveLength(0);
  expect(
    native('View').find((n) => n.props.testID === 'split-divider-left'),
  ).toBeUndefined();
  expect(handle).not.toHaveBeenCalled();
  expect(mounted).toHaveBeenCalledTimes(2);
  act(() => renderer.update(tree(true)));
  expect(
    native('View').filter((n) => n.props.accessibilityRole === 'adjustable'),
  ).toHaveLength(1);
  expect(mounted).toHaveBeenCalledTimes(2);
});

it('lets individual Split columns override divider visibility', () => {
  const Split = createSplitNavigator();
  const Content = () => null;
  render(
    <NavigationContainer>
      <Split.Navigator dividerShown={false}>
        <Split.Column id="left" component={Content} />
        <Split.Column id="middle" component={Content} dividerShown />
        <Split.Column id="right" component={Content} dividerShown />
      </Split.Navigator>
    </NavigationContainer>,
  );
  expect(
    native('View')
      .filter((n) => n.props.accessibilityRole === 'adjustable')
      .map((n) => n.props.testID),
  ).toEqual(['split-divider-middle']);
});

it('replaces the complete Sidebar footer without retaining the default button shell', () => {
  const Sidebar = createSidebarNavigator<{ Home: undefined }>();
  render(
    <NavigationContainer>
      <Sidebar.Navigator
        sidebarFooterStyle={{ padding: 12 }}
        renderSidebarFooter={({ collapsed, toggleSidebar }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Custom toggle"
            onPress={toggleSidebar}
          >
            <Text>{collapsed ? 'Open' : 'Close'}</Text>
          </Pressable>
        )}
      >
        <Sidebar.Screen name="Home" component={() => null} />
      </Sidebar.Navigator>
    </NavigationContainer>,
  );
  expect(!!button('Collapse sidebar')).toBe(false);
  expect(button('Custom toggle')).toBeDefined();
  expect(
    StyleSheet.flatten(
      native('View').find((n) => n.props.testID === 'sidebar-footer')!.props
        .style,
    ).padding,
  ).toBe(12);
  click('Custom toggle');
  expect(
    StyleSheet.flatten(
      native('View').find((n) => n.props.accessibilityRole === 'menu')!.props
        .style,
    ).width,
  ).toBe(56);
  expect(
    button('Custom toggle').findAll((n) => String(n.type) === 'Text')[0].props
      .children,
  ).toBe('Open');
});

it.each(['hidden-button', 'null-footer'] as const)(
  'removes the default Sidebar footer completely with %s',
  (mode) => {
    const Sidebar = createSidebarNavigator<{ Home: undefined }>();
    render(
      <NavigationContainer>
        <Sidebar.Navigator
          collapseButtonShown={mode !== 'hidden-button'}
          renderSidebarFooter={mode === 'null-footer' ? () => null : undefined}
        >
          <Sidebar.Screen name="Home" component={() => null} />
        </Sidebar.Navigator>
      </NavigationContainer>,
    );
    expect(!!button('Collapse sidebar')).toBe(false);
    expect(
      native('View').find((n) => n.props.testID === 'sidebar-footer'),
    ).toBeUndefined();
  },
);

it('keeps the divider, both column widths, and a fill-width Sidebar synchronized while dragging', () => {
  const Split = createSplitNavigator();
  const Sidebar = createSidebarNavigator<{ Home: undefined }>();
  const nav = createNavigationRef();
  const resize = vi.fn();
  const mounted = vi.fn();
  function Menu() {
    React.useEffect(() => {
      mounted();
    }, []);
    return (
      <Sidebar.Navigator width="fill" collapseButtonShown={false}>
        <Sidebar.Screen name="Home" component={() => null} />
      </Sidebar.Navigator>
    );
  }
  render(
    <NavigationContainer ref={nav}>
      <Split.Navigator onColumnResize={resize}>
        <Split.Column
          id="menu"
          component={Menu}
          defaultWidth={240}
          minWidth={180}
          maxWidth={900}
        />
        <Split.Column id="content" component={() => null} minWidth={320} />
      </Split.Navigator>
    </NavigationContainer>,
  );
  const split = () =>
    native('View').find((n) => n.props.testID === 'split-layout')!;
  const divider = () =>
    native('View').find((n) => n.props.testID === 'split-divider-menu')!;
  const widths = () =>
    ['menu', 'content'].map(
      (id) =>
        StyleSheet.flatten(
          native('View').find((n) => n.props.testID === `split-column-${id}`)!
            .props.style,
        ).width,
    );
  act(() =>
    split().props.onLayout({
      nativeEvent: { layout: { width: 1000, height: 600 } },
    }),
  );
  expect(widths()).toEqual([240, 754]);
  act(() =>
    divider().props.onLayout({ nativeEvent: { layout: { width: 12 } } }),
  );
  expect(widths()).toEqual([240, 748]);
  act(() => divider().props.onResponderGrant({}));
  act(() => divider().props.onResponderMove({ nativeEvent: { dx: 100 } }));
  expect(widths()).toEqual([340, 648]);
  expect(divider().props.accessibilityValue.now).toBe(340);
  expect(resize.mock.calls).toEqual([
    ['menu', 340],
    ['content', 648],
  ]);
  expect(
    StyleSheet.flatten(
      native('View').find((n) => n.props.accessibilityRole === 'menu')!.props
        .style,
    ),
  ).toMatchObject({ width: '100%', maxWidth: '100%' });
  act(() => divider().props.onResponderMove({ nativeEvent: { dx: 1000 } }));
  expect(widths()).toEqual([668, 320]);
  act(() => divider().props.onResponderRelease({}));
  key(divider(), 'ArrowLeft');
  expect(widths()).toEqual([658, 330]);
  act(() =>
    split().props.onLayout({
      nativeEvent: { layout: { width: 600, height: 600 } },
    }),
  );
  expect(widths()).toEqual([268, 320]);
  expect(
    (
      nav.getRootState()!.nodes.root
        .state as import('../src').SplitNavigationState
    ).widths,
  ).toEqual({ menu: 268, content: 320 });
  expect(mounted).toHaveBeenCalledOnce();
});

it('reclaims hidden divider space and refits a responsive Split without losing a hidden column width', () => {
  const Split = createSplitNavigator();
  const Content = () => null;
  const layout = ({ width }: { width: number }) =>
    width < 500 ? ['right'] : ['left', 'right'];
  const tree = (shown: boolean) => (
    <NavigationContainer>
      <Split.Navigator layout={layout} dividerShown={shown}>
        <Split.Column id="left" component={Content} defaultWidth={200} />
        <Split.Column id="right" component={Content} minWidth={200} />
      </Split.Navigator>
    </NavigationContainer>
  );
  render(tree(true));
  const split = () =>
    native('View').find((n) => n.props.testID === 'split-layout')!;
  const width = (id: string) =>
    StyleSheet.flatten(
      native('View').find((n) => n.props.testID === `split-column-${id}`)!.props
        .style,
    ).width;
  act(() =>
    split().props.onLayout({
      nativeEvent: { layout: { width: 800, height: 500 } },
    }),
  );
  expect([width('left'), width('right')]).toEqual([200, 594]);
  act(() => renderer.update(tree(false)));
  expect([width('left'), width('right')]).toEqual([200, 600]);
  act(() =>
    split().props.onLayout({
      nativeEvent: { layout: { width: 400, height: 500 } },
    }),
  );
  expect([width('left'), width('right')]).toEqual([200, 400]);
  act(() =>
    split().props.onLayout({
      nativeEvent: { layout: { width: 800, height: 500 } },
    }),
  );
  expect([width('left'), width('right')]).toEqual([200, 600]);
});

it('moves Split boundaries on Sidebar collapse and restores the resized width after snapshot restore', () => {
  const Split = createSplitNavigator();
  const Sidebar = createSidebarNavigator<{ Home: undefined }>();
  const nav = createNavigationRef();
  const mounted = vi.fn();
  const resize = vi.fn();
  function Menu() {
    React.useEffect(mounted, []);
    return (
      <Sidebar.Navigator width="fill" collapsedWidth={64}>
        <Sidebar.Screen name="Home" component={() => null} />
      </Sidebar.Navigator>
    );
  }
  const tree = (initialState?: string) => (
    <React.StrictMode>
      <NavigationContainer
        ref={nav}
        initialState={
          initialState ? restoreNavigationState(initialState) : undefined
        }
      >
        <Split.Navigator onColumnResize={resize}>
          <Split.Column
            id="menu"
            component={Menu}
            defaultWidth={240}
            minWidth={180}
          />
          <Split.Column id="content" component={() => null} minWidth={320} />
        </Split.Navigator>
      </NavigationContainer>
    </React.StrictMode>
  );
  const split = () =>
    native('View').find((n) => n.props.testID === 'split-layout')!;
  const divider = () =>
    native('View').find((n) => n.props.testID === 'split-divider-menu')!;
  const widths = () =>
    ['menu', 'content'].map(
      (id) =>
        StyleSheet.flatten(
          native('View').find((n) => n.props.testID === `split-column-${id}`)!
            .props.style,
        ).width,
    );
  const layout = (width: number) =>
    act(() =>
      split().props.onLayout({
        nativeEvent: { layout: { width, height: 600 } },
      }),
    );
  render(tree());
  layout(1000);
  act(() => divider().props.onResponderGrant({}));
  act(() => divider().props.onResponderMove({ nativeEvent: { dx: 100 } }));
  act(() => divider().props.onResponderRelease({}));
  expect(widths()).toEqual([340, 654]);
  const mountsBeforeCollapse = mounted.mock.calls.length;
  resize.mockClear();
  click('Collapse sidebar');
  expect(widths()).toEqual([64, 930]);
  expect(divider().props.accessibilityValue).toEqual({
    min: 64,
    max: 64,
    now: 64,
  });
  expect(resize.mock.calls).toEqual([
    ['menu', 64],
    ['content', 930],
  ]);
  // Resizing the window or the pinned boundary must not expand a collapsed column.
  key(divider(), 'ArrowRight');
  layout(800);
  expect(widths()).toEqual([64, 730]);
  expect(mounted.mock.calls.length).toBe(mountsBeforeCollapse);
  const saved = serializeNavigationState(nav.getRootState()!);
  act(() => renderer.unmount());
  render(tree(saved));
  layout(1000);
  expect(widths()).toEqual([64, 930]);
  click('Expand sidebar');
  expect(widths()).toEqual([340, 654]);
  expect(divider().props.accessibilityValue.now).toBe(340);
  const sidebarId = Object.values(nav.getRootState()!.nodes).find(
    (n) => n.type === 'sidebar',
  )!.id;
  act(() => nav.dispatch({ target: sidebarId, type: 'collapseSidebar' }));
  expect(widths()).toEqual([64, 930]);
  layout(600);
  act(() => nav.dispatch({ target: sidebarId, type: 'expandSidebar' }));
  expect(widths()).toEqual([274, 320]);
});

it.each(['left', 'right'] as const)(
  'synchronizes an initially collapsed %s Sidebar and changing collapsedWidth',
  (side) => {
    const Split = createSplitNavigator();
    const Sidebar = createSidebarNavigator<{ Home: undefined }>();
    const WidthContext = React.createContext(56);
    function Menu() {
      const collapsedWidth = React.useContext(WidthContext);
      return (
        <Sidebar.Navigator
          width="fill"
          defaultCollapsed
          collapsedWidth={collapsedWidth}
          position={side}
        >
          <Sidebar.Screen name="Home" component={() => null} />
        </Sidebar.Navigator>
      );
    }
    const Content = () => null;
    const tree = (width: number) => (
      <NavigationContainer>
        <WidthContext.Provider value={width}>
          <Split.Navigator>
            <Split.Column
              id="left"
              component={side === 'left' ? Menu : Content}
              defaultWidth={240}
              minWidth={180}
            />
            <Split.Column
              id="right"
              component={side === 'right' ? Menu : Content}
              defaultWidth={240}
              minWidth={180}
            />
          </Split.Navigator>
        </WidthContext.Provider>
      </NavigationContainer>
    );
    const widths = () =>
      ['left', 'right'].map(
        (id) =>
          StyleSheet.flatten(
            native('View').find((n) => n.props.testID === `split-column-${id}`)!
              .props.style,
          ).width,
      );
    render(tree(56));
    act(() =>
      native('View')
        .find((n) => n.props.testID === 'split-layout')!
        .props.onLayout({
          nativeEvent: { layout: { width: 1000, height: 600 } },
        }),
    );
    expect(widths()).toEqual(side === 'left' ? [56, 938] : [938, 56]);
    act(() => renderer.update(tree(72)));
    expect(widths()).toEqual(side === 'left' ? [72, 922] : [922, 72]);
    click('Expand sidebar');
    expect(widths()).toEqual(side === 'left' ? [240, 754] : [754, 240]);
  },
);

it.each(['opt-out', 'nested-screen'] as const)(
  'keeps the Split column width when collapsing a Sidebar with %s',
  (mode) => {
    const Split = createSplitNavigator();
    const Sidebar = createSidebarNavigator<{ Home: undefined }>();
    const Tabs = createTabNavigator<{ Menu: undefined }>();
    function Menu() {
      return (
        <Sidebar.Navigator>
          <Sidebar.Screen name="Home" component={() => null} />
        </Sidebar.Navigator>
      );
    }
    function Nested() {
      return (
        <Tabs.Navigator>
          <Tabs.Screen name="Menu" component={Menu} />
        </Tabs.Navigator>
      );
    }
    render(
      <NavigationContainer>
        <Split.Navigator>
          <Split.Column
            id="menu"
            component={mode === 'nested-screen' ? Nested : Menu}
            collapsible={mode !== 'opt-out'}
            defaultWidth={300}
          />
          <Split.Column id="content" component={() => null} />
        </Split.Navigator>
      </NavigationContainer>,
    );
    click('Collapse sidebar');
    expect(
      StyleSheet.flatten(
        native('View').find((n) => n.props.testID === 'split-column-menu')!
          .props.style,
      ).width,
    ).toBe(300);
  },
);
