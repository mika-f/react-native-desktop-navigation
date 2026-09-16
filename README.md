# React Native Desktop Navigation

[![npm version](https://img.shields.io/npm/v/@natsuneko-laboratory/react-native-desktop-navigation.svg)](https://www.npmjs.com/package/@natsuneko-laboratory/react-native-desktop-navigation)
[![CI](https://github.com/mika-f/react-native-desktop-navigation/actions/workflows/ci.yml/badge.svg)](https://github.com/mika-f/react-native-desktop-navigation/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A desktop-first navigation framework for **React Native macOS / Windows**. Stack, Sidebar, top Tabs, and a resizable 2-3 column Split, composed behind one typed, declarative API.

This is not a port of a mobile navigation library — it's built from the ground up around desktop interaction: mouse-draggable Split dividers, OS-style Back/Forward keyboard shortcuts, keyboard/accessibility-driven focus, and per-state (hover/press/focus) styling. iOS, Android, Web, and React Navigation API/state compatibility are explicit non-goals.

The only required runtime dependencies are `react` and `react-native`.

> **Status:** `0.1.0-alpha` — the JS API is exercised by an automated test suite, but real-device verification is still limited. See [Verification and compatibility](docs/GUIDE.md#verification-and-compatibility) before shipping to production.

## Features

- **Stack** — typed push/pop/replace/popTo history, card/modal/dialog presentation, per-screen animations
- **Sidebar** — collapsible, sectioned, with badges, custom icons, and full keyboard navigation
- **Tabs** — top tab bar with Ctrl+Tab cycling
- **Split** — 2-3 resizable columns with draggable dividers, min/max constraints, and responsive layout
- **Desktop keyboard model** — Cmd+[ / Cmd+] on macOS, Alt+Left / Alt+Right on Windows, out of the box
- **Deep styling** — every part accepts `StyleSheet`-compatible styles or state-aware style functions, plus custom renderers for items and dividers
- **State persistence** — serialize/restore navigation state, `NavigationContainer` ref API
- **Optional native rendering** — an experimental `/native` entry point renders Stack/Sidebar/Split with SwiftUI (macOS) and WinUI (Windows) via Fabric, sharing the same Router/Store as the JS version

## Installation

```sh
npm install @natsuneko-laboratory/react-native-desktop-navigation
```

To use a development build of the package instead, run `npm ci && npm pack` in this repository and install the generated `.tgz` into your desktop app. Metro uses the TypeScript source from the `react-native` export; regular JavaScript and type definitions are built into `dist/`.

## Quick start

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
      <Stack.Navigator initialRouteName="Home">
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

`navigate('Profile')` with a wrong route name or params is a type error. See the [Guide](docs/GUIDE.md) for Sidebar, Tabs, Split, hooks, keyboard customization, persistence, and styling.

## Native rendering (`/native`, Fabric, experimental)

`@natsuneko-laboratory/react-native-desktop-navigation/native` swaps in native Stack / Sidebar / Split implementations — SwiftUI's `NavigationStack` / `NavigationSplitView` on macOS, WinUI's `NavigationView` / `SplitView` on Windows — while reusing the same Router, Store, hooks, and `NavigationContainer` as the JS version. React screens keep rendering inside the original Fabric tree, so Context, local state, and nested Navigators all keep working.

```tsx
import {
  NavigationContainer,
  createStackNavigator,
} from '@natsuneko-laboratory/react-native-desktop-navigation/native';
```

It targets Fabric only, macOS 14+ / RN macOS 0.81.x, and Fabric on RN Windows 0.82+, and needs an additional native rebuild (Pod install / autolinking) after installing. It does not export Tabs — combine it with the JS version's `createTabNavigator` where needed. See **[NATIVE.md](NATIVE.md)** for setup instructions, styling/icon APIs, and the current verification scope, and [examples/desktop/Native.tsx](examples/desktop/Native.tsx) for a runnable example.

## Documentation

- **[Guide](docs/GUIDE.md)** — full JS API reference: Sidebar/Tabs/Split, hooks & events, focus, keyboard, persistence, styling and customization, verification/compatibility
- **[NATIVE.md](NATIVE.md)** — native (SwiftUI/WinUI) rendering: setup, styling, icons, verification scope
- **[examples/desktop](examples/desktop)** — a runnable example app plus a manual acceptance checklist

## Project layout

```text
src/core       Store / Container / hooks / events / focus / scene
src/routers    Platform- and React-independent state transitions
src/stack      Stack / Header
src/sidebar    Sidebar / Section
src/tabs       Desktop Tabs
src/split      Columns / resizing / responsive layout
src/platform   macOS / Windows adapters and the type boundary for native props
src/native     Fabric-backed SwiftUI / WinUI renderer (`/native` entry point)
```

The Router alone is available from `@natsuneko-laboratory/react-native-desktop-navigation/routers`. A Navigator dispatches actions to the Store; it never mutates the Router or State directly.

Multi-window support, detachable tabs, native title bars, Group, deep linking, and custom transition drivers are out of scope for this version.

## Contributing

```sh
npm ci
npm run check        # typecheck, tests, build, native codegen check
npm run format:check
```

Issues and pull requests are welcome at [mika-f/react-native-desktop-navigation](https://github.com/mika-f/react-native-desktop-navigation).

## License

[MIT](LICENSE) © Kanon Mochizuki
