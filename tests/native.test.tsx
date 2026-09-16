import React from 'react';
import { House } from 'lucide-react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Text, View, UIManager, TextInput } from 'react-native';
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
import { NativeSurface, parseNativeEvent } from '../src/native/host';
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

it.each(['macos', 'windows'])(
  'renders Lucide JSX in native sidebar slots on %s, preserving clipping, context and selection',
  (os) => {
    Platform.OS = os;
    const Sidebar = createSidebarNavigator<{
      A: undefined;
      B: undefined;
      Hidden: undefined;
    }>();
    const IconColor = React.createContext('#000000');
    function ContextIcon({ focused }: { focused: boolean }) {
      const color = React.useContext(IconColor);
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
    const [a, b] = first.items.map((i: { key: string }) => i.key);
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
    event({ type: 'select', key: b });
    event({
      type: 'layout',
      frames: {},
      iconFrames: geometry,
      revision: first.revision,
    });
    expect(svgs()).toHaveLength(0); // Old native geometry cannot resurrect a stale overlay.
    event({ type: 'layout', frames: {}, iconFrames: geometry });
    expect(svgs()[0].props.stroke).toBe('#888888');
    expect(svgs()[1].props.stroke).toBe('#c4a0ff');
    event({ type: 'layout', frames: {}, iconFrames: {} });
    expect(svgs()).toHaveLength(0);
    event({ type: 'layout', frames: {}, iconFrames: geometry });
    act(() => remove());
    expect(svgs()).toHaveLength(0);
    expect(configuration().items[0].icon).toBeUndefined();
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
