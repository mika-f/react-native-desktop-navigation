# Guide

This guide covers the full JS API exported from `@natsuneko-laboratory/react-native-desktop-navigation` (the `/` entry point): Stack, Sidebar, Tabs, Split, hooks, keyboard handling, persistence, and styling.

For the experimental SwiftUI / WinUI renderer exported from `/native`, see [NATIVE.md](../NATIVE.md). For a full running example, see [examples/desktop](../examples/desktop).

## Stack

```tsx
import {
  NavigationContainer,
  createStackNavigator,
  type StackScreenProps,
} from '@natsuneko-laboratory/react-native-desktop-navigation';
import { Button, Text } from 'react-native';

type Params = {
  Home: undefined;
  Profile: { userId: string };
};
const Stack = createStackNavigator<Params>();

function Home({ navigation }: StackScreenProps<Params, 'Home'>) {
  return (
    <Button
      title="Profile"
      onPress={() => navigation.push('Profile', { userId: '123' })}
    />
  );
}
function Profile({ route }: StackScreenProps<Params, 'Profile'>) {
  return <Text>{route.params.userId}</Text>;
}
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ animation: 'fade' }}
      >
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen
          name="Profile"
          component={Profile}
          options={({ route }) => ({ title: route.params.userId })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

Calling `navigate('Profile')` with a wrong route name or params produces a type error. If a screen requires params at launch, provide `initialParams` on that Screen. Keep screen declarations stable while mounted; when adding or removing declarations, or changing a Navigator's `id`, change the React `key` to force a remount.

| API                              | Behavior                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `navigate(name, params?)`        | Goes back to the closest route with the same name, or pushes a new one if none exists |
| `push(name, params?)`            | Adds a new instance with a unique key                                                 |
| `replace(name, params?)`         | Replaces the active route                                                             |
| `pop(count = 1)`                 | Removes the given number of routes, keeping the root                                  |
| `popTo(name, params?)`           | Goes back to the given route; warns and no-ops if it doesn't exist                    |
| `popToRoot()`                    | Returns to the first route                                                            |
| `goBack()` / `canGoBack()`       | Handles going back from the current Navigator to its parent                           |
| `goForward()` / `canGoForward()` | Moves forward to the next state in desktop history                                    |

`historyBehavior="stack"` is the default. With `"desktop"`, the route array before each transition is kept as Back / Forward history, and the Forward history is discarded when a new transition happens after going Back. There is no cap on history size.

Screen options support `title`, `headerShown`, `header`, `headerLeft`, `headerRight`, `contentStyle`, `animation`, `presentation`, `focusBehavior`, and `inactiveBehavior`. `header` and similar options accept a ReactNode or a function that receives props.

- `inactiveBehavior`: `keep` (default) keeps the local state of hidden screens without unmounting them. `unmount` destroys the inactive component. The navigation state of child Navigators is preserved either way.
- `animation`: `default` / `none` / `fade` / `slide-horizontal` / `slide-vertical`. Enter animations are implemented with React Native's `Animated`.
- `presentation`: `card` / `modal` / `dialog`. `modal` and `dialog` are overlays built with React Native `View`; they are not OS-native dialogs and do not provide a complete keyboard focus trap.

## Sidebar / Tabs

```tsx
const Sidebar = createSidebarNavigator<{
  Timeline: undefined;
  Albums: undefined;
  Settings: undefined;
}>();

<Sidebar.Navigator width={240} collapsible>
  <Sidebar.Section title="Workspace">
    <Sidebar.Screen name="Timeline" component={Timeline} />
  </Sidebar.Section>
  <Sidebar.Section title="Library">
    <Sidebar.Screen name="Albums" component={Albums} options={{ badge: 3 }} />
    <Sidebar.Screen
      name="Settings"
      component={Settings}
      options={{ disabled: false }}
    />
  </Sidebar.Section>
</Sidebar.Navigator>;
```

Sidebar supports `label`, `icon` (a ReactNode, or a function that receives `{ focused, disabled }`), `badge`, `hidden`, and `disabled`. Use `select(name)` or `navigate(name, params?)` to select an item, and `collapseSidebar()` / `expandSidebar()` / `toggleSidebar()` to open and close it. It also supports `position="right"`, `width` / `minWidth` / `maxWidth`, `collapsedWidth`, and `defaultCollapsed`.

Arrow Up / Down, Home, and End move focus among visible, enabled items, and Enter selects the focused item. Avoid configurations where every item is hidden or disabled.

`createTabNavigator<Params>()` also returns `Navigator` and `Screen`. Tabs render at the top of the screen and support `select` / `navigate` / `nextTab` / `previousTab`. Switch tabs with Ctrl+Tab / Ctrl+Shift+Tab, and use ← / → / Home / End / Enter within the tab bar.

## Split and nesting

```tsx
const Split = createSplitNavigator();

<Split.Navigator
  layout={({ width }) => (width < 700 ? ['content'] : ['sidebar', 'content'])}
  onColumnResize={(id, width) => console.log(id, width)}
>
  <Split.Column
    id="sidebar"
    component={SidebarNavigation}
    minWidth={180}
    maxWidth={320}
  />
  <Split.Column id="content" component={ContentNavigation} minWidth={320} />
</Split.Navigator>;
```

Split supports 2 or 3 columns. Dragging a divider with the mouse, pressing ← / →, or using accessibility increase/decrease actions updates the widths of the two adjacent columns together, respects the min/max on both sides, and preserves the position of the other divider when there are three columns. The displayed width is computed from the measured width of the Split itself and of each Divider, and the last visible column absorbs the remaining width. When the window shrinks, each column shrinks down to its `minWidth`. If the total falls below the sum of all columns' `minWidth`, hide a column via `layout`. `layout` must return one or more unique, known column IDs. Hidden columns keep their component and navigation state. Whether a column is shown or hidden is determined entirely by the return value of `layout`.

### Making the Sidebar bar follow the Divider too

If the Sidebar's bar has a fixed numeric width, changing the Split column's width won't change the bar's own width. When you place the item list in a dedicated Split column, specify `width="fill"`. Dragging the column then makes the items, selection background, and footer all follow the column's width. The bar never draws beyond the column's width.

```tsx
function SidebarNavigation() {
  return (
    <Sidebar.Navigator width="fill" collapsedWidth={56}>
      {/* Sidebar.Screen for the item list; screen content lives in another Split column */}
    </Sidebar.Navigator>
  );
}

<Split.Navigator onColumnResize={(id, width) => saveWidth(id, width)}>
  <Split.Column
    id="sidebar"
    component={SidebarNavigation}
    defaultWidth={240}
    minWidth={180}
    maxWidth={400}
  />
  <Split.Column id="content" component={ContentNavigation} minWidth={320} />
</Split.Navigator>;
```

`width="fill"` makes the Sidebar's bar use the entire width of its parent. If you display a screen next to the bar within the same Sidebar Navigator, keep using a numeric `width` as before. Collapsing a Sidebar placed directly in a `Split.Column` also shrinks the column width and the Divider down to `collapsedWidth` (default 56). Expanding it restores the last drag-adjusted column width, recalculated to fit the current window width and each column's min/max. This also works for a right-side Sidebar, `defaultCollapsed`, programmatic open/close, and restoring from saved state.

While collapsed, `collapsedWidth` takes priority over the column's `minWidth` and pins the column at that width. To keep the column width fixed and only open/close the Sidebar's bar, set `collapsible={false}` on the `Split.Column`. A Sidebar nested further inside a Stack or Tabs screen does not affect the outer Split column's width.

Column widths and divider positions read the same navigation state. `onColumnResize` is called for each column whose width changed, whether from a drag or a linked Sidebar open/close, so a single drag can fire two notifications (for the columns on either side). Width recalculation from a window resize is reflected via `onStateChange`. Neither resizing nor toggling divider visibility remounts a column's component.

A Navigator can be placed inside a Screen's or Column's component. Actions are handled by the current Navigator and, if unhandled, propagate to the parent. Between sibling Navigators, you can target one explicitly with `dispatch({ type, target: nodeId, ... })`. When placing multiple Navigators of the same kind under the same Screen, give each a unique `id`.

## Hooks / Events / Focus

```tsx
const navigation = useNavigation<StackNavigation<Params>>();
const route = useRoute<NavigationRoute<'Profile', Params['Profile']>>();
const activeKey = useNavigationState((state) => state.activeRouteKey);

useFocusEffect(
  React.useCallback(() => {
    const unsubscribe = subscribeToUpdates();
    return unsubscribe;
  }, []),
);

React.useEffect(
  () =>
    navigation.addListener('beforeRemove', (event) => {
      if (hasUnsavedChanges) event.preventDefault();
    }),
  [navigation, hasUnsavedChanges],
);
```

`focus` / `blur` / `beforeRemove` / `state` events are dispatched, and `addListener` returns an unsubscribe function. When an action such as going back or replacing also removes child screens, their `beforeRemove` listeners are checked too; if any one of them is prevented, the whole action is not applied. On a focus change, `blur` is dispatched from child to parent, and `focus` from parent to child.

Because desktop focus APIs differ per platform, register native controls that need reliable focus restoration with `NavigationFocusable`.

```tsx
<NavigationFocusable id="search">
  <TextInput accessibilityLabel="Search" />
</NavigationFocusable>
```

The child should be a control that exposes `ref.focus()` and `onFocus`. `focusBehavior="restore"` (default) restores the most recently registered control, `"first"` restores the first registered control, and `"none"` leaves it to the app. There is no automatic restoration that scans unregistered native controls.

## Keyboard / Platform Adapter

The default Back / Forward shortcuts are Cmd+[ / Cmd+] on macOS and Alt+Left / Alt+Right on Windows. Key events that bubble within the Container are handled there. Events already handled by a child, and events during TextInput editing, are left alone. To implement your own shortcut scope, call `stopPropagation()` in the child's handler.

You can disable this with `keyboardShortcuts={false}`. Pass shortcut arrays via `{ back, forward, nextTab, previousTab }` to override the defaults. Use `platformAdapter` to replace transitions, default widths, TextInput detection, and key bindings.

Native event wiring is based on the official [macOS View events](https://microsoft.github.io/react-native-macos/api/view-events) and [Windows IKeyboardProps](https://microsoft.github.io/react-native-windows/docs/ikeyboardprops-api/) docs. Verify native key event / focus behavior against your app's RN desktop version.

## Persistence and Ref

```tsx
const navigationRef = createNavigationRef<Params>();
const initialState = savedJson ? restoreNavigationState(savedJson) : undefined;

<NavigationContainer
  ref={navigationRef}
  initialState={initialState}
  onStateChange={(state) => save(serializeNavigationState(state))}
>
  <AppNavigator />
</NavigationContainer>;

if (navigationRef.isReady()) {
  navigationRef.navigate('Profile', { userId: '123' });
}
```

Ref operations before the Container mounts or after it unmounts are no-ops. `initialState` is only read on the first mount. The snapshot is a version-1 node tree; putting non-JSON values such as functions, circular references, or `Date` objects into params will throw. Components, options, React local state, and the last-focused control are not persisted. You choose the storage backend.

`theme` accepts a `NavigationTheme`, and `DefaultTheme` / `useNavigationTheme` are exported.

## Customizing component design

Overall coloring comes from the Container's `theme`; shape, spacing, and text for each part are set through the following props / options. They accept `StyleSheet.create` values, arrays, and regular React Native `StyleProp`s.

| Target                      | Customization API                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Container / whole Navigator | `style` (Container also has `theme`)                                                                                        |
| Screen                      | `sceneStyle` (outer frame) and `contentStyle` (screen content) in `screenOptions` / Screen `options`                        |
| Stack Header                | `headerStyle`, `headerTitleStyle`, `headerTintColor`                                                                        |
| Header left/right, Back     | `headerLeftContainerStyle`, `headerRightContainerStyle`, `headerBackButtonStyle`, `headerBackTitleStyle`, `headerBackTitle` |
| Modal / Dialog              | `overlayStyle` (background) and `dialogStyle` (dialog surface) in Stack options                                             |
| Sidebar / Tabs bar          | Navigator's `barStyle`, `barContentStyle` (inside the scroll area), `contentStyle` (outer frame of the screen area)         |
| Sidebar / Tabs items        | Screen options' `itemStyle`, `labelStyle`, `iconContainerStyle`, `badgeStyle`, `renderItemContent`                          |
| Sidebar Section heading     | Navigator's `sectionStyle` / `sectionTitleStyle`, Section's `style` / `titleStyle` / `renderTitle`                          |
| Sidebar collapse button     | Navigator's `collapseButtonShown`, `collapseButtonStyle`, `collapseLabelStyle`, `renderCollapseButtonContent`               |
| Split columns               | Navigator's `columnStyle`, Column's `style` / `contentStyle`                                                                |
| Split dividers              | Navigator's / Column's `dividerShown`, `dividerStyle`, `renderDivider`                                                      |

`screenOptions` sets the default for every Screen. Specifying the same option on a Screen's `options` overrides it for that screen. Your styles are applied after the built-in default styles. However, navigation itself still controls `display: none` on hidden scenes, Split column widths / min-max / visibility, and `opacity` / `transform` during transitions. Set column widths via `defaultWidth` / `minWidth` / `maxWidth` and resize interactions.

### Selected, focused, hovered, and pressed states

```tsx
<Sidebar.Navigator
  barStyle={{ backgroundColor: '#201a2b', borderRightWidth: 0 }}
  barContentStyle={{ padding: 8 }}
  screenOptions={{
    itemStyle: ({ selected, focused, hovered, pressed, disabled }) => ({
      backgroundColor: pressed
        ? '#68458c'
        : selected
          ? '#493265'
          : hovered
            ? '#30253e'
            : 'transparent',
      borderColor: focused ? '#c4a0ff' : 'transparent',
      opacity: disabled ? 0.4 : 1,
      borderRadius: 10,
    }),
    labelStyle: ({ selected }) => ({
      color: '#fff',
      fontWeight: selected ? '700' : '400',
    }),
    badgeStyle: { color: '#ddc9ff', paddingHorizontal: 6 },
  }}
>
  {/* Sidebar.Screen / Sidebar.Section */}
</Sidebar.Navigator>
```

Each of the four item style options accepts either a static style or a function that receives `NavigationItemState`. The state includes `selected`, `focused`, `hovered`, `pressed`, `disabled`, and `collapsed`. `selected` reflects the currently displayed screen, and `focused` reflects native / keyboard focus on the item. The existing `icon({ focused })` still uses `focused` to mean the selected state, as before. `badgeStyle` styles a string/number badge; for a ReactNode badge, style the node itself.

### Hiding the Divider / replacing the Sidebar footer

To fully hide a Split divider, set `dividerShown={false}`. This removes not just the line, but also the divider's hit area, the mouse-drag region, and its keyboard / accessibility actions. The column's component and state are preserved.

```tsx
<Split.Navigator dividerShown={false}>
  <Split.Column id="sidebar" component={SidebarNavigation} minWidth={180} />
  <Split.Column id="content" component={ContentNavigation} minWidth={320} />
</Split.Navigator>
```

Setting `dividerShown` on a Column overrides the Navigator's setting for the divider immediately after that column. The last visible column never shows a divider. `renderDivider={() => null}` is the existing API for hiding only the divider's contents; use `dividerShown` when you want to remove the whole hit area. To keep resize interactions but make only the line invisible, use `dividerStyle={{ backgroundColor: 'transparent' }}`.

The Sidebar's own edge border is separate from the Split divider. To remove both, also set `barStyle={{ borderLeftWidth: 0, borderRightWidth: 0 }}` on the Sidebar.

The `«` shown at the bottom of the Sidebar is its collapse button. To hide only the button, set `collapseButtonShown={false}`. To replace the entire footer with custom UI, use `renderSidebarFooter`.

```tsx
<Sidebar.Navigator
  sidebarFooterStyle={{ padding: 8 }}
  renderSidebarFooter={({ collapsed, toggleSidebar }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      focusable
      onPress={toggleSidebar}
      style={{ padding: 10, borderWidth: 0 }}
    >
      <Text>{collapsed ? 'Expand' : 'Collapse'}</Text>
    </Pressable>
  )}
>
  {/* Sidebar.Screen */}
</Sidebar.Navigator>
```

This renderer entirely replaces the default Pressable. `renderSidebarFooter={() => null}` also removes the footer's outer frame and padding. The existing `renderCollapseButtonContent` remains available as the API for replacing only the contents of the default button.

`SidebarFooterProps` provides `collapsed`, `toggleSidebar` / `collapseSidebar` / `expandSidebar`, and `children`, the default button's contents. Rendering `children` lets you include the default button inside your own footer. When `collapseButtonShown={false}` or `collapsible={false}`, `children` is `null`. A fully custom footer can still be shown independent of these settings. Labels, roles, and key handling for a fully replaced UI are your app's responsibility.

### Replacing item and divider contents

```tsx
<Sidebar.Screen
  name="Albums"
  component={Albums}
  options={{
    renderItemContent: ({ label, selected, collapsed, children }) => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 3, height: 20, backgroundColor: selected ? '#c4a0ff' : 'transparent' }} />
        {children}
        {!collapsed && <Text accessibilityElementsHidden>{label.length}</Text>}
      </View>
    ),
  }}
/>

<Split.Navigator
  dividerStyle={({ dragging }) => ({ width: 12, backgroundColor: dragging ? '#493265' : '#222' })}
  renderDivider={({ columnId, width, dragging }) => (
    <View style={{ width: 3, height: 40, backgroundColor: dragging ? '#c4a0ff' : '#555' }} />
  )}
>
  {/* Split.Column */}
</Split.Navigator>
```

`renderItemContent`'s `children` is the standard icon / label / badge with your styles already applied. You can also replace the whole thing. The library still manages the outer Pressable, so click handling, keyboard selection, `disabled`, the accessibility label, and selection state all keep working. Return only display nodes; do not nest independent interactive elements such as buttons inside the return value.

`renderCollapseButtonContent` also receives the standard `children` and `collapsed`. `renderDivider` receives `columnId`, the column's current `width`, and `dragging`, while the outer resize / keyboard / accessibility handling is preserved. A renderer set on a Column takes priority over the Navigator's renderer, and divider styles are applied Navigator first, then Column.

The whole header can also be replaced with the existing `header`, and its left/right contents with `headerLeft` / `headerRight`. When you replace these entirely, implement your own rendering, interaction, and accessibility attributes in the renderer. The default Dialog background color is `theme.colors.surface`.

Styles and renderers you configure are not saved into the navigation state JSON. See [Customization.tsx](../examples/desktop/Customization.tsx) for a runnable example.

## Verification and compatibility

The peerDependencies are React `>=18` / React Native `>=0.78`. This is the installable range, not a guarantee that every combination has been verified natively.

| Library | React / RN types                                      | RN macOS native | RN Windows native |
| ------- | ----------------------------------------------------- | --------------- | ----------------- |
| 0.1.0   | Locally automated tests with React 19.1.0 / RN 0.81.0 | Unverified      | Unverified        |

CI runs type checking, Router / Store tests, React UI tests with native primitives replaced, and package builds on Linux / macOS / Windows. As of adding this CI configuration, its results on remote CI runners have not yet been confirmed. Only versions that have completed real-device verification will be added to this table.

```sh
npm ci
npm run check
npm run format:check
npm pack --dry-run
```

An [Example App](../examples/desktop/App.tsx) and [run / acceptance instructions](../examples/desktop/README.md) are provided. Automated tests verify screen retention, nesting, focus restoration, per-OS key bindings, Tabs, Split dragging, responsive layout, and serialize / restore.

## Internal structure

```text
src/core       Store / Container / hooks / events / focus / scene
src/routers    Platform- and React-independent state transitions
src/stack      Stack / Header
src/sidebar    Sidebar / Section
src/tabs       Desktop Tabs
src/split      Columns / resizing / responsive layout
src/platform   macOS / Windows adapters and the type boundary for native props
```

The Router alone is available from `@natsuneko-laboratory/react-native-desktop-navigation/routers`. A Navigator dispatches actions to the Store; it never mutates the Router or State directly.

Multi-window support, detachable tabs, native title bars, Group, deep linking, and custom transition drivers are out of scope for this version.
