import React from 'react';
import { House } from 'lucide-react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Text, View, UIManager, TextInput, StyleSheet } from 'react-native';
import { Platform, nativeFocus } from './react-native';
import {
  NavigationContainer,
  NavigationFocusable,
  createStackNavigator,
  createSidebarNavigator,
  createSplitNavigator,
  createNavigationRef,
  useNavigation,
  type StackNavigation,
  type SidebarNavigation,
  serializeNavigationState,
  restoreNavigationState,
} from '../src/native';
import { createTabNavigator } from '../src';
import {
  NativeSurface,
  parseNativeEvent,
  type NativeConfiguration,
} from '../src/native/host';
import { resolveNativeIcon } from '../src/native/icons';

// Exercise the real Lucide components; only the platform SVG renderer is mocked.
vi.mock('react-native-svg', () => ({ Svg: 'Svg', Path: 'Path' }));

let renderer: ReactTestRenderer | undefined;
const runtime = globalThis as { nativeFabricUIManager?: unknown };
beforeEach(() => {
  runtime.nativeFabricUIManager = {};
});
afterEach(() => {
  if (renderer) act(() => renderer!.unmount());
  renderer = undefined;
  delete runtime.nativeFabricUIManager;
  Platform.OS = 'macos';
});
function render(element: React.ReactElement) {
  act(() => {
    renderer = create(element);
  });
}
function host(index = 0) {
  return renderer!.root.findAll(
    (node) => String(node.type) === 'DesktopNavigationHost',
  )[index];
}
function configuration(index = 0) {
  return JSON.parse(host(index).props.configuration);
}
function event(message: Record<string, unknown>, index = 0) {
  const node = host(index);
  act(() =>
    node.props.onNavigationEvent({
      nativeEvent: {
        payload: JSON.stringify({
          revision: JSON.parse(node.props.configuration).revision,
          ...message,
        }),
      },
    }),
  );
}
const Stack = createStackNavigator<{
  Home: undefined;
  Detail: { id: string };
}>();
let navigation: StackNavigation<{ Home: undefined; Detail: { id: string } }>;
function Home() {
  navigation = useNavigation<typeof navigation>();
  return <Text>Home</Text>;
}
function Detail() {
  navigation = useNavigation<typeof navigation>();
  return <Text>Detail</Text>;
}
function stack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Detail" component={Detail} />
    </Stack.Navigator>
  );
}

it('uses the shared Store, preserves route instances and vetoes native back before acknowledging', () => {
  const ref = createNavigationRef<{
    Home: undefined;
    Detail: { id: string };
  }>();
  render(<NavigationContainer ref={ref}>{stack()}</NavigationContainer>);
  act(() => navigation.push('Detail', { id: '42' }));
  const pushed = configuration();
  const block = navigation.addListener('beforeRemove', (e) =>
    e.preventDefault(),
  );
  event({ type: 'back' });
  expect(configuration().items).toEqual(pushed.items);
  expect(configuration().revision).toBeGreaterThan(pushed.revision);
  block();
  event({ type: 'back' });
  expect(configuration().items).toHaveLength(1);
  expect(ref.getRootState()!.nodes.root.state.routes[0].name).toBe('Home');
});

it('rejects stale actions and malformed layouts, and places retained React scenes using native frames', () => {
  render(<NavigationContainer>{stack()}</NavigationContainer>);
  const first = configuration();
  act(() => navigation.push('Detail', { id: '42' }));
  event({ type: 'back', revision: first.revision });
  expect(configuration().items).toHaveLength(2);
  const active = configuration().activeKey;
  event({
    type: 'layout',
    frames: { [active]: { x: 5, y: 44, width: 600, height: 400 } },
  });
  expect(
    renderer!.root
      .findAllByType(View)
      .some((node) => JSON.stringify(node.props.style).includes('"left":5')),
  ).toBe(true);
  expect(parseNativeEvent('{')).toBeNull();
  expect(
    parseNativeEvent(JSON.stringify({ type: 'pop', count: -1, revision: 0 })),
  ).toBeNull();
  expect(
    parseNativeEvent(
      JSON.stringify({
        type: 'layout',
        revision: 0,
        frames: { x: { x: 0, y: 0, width: -1, height: 1 } },
      }),
    ),
  ).toBeNull();
});

it('uses the customizable RN header when header styles are supplied', () => {
  render(
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#ff0000' },
          headerTitleStyle: { fontSize: 24 },
        }}
      >
        <Stack.Screen name="Home" component={Home} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  expect(configuration().headerShown).toBe(false);
  expect(
    renderer!.root
      .findAllByType(Text)
      .some((node) =>
        JSON.stringify(node.props.style).includes('"fontSize":24'),
      ),
  ).toBe(true);
});

it('retains screen local state and unmounts only with inactiveBehavior=unmount', () => {
  const mounted = vi.fn();
  const unmounted = vi.fn();
  function Stateful() {
    navigation = useNavigation<typeof navigation>();
    React.useEffect(() => {
      mounted();
      return unmounted;
    }, []);
    return null;
  }
  render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={Stateful} />
        <Stack.Screen name="Detail" component={Detail} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  act(() => navigation.push('Detail', { id: '1' }));
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(unmounted).not.toHaveBeenCalled();
  event({ type: 'back' });
  expect(mounted).toHaveBeenCalledTimes(1);
  act(() => renderer!.unmount());
  renderer = undefined;
  mounted.mockClear();
  unmounted.mockClear();
  render(
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ inactiveBehavior: 'unmount' }}>
        <Stack.Screen name="Home" component={Stateful} />
        <Stack.Screen name="Detail" component={Detail} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  act(() => navigation.push('Detail', { id: '1' }));
  expect(unmounted).toHaveBeenCalledTimes(1);
});

it('restores a native stack through the existing snapshot format and supports desktop forward history', () => {
  const ref = createNavigationRef<{
    Home: undefined;
    Detail: { id: string };
  }>();
  const tree = (
    <Stack.Navigator historyBehavior="desktop">
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Detail" component={Detail} />
    </Stack.Navigator>
  );
  render(<NavigationContainer ref={ref}>{tree}</NavigationContainer>);
  act(() => navigation.push('Detail', { id: '42' }));
  event({ type: 'back' });
  act(() => ref.goForward());
  expect(configuration().items).toHaveLength(2);
  const saved = serializeNavigationState(ref.getRootState()!);
  act(() => renderer!.unmount());
  renderer = undefined;
  render(
    <NavigationContainer initialState={restoreNavigationState(saved)}>
      {tree}
    </NavigationContainer>,
  );
  expect(configuration().items).toHaveLength(2);
  expect(navigation.getState().routes[1].params).toEqual({ id: '42' });
});

it('filters hidden/disabled native selections and synchronizes sidebar collapse in both directions', () => {
  const Sidebar = createSidebarNavigator<{
    A: undefined;
    B: undefined;
    C: undefined;
  }>();
  let side!: SidebarNavigation<{ A: undefined; B: undefined; C: undefined }>;
  function Page() {
    side = useNavigation<typeof side>();
    return null;
  }
  render(
    <NavigationContainer>
      <Sidebar.Navigator>
        <Sidebar.Section title="Workspace">
          <Sidebar.Screen name="A" component={Page} />
          <Sidebar.Screen
            name="B"
            component={Page}
            options={{ disabled: true }}
          />
          <Sidebar.Screen
            name="C"
            component={Page}
            options={{ hidden: true }}
          />
        </Sidebar.Section>
      </Sidebar.Navigator>
    </NavigationContainer>,
  );
  const initial = configuration();
  event({ type: 'select', key: initial.items[1].key });
  expect(configuration().activeKey).toBe(initial.activeKey);
  event({ type: 'select', key: initial.items[2].key });
  expect(configuration().activeKey).toBe(initial.activeKey);
  event({ type: 'select', key: 'unknown' });
  expect(configuration().activeKey).toBe(initial.activeKey);
  event({ type: 'collapse', collapsed: true });
  expect(configuration().collapsed).toBe(true);
  act(() => side.expandSidebar());
  expect(configuration().collapsed).toBe(false);
  expect(configuration().items[0].section).toBe('Workspace');
});

it('passes sidebar badges and lets null appearance colors fall back to OS defaults', () => {
  const Sidebar = createSidebarNavigator<{
    A: undefined;
    B: undefined;
    C: undefined;
  }>();
  const Page = () => null;
  const tree = (count: number) => (
    <NavigationContainer>
      <Sidebar.Navigator
        appearance={{ sidebarBackgroundColor: null, accentColor: '#ff88b8' }}
      >
        <Sidebar.Screen name="A" component={Page} options={{ badge: count }} />
        <Sidebar.Screen name="B" component={Page} options={{ badge: 'New' }} />
        <Sidebar.Screen name="C" component={Page} options={{ badge: '' }} />
      </Sidebar.Navigator>
    </NavigationContainer>
  );
  render(tree(3));
  expect(configuration().items.map((i: { badge?: string }) => i.badge)).toEqual(
    ['3', 'New', undefined],
  );
  expect(configuration().appearance).toEqual({
    backgroundColor: '#ffffff',
    foregroundColor: '#202124',
    accentColor: '#ff88b8',
  });
  act(() => renderer!.update(tree(0)));
  expect(configuration().items[0].badge).toBeUndefined();
});

it('updates split widths through the Router and retains hidden columns through responsive layouts', () => {
  const Split = createSplitNavigator();
  const resize = vi.fn();
  const mounted = vi.fn();
  function Page() {
    React.useEffect(() => {
      mounted();
    }, []);
    return null;
  }
  render(
    <NavigationContainer>
      <Split.Navigator
        layout={({ width }) => (width < 500 ? ['b'] : ['a', 'b'])}
        onColumnResize={resize}
      >
        <Split.Column id="a" component={Page} minWidth={100} maxWidth={300} />
        <Split.Column id="b" component={Page} minWidth={200} />
      </Split.Navigator>
    </NavigationContainer>,
  );
  event({ type: 'resize', key: 'a', width: 999 });
  expect(configuration().columns[0].width).toBe(300);
  event({
    type: 'layout',
    frames: {
      a: { x: 0, y: 0, width: 260, height: 600 },
      b: { x: 261, y: 0, width: 739, height: 600 },
    },
  });
  expect(
    configuration().columns.map((c: { width: number }) => c.width),
  ).toEqual([260, 739]);
  expect(resize).toHaveBeenCalledWith('b', 739);
  const container = renderer!.root
    .findAllByType(View)
    .find((node) => node.props.onLayout)!;
  act(() =>
    container.props.onLayout({
      nativeEvent: { layout: { width: 400, height: 600 } },
    }),
  );
  expect(configuration().columns.map((c: { key: string }) => c.key)).toEqual([
    'b',
  ]);
  expect(mounted).toHaveBeenCalledTimes(2);
});

it('allows JS navigators to nest inside native scenes using the same context', () => {
  const Tabs = createTabNavigator<{ One: undefined; Two: undefined }>();
  function Nested() {
    return (
      <Tabs.Navigator>
        <Tabs.Screen name="One" component={() => <Text>Nested one</Text>} />
        <Tabs.Screen name="Two" component={() => null} />
      </Tabs.Navigator>
    );
  }
  const ref = createNavigationRef<{ Home: undefined }>();
  render(
    <NavigationContainer ref={ref}>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={Nested} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  expect(
    Object.values(ref.getRootState()!.nodes)
      .map((node) => node.type)
      .sort(),
  ).toEqual(['stack', 'tabs']);
});

it('reports unlinked/unsupported architectures instead of falling back silently', () => {
  const props = {
    configuration: { mode: 'stack' as const, items: [], activeKey: '' },
    slots: [],
    onRequest: vi.fn(),
  };
  vi.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(false);
  expect(() => render(<NativeSurface {...props} />)).toThrow('not registered');
  vi.restoreAllMocks();
  delete runtime.nativeFabricUIManager;
  expect(() => render(<NativeSurface {...props} />)).toThrow('requires Fabric');
  runtime.nativeFabricUIManager = {};
  Platform.OS = 'ios';
  expect(() => render(<NativeSurface {...props} />)).toThrow(
    'macOS and Windows only',
  );
});

it('restores focus after native content is measured, not while its slot is hidden', () => {
  function Focused() {
    return (
      <NavigationFocusable id="input">
        <TextInput testID="native-input" />
      </NavigationFocusable>
    );
  }
  nativeFocus.mockClear();
  render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={Focused} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  expect(nativeFocus).not.toHaveBeenCalled();
  const key = configuration().activeKey;
  event({
    type: 'layout',
    frames: { [key]: { x: 0, y: 44, width: 0, height: 0 } },
  });
  expect(nativeFocus).not.toHaveBeenCalled();
  event({
    type: 'layout',
    frames: { [key]: { x: 0, y: 44, width: 800, height: 500 } },
  });
  expect(nativeFocus).toHaveBeenCalledWith('native-input');
});

it.each(['macos', 'windows'])(
  'resolves native icons on %s without serializing callbacks and updates selection/removal',
  (os) => {
    Platform.OS = os;
    const Sidebar = createSidebarNavigator<{
      A: undefined;
      B: undefined;
      Disabled: undefined;
      Plain: undefined;
    }>();
    let removeIcons!: () => void;
    const Page = () => null;
    const icon = vi.fn(
      ({ focused, disabled }: { focused: boolean; disabled: boolean }) => ({
        type: 'system' as const,
        macos: focused ? 'house.fill' : 'house',
        windows: {
          glyph: focused ? '\uE80F' : '\uE8A5',
          fontFamily: 'Segoe MDL2 Assets',
        },
        size: 18,
        color: disabled ? '#888888' : '#9966ff',
      }),
    );
    function App() {
      const [shown, setShown] = React.useState(true);
      removeIcons = () => setShown(false);
      return (
        <Sidebar.Navigator screenOptions={{ icon: shown ? icon : null }}>
          <Sidebar.Screen name="A" component={Page} />
          <Sidebar.Screen name="B" component={Page} />
          <Sidebar.Screen
            name="Disabled"
            component={Page}
            options={{ disabled: true }}
          />
          <Sidebar.Screen
            name="Plain"
            component={Page}
            options={{ icon: null }}
          />
        </Sidebar.Navigator>
      );
    }
    render(
      <NavigationContainer>
        <App />
      </NavigationContainer>,
    );
    expect(icon).toHaveBeenCalledWith({ focused: false, disabled: true });
    const first = configuration();
    expect(first.items[0].icon).toMatchObject(
      os === 'macos'
        ? { type: 'symbol', name: 'house.fill', size: 18, color: '#9966ff' }
        : {
            type: 'font',
            glyph: '\uE80F',
            fontFamily: 'Segoe MDL2 Assets',
            size: 18,
            color: '#9966ff',
          },
    );
    expect(first.items[3].icon).toBeUndefined();
    event({ type: 'select', key: first.items[1].key });
    expect(configuration().items[0].icon).toMatchObject(
      os === 'macos' ? { name: 'house' } : { glyph: '\uE8A5' },
    );
    expect(configuration().items[1].icon).toMatchObject(
      os === 'macos' ? { name: 'house.fill' } : { glyph: '\uE80F' },
    );
    act(() => removeIcons());
    expect(
      configuration().items.every(
        (item: { icon?: unknown }) => item.icon === undefined,
      ),
    ).toBe(true);
  },
);

it('resolves bundled and URI image icons, applies template settings and preserves title-only platform items', () => {
  const state = { focused: false, disabled: false };
  expect(
    resolveNativeIcon(
      { type: 'image', source: 7, template: true, color: '#12345678' },
      state,
    ),
  ).toEqual({
    type: 'image',
    uri: 'file:///assets/7.png',
    template: true,
    size: 16,
    color: '#12345678',
  });
  expect(
    resolveNativeIcon(
      { type: 'image', source: { uri: 'https://example.com/icon.png' } },
      state,
    ),
  ).toMatchObject({ type: 'image', template: false });
  expect(
    resolveNativeIcon({ type: 'system', windows: { glyph: '\uE80F' } }, state),
  ).toBeUndefined();
  expect(resolveNativeIcon(() => null, state)).toBeUndefined();
  Platform.OS = 'windows';
  expect(
    resolveNativeIcon({ type: 'system', macos: 'house' }, state),
  ).toBeUndefined();
  expect(
    resolveNativeIcon(
      { type: 'image', source: { uri: 'ms-appx:///Assets/icon.png' } },
      state,
    ),
  ).toMatchObject({ uri: 'ms-appx:///Assets/icon.png' });
  expect(() =>
    resolveNativeIcon({ type: 'system', windows: { glyph: ' ' } }, state),
  ).toThrow('Unicode glyph');
});

it('rejects invalid native icon descriptors before passing them to native controls', () => {
  const state = { focused: true, disabled: false };
  expect(() =>
    resolveNativeIcon({ type: 'system', macos: 'house', size: NaN }, state),
  ).toThrow('positive finite');
  expect(() =>
    resolveNativeIcon({ type: 'system', macos: 'house', color: 'red' }, state),
  ).toThrow('#RRGGBB');
  expect(() => resolveNativeIcon({ type: 'system', macos: '' }, state)).toThrow(
    'non-empty',
  );
  expect(() =>
    resolveNativeIcon({ type: 'image', source: { uri: '' } }, state),
  ).toThrow('resolved');
  expect(() =>
    resolveNativeIcon(
      { type: 'image', source: { uri: 'data:image/svg+xml,<svg/>' } },
      state,
    ),
  ).toThrow('URI');
});

it.each(['macos'])(
  'renders Lucide JSX in native sidebar slots on %s, preserving clipping, context and selection',
  (os) => {
    Platform.OS = os;
    const Sidebar = createSidebarNavigator<{
      A: undefined;
      B: undefined;
      System: undefined;
      Hidden: undefined;
    }>();
    const IconColor = React.createContext('#000000');
    const mounted = vi.fn();
    const unmounted = vi.fn();
    function ContextIcon({ focused }: { focused: boolean }) {
      const color = React.useContext(IconColor);
      React.useEffect(() => {
        mounted();
        return () => {
          unmounted();
        };
      }, []);
      return (
        <House
          size={20}
          color={focused ? color : '#888888'}
          strokeWidth={1.5}
        />
      );
    }
    let remove!: () => void;
    function App() {
      const [shown, setShown] = React.useState(true);
      remove = () => setShown(false);
      return (
        <Sidebar.Navigator
          screenOptions={{
            iconSize: 20,
            icon: shown
              ? ({ focused }) => <ContextIcon focused={focused} />
              : null,
          }}
        >
          <Sidebar.Screen name="A" component={() => null} />
          <Sidebar.Screen name="B" component={() => null} />
          <Sidebar.Screen
            name="System"
            component={() => null}
            options={{
              icon: ({ focused }) => ({
                type: 'system',
                macos: focused ? 'house.fill' : 'house',
                windows: { glyph: focused ? '\uE80F' : '\uE8A5' },
                color: focused ? '#c4a0ff' : '#888888',
                size: 20,
              }),
            }}
          />
          <Sidebar.Screen
            name="Hidden"
            component={() => null}
            options={{ hidden: true }}
          />
        </Sidebar.Navigator>
      );
    }
    render(
      <NavigationContainer>
        <IconColor.Provider value="#c4a0ff">
          <App />
        </IconColor.Provider>
      </NavigationContainer>,
    );
    const first = configuration();
    expect(first.items[0].icon).toEqual({ type: 'react', size: 20 });
    expect(host().props.configuration).not.toContain('ContextIcon');
    const [a, b, system] = first.items.map((i: { key: string }) => i.key);
    const geometry = {
      [a]: {
        frame: { x: 12, y: -5, width: 20, height: 20 },
        clip: { x: 12, y: 0, width: 20, height: 15 },
      },
      [b]: {
        frame: { x: 12, y: 25, width: 20, height: 20 },
        clip: { x: 12, y: 25, width: 20, height: 20 },
      },
    };
    const svgs = () => renderer!.root.findAll((n) => String(n.type) === 'Svg');
    expect(svgs()).toHaveLength(0);
    event({ type: 'layout', frames: {}, iconFrames: geometry });
    expect(svgs()).toHaveLength(2);
    expect(svgs()[0].props).toMatchObject({
      width: 20,
      height: 20,
      stroke: '#c4a0ff',
      strokeWidth: 1.5,
    });
    expect(svgs()[0].findAll((n) => String(n.type) === 'Path')).toHaveLength(2);
    const wrapper = renderer!.root
      .findAllByType(View)
      .find((n) => n.props.style?.top === -5)!;
    expect(wrapper.props.style).toMatchObject({
      top: -5,
      width: 20,
      height: 20,
    });
    const clip = wrapper.parent!;
    expect(clip.props.pointerEvents).toBe('none');
    const overlay = renderer!.root
      .findAllByType(View)
      .find((n) => n.props.accessible === false)!;
    expect(overlay.props).toMatchObject({
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    const initialSvgs = svgs();
    event({ type: 'select', key: b });
    expect(svgs()).toEqual(initialSvgs);
    expect(svgs()[0].props.stroke).toBe('#888888');
    expect(svgs()[1].props.stroke).toBe('#c4a0ff');
    event({
      type: 'layout',
      frames: {},
      iconFrames: {},
      revision: first.revision,
    });
    expect(svgs()).toEqual(initialSvgs); // Stale reports cannot clear retained icons.
    event({ type: 'layout', frames: {}, iconFrames: geometry });
    event({ type: 'select', key: b }); // Acknowledging a no-op also retains icons.
    event({ type: 'select', key: a });
    expect(svgs()).toEqual(initialSvgs);
    expect(svgs()[0].props.stroke).toBe('#c4a0ff');
    for (const key of [system, b, system, a]) {
      const previousRevision = configuration().revision;
      event({ type: 'select', key });
      expect(configuration().activeKey).toBe(key);
      expect(configuration().items[2].icon).toMatchObject({
        ...(os === 'macos'
          ? { name: key === system ? 'house.fill' : 'house' }
          : { glyph: key === system ? '\uE80F' : '\uE8A5' }),
        color: key === system ? '#c4a0ff' : '#888888',
      });
      expect(svgs()).toEqual(initialSvgs);
      expect(svgs()[0].props.stroke).toBe(key === a ? '#c4a0ff' : '#888888');
      expect(svgs()[1].props.stroke).toBe(key === b ? '#c4a0ff' : '#888888');
      event({
        type: 'layout',
        frames: {},
        iconFrames: {},
        revision: previousRevision,
      });
      expect(svgs()).toEqual(initialSvgs);
      event({ type: 'layout', frames: {}, iconFrames: geometry });
      expect(svgs()).toEqual(initialSvgs);
    }
    expect(mounted).toHaveBeenCalledTimes(2);
    expect(unmounted).not.toHaveBeenCalled();
    event({ type: 'layout', frames: {}, iconFrames: {} });
    expect(svgs()).toHaveLength(0);
    event({ type: 'layout', frames: {}, iconFrames: geometry });
    act(() => remove());
    expect(svgs()).toHaveLength(0);
    expect(configuration().items[0].icon).toBeUndefined();
  },
);

it.each([
  'icon-size',
  'native-icon-size',
  'icon-kind',
  'icon-removal',
  'hidden-row',
  'title',
  'badge',
  'pane-width',
  'footer',
  'collapse',
  'reorder',
])(
  'invalidates React icon geometry after %s changes, including a revert',
  (change) => {
    const original: NativeConfiguration = {
      mode: 'sidebar',
      activeKey: 'a',
      items: [
        { key: 'a', title: 'a', icon: { type: 'react', size: 20 } },
        {
          key: 'b',
          title: 'b',
          icon: { type: 'symbol', name: 'house', size: 20 },
        },
      ],
    };
    const changed: NativeConfiguration = {
      ...original,
      items: original.items.map((item) => ({ ...item })),
    };
    switch (change) {
      case 'icon-size':
        changed.items[0].icon = { type: 'react', size: 32 };
        break;
      case 'native-icon-size':
        changed.items[1].icon = { type: 'symbol', name: 'house', size: 32 };
        break;
      case 'icon-kind':
        changed.items[0].icon = { type: 'symbol', name: 'house', size: 20 };
        break;
      case 'icon-removal':
        changed.items[1].icon = undefined;
        break;
      case 'hidden-row':
        changed.items[1].hidden = true;
        break;
      case 'title':
        changed.items[0].title = 'Updated title';
        break;
      case 'badge':
        changed.items[0].badge = '99';
        break;
      case 'pane-width':
        changed.paneWidth = 300;
        break;
      case 'footer':
        changed.footerHeight = 60;
        break;
      case 'collapse':
        changed.collapsed = true;
        break;
      case 'reorder':
        changed.items.reverse();
        break;
    }
    const tree = (config: NativeConfiguration) => (
      <NavigationContainer>
        <NativeSurface
          configuration={config}
          slots={[]}
          icons={[{ key: 'a', content: <House size={20} /> }]}
          onRequest={() => {}}
        />
      </NavigationContainer>
    );
    render(tree(original));
    const rect = { x: 12, y: 10, width: 20, height: 20 };
    const measured = {
      type: 'layout',
      frames: {},
      iconFrames: { a: { frame: rect, clip: rect } },
    };
    const svgs = () => renderer!.root.findAll((n) => String(n.type) === 'Svg');
    event(measured);
    expect(svgs()).toHaveLength(1);
    const previousRevision = configuration().revision;
    act(() => renderer!.update(tree(changed)));
    expect(svgs()).toHaveLength(0);
    event({ ...measured, revision: previousRevision });
    expect(svgs()).toHaveLength(0);
    // Returning to the same configuration must not resurrect old measurements.
    act(() => renderer!.update(tree(original)));
    expect(svgs()).toHaveLength(0);
    event(measured);
    expect(svgs()).toHaveLength(1);
    const icon = svgs()[0];
    act(() => renderer!.update(tree({ ...original, activeKey: 'b' })));
    expect(svgs()[0]).toBe(icon);
  },
);

it('supports direct JSX and rejects invalid React slot dimensions and icon geometry', () => {
  const state = { focused: true, disabled: false };
  expect(resolveNativeIcon(<House />, state)).toEqual({
    type: 'react',
    size: 24,
  });
  expect(() => resolveNativeIcon(<House />, state, Infinity)).toThrow(
    'positive finite',
  );
  expect(() => resolveNativeIcon(() => <House />, state, 0)).toThrow(
    'positive finite',
  );
  const rect = { x: 1, y: 2, width: 20, height: 20 };
  for (const iconFrames of [
    null,
    [],
    { a: null },
    { a: { frame: rect } },
    { a: { frame: { ...rect, width: -1 }, clip: rect } },
    { a: { frame: rect, clip: { ...rect, y: 'bad' } } },
  ]) {
    expect(
      parseNativeEvent(
        JSON.stringify({ type: 'layout', revision: 0, frames: {}, iconFrames }),
      ),
    ).toBeNull();
  }
});

it('hosts Windows scenes, React icons and the footer in portals sized from native frames', () => {
  Platform.OS = 'windows';
  const Sidebar = createSidebarNavigator<{ A: undefined; B: undefined }>();
  const IconColor = React.createContext('#000000');
  function ContextIcon({ focused }: { focused: boolean }) {
    const color = React.useContext(IconColor);
    return <House size={16} color={focused ? color : '#888888'} />;
  }
  render(
    <NavigationContainer>
      <IconColor.Provider value="#c4a0ff">
        <Sidebar.Navigator
          screenOptions={{
            icon: ({ focused }) => <ContextIcon focused={focused} />,
          }}
          renderSidebarFooter={() => <Text testID="footer">Settings</Text>}
        >
          <Sidebar.Screen
            name="A"
            component={() => <Text testID="scene-a">A</Text>}
          />
          <Sidebar.Screen
            name="B"
            component={() => <Text testID="scene-b">B</Text>}
          />
        </Sidebar.Navigator>
      </IconColor.Provider>
    </NavigationContainer>,
  );
  const first = configuration();
  expect(first.hostId).toEqual(expect.any(String));
  expect(first.colorScheme).toBe('light');
  const [a, b] = first.items.map((i: { key: string }) => i.key);
  const portals = () =>
    renderer!.root.findAll(
      (node) => String(node.type) === 'DesktopNavigationPortal',
    );
  const portal = (slot: string) =>
    portals().find((n) => n.props.slot === slot)!;
  // Every portal finds its host by id; native attaches it to the XAML element for its slot.
  expect(portals().every((n) => n.props.hostId === first.hostId)).toBe(true);
  expect(
    portals()
      .map((n) => n.props.slot)
      .sort(),
  ).toEqual(
    [`content:${a}`, `content:${b}`, 'footer', `icon:${a}`, `icon:${b}`].sort(),
  );
  // Icons render before any geometry is reported and keep React context.
  const svgs = () => renderer!.root.findAll((n) => String(n.type) === 'Svg');
  expect(svgs()).toHaveLength(2);
  expect(svgs()[0].props.stroke).toBe('#c4a0ff');
  // Inactive scenes stay mounted inside their (unattached) portals.
  expect(
    portal(`content:${b}`).findByProps({ testID: 'scene-b' }),
  ).toBeTruthy();
  expect(portal('footer').findByProps({ testID: 'footer' })).toBeTruthy();
  event({
    type: 'layout',
    frames: { [a]: { x: 240, y: 0, width: 500, height: 700 } },
    iconFrames: {
      [a]: {
        frame: { x: 16, y: 56, width: 16, height: 16 },
        clip: { x: 16, y: 56, width: 16, height: 16 },
      },
    },
  });
  const content = portal(`content:${a}`).children[0] as ReturnType<typeof host>;
  expect(StyleSheet.flatten(content.props.style)).toMatchObject({
    width: 500,
    height: 700,
  });
  expect(content.props.pointerEvents).toBe('auto');
  const icon = portal(`icon:${a}`).children[0] as ReturnType<typeof host>;
  expect(StyleSheet.flatten(icon.props.style)).toMatchObject({
    width: 16,
    height: 16,
  });
  expect(icon.props.pointerEvents).toBe('none');
  // Without a reported frame, a scene is not interactive.
  const hidden = portal(`content:${b}`).children[0] as ReturnType<typeof host>;
  expect(hidden.props.pointerEvents).toBe('none');
});

it('measures a React sidebar footer, reserves native space and places it at the reported frame', () => {
  const Sidebar = createSidebarNavigator<{ A: undefined; B: undefined }>();
  let footerProps!: import('../src/native').SidebarFooterProps;
  let shown!: (value: boolean) => void;
  function App() {
    const [visible, setVisible] = React.useState(true);
    shown = setVisible;
    return (
      <Sidebar.Navigator
        width={200}
        renderSidebarFooter={
          visible
            ? (props) => {
                footerProps = props;
                return <Text testID="footer">Settings</Text>;
              }
            : undefined
        }
      >
        <Sidebar.Screen name="A" component={() => null} />
        <Sidebar.Screen name="B" component={() => null} />
      </Sidebar.Navigator>
    );
  }
  render(
    <NavigationContainer>
      <App />
    </NavigationContainer>,
  );
  const container = () => {
    let node = renderer!.root.findByProps({ testID: 'footer' }).parent;
    while (node && typeof node.props.onLayout !== 'function')
      node = node.parent;
    return node!;
  };
  expect(footerProps).toMatchObject({ collapsed: false, children: null });
  expect(configuration().footerHeight).toBeUndefined();
  expect(container().props.pointerEvents).toBe('none');
  expect(container().props.style).toContainEqual(
    expect.objectContaining({ width: 200, opacity: 0 }),
  );
  act(() =>
    container().props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 52.3 } },
    }),
  );
  expect(configuration().footerHeight).toBe(53);
  const revision = configuration().revision;
  act(() =>
    container().props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 52.6 } },
    }),
  );
  expect(configuration().revision).toBe(revision);
  event({
    type: 'layout',
    frames: {},
    footerFrame: { x: 8, y: 540, width: 184, height: 53 },
  });
  expect(container().props.pointerEvents).toBe('box-none');
  expect(container().props.style).toContainEqual({
    left: 8,
    top: 540,
    width: 184,
  });
  act(() => footerProps.toggleSidebar());
  expect(configuration().collapsed).toBe(true);
  expect(footerProps.collapsed).toBe(true);
  act(() => footerProps.toggleSidebar());
  expect(configuration().collapsed).toBe(false);
  act(() => shown(false));
  expect(renderer!.root.findAllByProps({ testID: 'footer' })).toHaveLength(0);
  expect(configuration().footerHeight).toBeUndefined();
  const rect = { x: 0, y: 0, width: 10, height: 10 };
  expect(
    parseNativeEvent(
      JSON.stringify({
        type: 'layout',
        revision: 0,
        frames: {},
        footerFrame: rect,
      }),
    ),
  ).not.toBeNull();
  for (const footerFrame of [null, [], { ...rect, height: -1 }, { x: 0 }]) {
    expect(
      parseNativeEvent(
        JSON.stringify({
          type: 'layout',
          revision: 0,
          frames: {},
          footerFrame,
        }),
      ),
    ).toBeNull();
  }
});
