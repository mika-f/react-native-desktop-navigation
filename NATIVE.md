# Native desktop navigation (Fabric / experimental)

`@natsuneko-laboratory/react-native-desktop-navigation/native` is an entry point that reuses the existing Router / Store / Context and connects navigation rendering to SwiftUI / WinUI. The existing `/` entry point continues to provide the React Native `View`-based Navigators.

| Navigator                | macOS                                          | Windows                                                                 |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `createStackNavigator`   | SwiftUI `NavigationStack` with a native header | A WinUI header and content area; history is managed by the shared Store |
| `createSidebarNavigator` | `NavigationSplitView` and `List`               | `NavigationView`                                                        |
| `createSplitNavigator`   | A 2-3 column `NavigationSplitView`             | `SplitView`, plus an additional Grid / Thumb for 3 columns              |

Each screen's React tree stays inside the original Fabric tree. React Scenes are placed into the content area the native side reports, so Context, per-screen local state, nested Navigators, and existing Hooks are all shared. React screens are never remounted onto a separate root or reparented into the native hierarchy.

## Requirements and setup

- **Fabric only.** This throws an error under Paper.
- macOS: implementation targets macOS **14 or later**, and React Native macOS **0.81.x or later**.
- Windows: uses React Native Windows **0.82 or later**'s Fabric / XAML Island APIs and requires `UseExperimentalWinUI3`. Windows on 0.81 is not supported.
- Metro's Babel preset should be the `@react-native/babel-preset` that matches your host's RN version. Static ViewConfigs are generated from the NativeComponent specs.

The package bundles a Podspec, Fabric Codegen specs, a Windows C++ project, and autolinking configuration. A native rebuild of your app is required after installation. There is no automatic fallback to the JS version when native linking is missing.

### macOS

Enable Fabric in your host app and set the deployment target to 14.0 or later. Run `bundle exec pod install` (or plain `pod install` for hosts not using Bundler) in the host's macOS directory, then rebuild in Xcode. This wires in the `DesktopNavigation` Pod and the Codegen `DesktopNavigationHost` component provider.

### Windows

Set the following in the `PropertyGroup` of your host's `windows/ExperimentalFeatures.props`, keeping any other existing settings, then run RNW's autolinking and build.

```xml
<UseNewArchitecture>true</UseNewArchitecture>
<UseExperimentalWinUI3>true</UseExperimentalWinUI3>
```

```sh
npx react-native autolink-windows
npx react-native run-windows
```

The library project targets the VS 2022 v143 toolset. Your host needs a matching Desktop C++ / Windows SDK / RNW build environment. For hosts where autolinking isn't available, reference `windows/DesktopNavigation/DesktopNavigation.vcxproj` directly and add `winrt::DesktopNavigation::ReactPackageProvider()` to the host's PackageProviders.

### Hosts that only use the JS version

The JS API itself doesn't require a native host. If you don't need to pull in the native project at all, add the following to your host's `react-native.config.js` `dependencies` to disable autolinking for the relevant platforms:

```js
'@natsuneko-laboratory/react-native-desktop-navigation': {
  platforms: { ios: null, macos: null, windows: null },
},
```

## Example

```tsx
import {
  NavigationContainer,
  createStackNavigator,
  type StackScreenProps,
} from '@natsuneko-laboratory/react-native-desktop-navigation/native';
import { Button, Text } from 'react-native';

type Params = { Home: undefined; Detail: { id: string } };
const Stack = createStackNavigator<Params>();

function Home({ navigation }: StackScreenProps<Params, 'Home'>) {
  return (
    <Button
      title="Open"
      onPress={() => navigation.push('Detail', { id: '42' })}
    />
  );
}
function Detail({ route }: StackScreenProps<Params, 'Detail'>) {
  return <Text>{route.params.id}</Text>;
}
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        appearance={{
          backgroundColor: '#201a2b',
          foregroundColor: '#ffffff',
          accentColor: '#c4a0ff',
        }}
      >
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen
          name="Detail"
          component={Detail}
          options={{ title: 'Detail' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

`NavigationContainer`, the ref, Hooks, `StackNavigation` / `SidebarNavigation`, and the persistence functions are the same implementation as the JS version. You can combine them with the JS version's Tabs or a custom Sidebar inside the same Container. `/native` does not export Tabs; import Tabs from `/` instead.

## Styling and API

Each Native Navigator's `appearance` accepts the following colors. Any value left unspecified falls back to the Container's `theme`'s `background` / `text` / `accent` / `surface`. Use `#RRGGBB` or `#RRGGBBAA` for native boundary colors.

- `backgroundColor`: content background
- `foregroundColor`: text color for headers and items
- `accentColor`: macOS tint color; Windows back button and selection indicator
- `sidebarBackgroundColor`: Sidebar background

Passing `null` for a value skips the Container's `theme` and falls back to the OS default appearance. On macOS, `sidebarBackgroundColor: null` gives a translucent sidebar material, `accentColor: null` uses the system accent color, and `foregroundColor: null` uses a label color that follows light / dark mode. On Windows, each control's own default color is used.

```tsx
<Sidebar.Navigator
  appearance={{ sidebarBackgroundColor: null, foregroundColor: null }}
/>
```

On macOS, the native Sidebar does not apply `foregroundColor` to the label of the selected item (the OS's own selection color is preserved).

`style` applies to the whole Navigator, and `sceneStyle` / `contentStyle` apply to a Screen. This is not an API for applying an arbitrary `ViewStyle` directly to OS-drawn parts.

### Stack

`initialRouteName`, `historyBehavior`, `screenOptions`, Screen `options`, and typed params work the same as in the JS version. `title`, `headerShown`, and `headerBackTitle` are reflected in the native header.

For a screen that specifies a custom header via `header`, `headerStyle`, `headerTitleStyle`, `headerTintColor`, `headerLeft` / `headerRight`, or similar, rendering falls back to the existing React Native `StackHeader`. The navigation container itself remains native.

```tsx
<Stack.Navigator
  screenOptions={{
    headerStyle: { backgroundColor: '#201a2b', borderBottomWidth: 0 },
    headerTitleStyle: { color: '#ffffff', fontSize: 18 },
    contentStyle: { padding: 16 },
  }}
>
  {/* Stack.Screen */}
</Stack.Navigator>
```

At this stage, only card presentation is supported; `presentation` / `animation` / overlay / dialog options are not provided. SwiftUI's own transition animations are also disabled, so the native container and the React Scene don't animate independently. Use the JS version's Stack for any part of the tree that needs these.

### Sidebar

`Navigator` accepts `initialRouteName`, `defaultCollapsed`, `width` (a number, 100 or greater), `appearance`, `style`, `screenOptions`, and `renderSidebarFooter`. `Screen` supports `label` / `title`, `icon`, `iconSize`, `badge`, `hidden`, `disabled`, and the common Scene options. Use `Section title="…"` for a heading.

Selection and open/close state stay in sync with the existing `select` / `navigate` / `collapseSidebar` / `expandSidebar` / `toggleSidebar`. The macOS width is the width suggested to SwiftUI.

`icon` accepts a React element (e.g. Lucide or `react-native-svg` JSX), a native system icon, or an image. macOS renders SF Symbols and Windows renders `FontIcon` / `BitmapIcon` inside the native item.

```tsx
<Sidebar.Screen
  name="Home"
  component={Home}
  options={{
    icon: ({ focused, disabled }) => ({
      type: 'system',
      macos: focused ? 'house.fill' : 'house',
      windows: { glyph: '' },
      size: 16,
      color: disabled ? '#888888' : '#c4a0ff',
    }),
  }}
/>
```

`icon` can be a React element, a `NativeSidebarIcon` object, `null`, or a function receiving `{ focused, disabled }`. As in the JS version, `focused` represents the item's **selected** state. Returning `null` hides the icon. Set a default with `screenOptions.icon` and override it per Screen if needed.

- `type: 'system'`: pass an SF Symbols name in `macos`, and a Unicode **string** in `windows.glyph`. If `fontFamily` is omitted on Windows, WinUI's standard OS icon font is used. To use a custom font, specify it like `windows: { glyph: '', fontFamily: 'My Icon Font' }` and make sure the host app bundles that font. Omitting the value for one OS shows text only on that OS.
- `size`: defaults to 16. Units are logical points / DIPs. Choose a size that fits the standard item layout.
- `color`: `#RRGGBB` / `#RRGGBBAA`. If omitted, the native item's own style is used.

You can also use a custom image.

```tsx
options={{
  icon: {
    type: 'image',
    source: require('./icons/library.png'),
    size: 18,
    template: true,
    color: '#c4a0ff',
  },
}}
```

`source` is a Metro `require()` or `{ uri: '…' }`. Use a raster image format such as PNG that both OSes can read. `template: true` renders the image as a single-color icon based on its alpha channel; the default `false` preserves the image's original colors. `color` applies to system icons and template images.

Image URIs support HTTP(S) and `file://`, and on Windows also `ms-appx:///` / `ms-appdata:///`. Your host app must be able to access that file or URI. If loading fails, the item's title and selection still work. This image descriptor does not support SVG, data URIs, or sources requiring auth headers. Pass SVGs as a React element as described below instead. The icon image itself is treated as decorative; the accessibility label uses the item's title.

#### Badges

Setting `badge` to a number or string shows a native badge at the end of the item. A number `0` or below, and an empty string, hide it.

```tsx
<Sidebar.Screen
  name="Notifications"
  component={Notifications}
  options={{ badge: unreadCount }}
/>
```

macOS uses SwiftUI's `badge`, and Windows uses `InfoBadge`. Since Windows' `InfoBadge` can only display integers, a non-numeric string falls back to a dot indicator.

#### Lucide / React element icons

In your app, install and natively link `lucide-react-native` and its dependency `react-native-svg` (see the [official Lucide guide](https://lucide.dev/guide/react-native/getting-started)). Neither is a runtime dependency of this library.

```tsx
import { House } from 'lucide-react-native';
import { createSidebarNavigator } from '@natsuneko-laboratory/react-native-desktop-navigation/native';

const Sidebar = createSidebarNavigator<{ Home: undefined }>();

<Sidebar.Screen
  name="Home"
  component={Home}
  options={{
    iconSize: 20,
    icon: ({ focused, disabled }) => (
      <House
        size={20}
        color={disabled ? '#888888' : focused ? '#c4a0ff' : '#ffffff'}
        strokeWidth={1.75}
      />
    ),
  }}
/>;
```

You can also pass an element directly, e.g. `icon: <House size={20} color="#c4a0ff" />`. `iconSize` is the square area reserved inside the native item for a React icon, defaulting to 24 points / DIPs; it can also be set via `screenOptions.iconSize`. The element is centered, and anything that overflows the area is clipped. Set the icon's own `size` and `color` in the JSX; native selected/disabled colors are not applied to the JSX automatically. The descriptor's own size is still `icon.size`, unchanged.

React icons render inside the original Fabric tree and preserve React Context. Only the size of the empty icon area is sent to the native side — React elements and SVGs are never serialized to JSON or rasterized. They follow the position and clip region measured natively, and keep their SVG size while clipped during scrolling. Clicks and scrolling pass through to the native item, and icons are treated as decorative for accessibility. They are hidden while a macOS sidebar is collapsed, and follow the visible area of a compact Windows pane.

SVG icon rendering has been verified on macOS 0.81 / Fabric with `react-native-svg` 15.15.5; use 15.15.5 or later. Existing hosts also need to rebuild this library's native code.

See [`examples/desktop/NativeLucide.tsx`](examples/desktop/NativeLucide.tsx) for a runnable example.

#### Footer

`renderSidebarFooter` lets you place a React footer (e.g. an account display or settings button) below the item list.

```tsx
<Sidebar.Navigator
  renderSidebarFooter={({ collapsed, toggleSidebar }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      focusable
      onPress={openSettings}
      style={{ padding: 12 }}
    >
      <Text>Settings</Text>
    </Pressable>
  )}
>
  {/* Sidebar.Screen */}
</Sidebar.Navigator>
```

The footer renders inside the original Fabric tree, so Context, state, interaction, and accessibility all work as usual. The natural height measured on the React side is sent to the native side, which reserves an empty area of that height below the sidebar column's List on macOS, or in `NavigationView.PaneFooter` on Windows. The footer is positioned to match the area and width measured natively, and stays hidden — with only its height measured — before that first measurement. Because height is driven by the footer's own content, avoid styles like `flex: 1` that depend on a parent's height.

`SidebarFooterProps`'s `collapsed` and `toggleSidebar` / `collapseSidebar` / `expandSidebar` are the same as in the JS version. Because the native Sidebar shows its own OS-drawn collapse button, `children` is always `null` here. The footer is hidden while the sidebar is closed (collapsed on macOS, or a closed pane on Windows). Returning `null` from `renderSidebarFooter` removes the area entirely.

`renderItemContent`, ReactNode badges, and per-item RN styles are not provided by this Native Sidebar. If you need them, use the JS version's Sidebar inside a Native Split instead.

### Split

As with the JS version, declare 2 or 3 `Split.Column`s. A Column accepts `id`, `component`, `defaultWidth`, `minWidth`, `maxWidth`, and `style` / `contentStyle`. `layout(size)` selects which columns to show; hidden columns keep their React tree and navigation state.

`onColumnResize` fires for any column whose natively measured content width changed — from a drag, or from a window resize. Widths are saved to the Store, and on restore the native suggested width is used. Because SwiftUI decides its own spacing and divider width, pixel widths won't exactly match the JS version.

Arbitrary native divider rendering / hiding, and the JS version's `collapsible` (which ties a child Sidebar's collapse state to the column width), are not provided. If you only need a collapsible navigation pane, use the Native Sidebar instead. The Windows divider supports drag via its Thumb, and left/right arrow keys when focused.

## Relationship to the window (macOS)

The native host behaves as a view embedded in React Native's layout. Yoga determines its size; SwiftUI's content size does not constrain the window's size. Window safe areas from things like `NSWindowStyleMaskFullSizeContentView` (the region under a transparent title bar) are not applied to the host's slot placement — adjust padding on the React side if you place content under the title bar. Note that the toolbar area SwiftUI's `NavigationSplitView` itself reserves is still reflected in the Sidebar's detail column and in Split columns.

## State synchronization

Native back, selection, and open/close actions are treated as requests to dispatch an action to the shared Store; native history never overwrites JS state directly. Even if `beforeRemove` prevents a back action, the current state is re-notified to the native side. Delayed events that don't match the current settings revision are discarded.

Focus restoration happens after the native layout notification. `inactiveBehavior`, persistence, and Back / Forward under `historyBehavior="desktop"` all use the shared implementation.

## Verification scope

```sh
npm run check
npm run check:native-macos
```

`check` runs TypeScript, Router / Store / React UI tests, the build, and Fabric Codegen. The Native UI tests cover `beforeRemove`, discarding stale events, screen retention, history restoration, Sidebar selection and icon switching, image source resolution, Split measurements, and nesting with JS Navigators.

`check:native-macos` requires macOS / Xcode. It compiles the SwiftUI implementation and inspects layout notifications for Stack / Sidebar (including SF Symbols and local-image icons) / 3-column Split inside an AppKit window. The window is never shown on screen.

This repository does not include an RN native host app. SVG icon rendering on macOS 0.81 / Fabric with `react-native-svg` 15.15.5 has been verified in a user's host app. **Windows C++ builds and on-device behavior are unverified.** As an experimental implementation at this stage, verify the following in your own host app:

- Native component registration, placement of nested containers, and window resizing.
- Native item selection, back navigation, and pane open/close staying in sync with JS state / focus.
- VoiceOver / Narrator, keyboard interaction, and input delivery / overlap between the Windows XAML Island and the React Scene.

Official references used during implementation: [RN macOS native development](https://microsoft.github.io/react-native-macos/docs/guides/native-development), the [RNW XAML Island component sample](https://github.com/microsoft/react-native-windows/blob/0.82-stable/packages/sample-custom-component/windows/SampleCustomComponent/CalendarView.cpp), and [NavigationView](https://learn.microsoft.com/en-us/windows/apps/design/controls/navigationview).
