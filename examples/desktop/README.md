# Desktop Example

`App.tsx` is a demo shared between macOS / Windows host apps. It includes Home / Timeline, Post, Profile, Albums, Settings, About, Dialog, and Tabs inside Profile.

```text
NavigationContainer
└─ Root Stack
   ├─ Main
   │  └─ Split
   │     ├─ Sidebar: Timeline / Albums / Settings
   │     └─ Content Stack: Timeline → Post → Profile (Tabs)
   ├─ About
   └─ Dialog
```

## Embedding in a host app

The demo in this directory is TypeScript source; it does not include an Xcode / Visual Studio native project. Embed it into a working host app for each platform.

1. From the library root, run `npm ci`, `npm run check`, and `npm pack`.
2. Install the generated `.tgz` into your macOS or Windows RN app with `npm install /path/to/package.tgz`.
3. Copy `App.tsx` into the host, changing the import from `../../src` to `@natsuneko-laboratory/react-native-desktop-navigation`.
4. Register this `App` with the host's `AppRegistry.registerComponent` and run it using the host's existing launch steps.

Pick RN / React versions matching each platform. The library doesn't require any additional native module or pod.

## Manual verification

The following have not yet been verified with native execution. Record results for both macOS and Windows.

- Click Timeline / Albums / Settings in the Sidebar and confirm the displayed screen switches.
- Type a Draft in Timeline, then navigate Open Post 123 → Open Profile.
- Press Back twice to return from Post → Timeline, and confirm the Draft is preserved.
- Confirm focus returns to the Draft field, and that OS edit shortcuts aren't captured while editing the TextInput.
- After switching to `inactiveBehavior="unmount"`, confirm the Draft is recreated.
- After clicking Content, confirm Cmd+[ / Cmd+] on macOS and Alt+Left / Alt+Right on Windows act on the Content Stack.
- Open About and go back, and confirm the Content Stack's state is preserved.
- Focus the Sidebar and operate it with ↑ / ↓ / Home / End / Enter and the collapse button.
- Confirm that collapsing the Sidebar also shrinks the Split column width and the Divider down to `collapsedWidth`, and that expanding it restores the drag-adjusted column width; also confirm the Divider follows along when the window is resized while collapsed.
- Operate the Tabs in Profile with Ctrl+Tab / Ctrl+Shift+Tab.
- Drag the Split divider with the mouse and confirm the sidebar's 240-420 constraint; also confirm the ← / → divider operations.
- Shrink the window below 700px wide to show content only, then confirm the sidebar's state returns when enlarged again.
- Save the `onSave` JSON to a host-side file or similar, then on restart pass the `JSON.parse`-d value as `initialState` and confirm screens and params are restored.
- Confirm with VoiceOver / Narrator that labels, selection, and disabled state are read out, and hidden screens are not.
- Open and close a Dialog, and confirm it renders as an in-app overlay rather than an OS-native modal or a complete focus trap.

Automated tests verify this React / state / event wiring. OS event delivery, mouse capture, and the accessibility bridge itself need to be verified in a host app.

## Custom design example

Copy `Customization.tsx` into the host using the same steps and register it in place of `App` to see a dark-themed Header, Sidebar, Tabs, and Split. It demonstrates per-part styling, selected / focus / hover / press states, custom item rendering, and a resize handle used while dragging.

`<Customization showDividers={false} />` fully hides the Split dividers. This example's Sidebar footer replaces the entire default button via `renderSidebarFooter`. To remove the footer altogether, pass `renderSidebarFooter={() => null}`.

Dragging a Split divider changes the widths of the two adjacent columns together. To make the Sidebar's bar follow the full column width as well, set `Sidebar.Navigator`'s `width` to `"fill"` (intended for a column dedicated to the item list). With a numeric width, the bar width stays fixed and the screen area within the same column stretches instead.

## Fabric native example

`Native.tsx` combines the Sidebar and Stack from `/native`. Build your host following the [native setup instructions](../../NATIVE.md), then change the import to the package's `/native` entry point and register it. It demonstrates input retention, navigating to and from a detail screen, preventing a back action via `beforeRemove`, custom coloring, and switching native icons based on selection state.

`NativeLucide.tsx` shows how to pass a Lucide React element to the native Sidebar's `icon`. Add `lucide-react-native` / `react-native-svg` to your host and confirm `react-native-svg` works on that OS / Fabric environment. It covers specifying `iconSize` alongside the SVG's own `size`, and changing color based on selection state. On macOS 0.81 / Fabric, use `react-native-svg` 15.15.5 or later. See the [native setup instructions](../../NATIVE.md#lucide--react-element-icons) for details.
