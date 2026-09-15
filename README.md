# React Native Desktop Navigation

`@natsuneko-laboratory/react-native-desktop-navigation` は React Native macOS / Windows 向けの Desktop-first Navigation Framework です。Stack、Sidebar、上部 Tabs、2〜3 列の Split を、型付きの宣言的 API で組み合わせられます。

実行時の必須依存は `react` と `react-native` のみです。React Navigation との API / State 互換性、iOS / Android / Web 対応は目的としません。

## インストール

```sh
npm install @natsuneko-laboratory/react-native-desktop-navigation
```

開発中のパッケージを利用する場合は、このリポジトリで `npm ci && npm pack` を実行し、生成された `.tgz` を Desktop アプリにインストールしてください。Metro は `react-native` export の TypeScript ソースを使用します。通常の JavaScript / 型定義は `dist/` にビルドされます。

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

`navigate('Profile')` や誤った params は型エラーになります。起動時に params が必要な画面を選ぶ場合は、その Screen の `initialParams` を指定します。画面宣言はマウント中は固定してください。宣言の追加・削除や Navigator の `id` を変更する際は React の `key` を変更して再マウントします。

| API                              | 動作                                                 |
| -------------------------------- | ---------------------------------------------------- |
| `navigate(name, params?)`        | 最も直近の同名 route まで戻る。存在しなければ追加    |
| `push(name, params?)`            | 一意な key を持つ新規 instance を追加                |
| `replace(name, params?)`         | active route を置換                                  |
| `pop(count = 1)`                 | root を残して指定数を削除                            |
| `popTo(name, params?)`           | 指定 route まで戻る。存在しなければ warning と no-op |
| `popToRoot()`                    | 最初の route に戻る                                  |
| `goBack()` / `canGoBack()`       | 現在の Navigator から親へ戻る操作を処理              |
| `goForward()` / `canGoForward()` | desktop history の次の状態へ進む                     |

`historyBehavior="stack"` が既定です。`"desktop"` では遷移前の route 配列を Back / Forward の履歴として保持し、Back 後の新規遷移で Forward 履歴を破棄します。履歴数の上限は設けていません。

Screen options は `title`、`headerShown`、`header`、`headerLeft`、`headerRight`、`contentStyle`、`animation`、`presentation`、`focusBehavior`、`inactiveBehavior` に対応します。`header` などは ReactNode または props を受け取る関数です。

- `inactiveBehavior`: `keep`（既定）は非表示のまま local state を保持。`unmount` は非アクティブな component を破棄します。子 Navigator の navigation state は保持します。
- `animation`: `default` / `none` / `fade` / `slide-horizontal` / `slide-vertical`。React Native Animated による入場アニメーションです。
- `presentation`: `card` / `modal` / `dialog`。modal と dialog は React Native View の overlay です。OS native dialog や完全な keyboard focus trap は提供しません。

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

Sidebar は `label`、`icon`（ReactNode / `{ focused, disabled }` を受け取る関数）、`badge`、`hidden`、`disabled` を扱います。`select(name)` と `navigate(name, params?)` で選択し、`collapseSidebar()` / `expandSidebar()` / `toggleSidebar()` で開閉できます。`position="right"`、`width` / `minWidth` / `maxWidth`、`collapsedWidth`、`defaultCollapsed` にも対応します。

↑ / ↓ / Home / End で visible かつ enabled な項目へフォーカスを移し、Enter で選択します。全項目を hidden / disabled にする構成は避けてください。

`createTabNavigator<Params>()` も `Navigator` と `Screen` を返します。Tabs は画面上部に表示し、`select` / `navigate` / `nextTab` / `previousTab` に対応します。Ctrl+Tab / Ctrl+Shift+Tab で切り替え、Tab バーでは ← / → / Home / End / Enter で操作します。

## Split とネスト

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

2〜3 列に対応します。境界の mouse drag、← / →、accessibility の増減操作でリサイズでき、min/max を守ります。最後の visible 列は余白を利用します。`layout` は重複のない既知の列 ID を1つ以上返してください。非表示の列も component と Navigation State を保持します。`collapsible` は列のアプリ側設定用情報で、表示は `layout` の返値が決定します。

Navigator は Screen / Column の component に配置できます。action は現在の Navigator が処理し、処理できなければ親へ伝播します。兄弟 Navigator 間では `dispatch({ type, target: nodeId, ... })` で明示的に対象を指定できます。同一 Screen に同じ種類の Navigator を複数置く場合は、それぞれ固有の `id` を指定します。

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

`focus` / `blur` / `beforeRemove` / `state` を通知し、`addListener` は解除関数を返します。戻る・置換などで子画面も削除される場合、子画面の `beforeRemove` も確認し、1つでも抑止されれば action 全体を適用しません。フォーカス変更時は blur を子から親へ、focus を親から子へ通知します。

Desktop の focus API はプラットフォームごとに差があるため、確実な focus restore が必要な native control を `NavigationFocusable` で登録します。

```tsx
<NavigationFocusable id="search">
  <TextInput accessibilityLabel="Search" />
</NavigationFocusable>
```

子には `ref.focus()` と `onFocus` を公開する control を指定します。`focusBehavior="restore"`（既定）は前回の登録 control、`"first"` は最初の登録 control、`"none"` はアプリに任せます。未登録の native control を走査して自動復元する機能はありません。

## キーボード / Platform Adapter

既定の Back / Forward は macOS が Cmd+[ / Cmd+]、Windows が Alt+Left / Alt+Right です。Container 内で bubble するキーイベントを処理します。子が処理済みのイベント、および TextInput の編集中は介入しません。独自 shortcut scope は子の handler で `stopPropagation()` を使用してください。

`keyboardShortcuts={false}` で無効化できます。`{ back, forward, nextTab, previousTab }` に shortcut 配列を渡すと上書きできます。`platformAdapter` で transition、既定幅、TextInput 判定、キー割当を差し替えられます。

native event の接続は公式の [macOS View events](https://microsoft.github.io/react-native-macos/api/view-events) と [Windows IKeyboardProps](https://microsoft.github.io/react-native-windows/docs/ikeyboardprops-api/) に基づいています。アプリの RN desktop バージョンで native key event / focus の動作を確認してください。

## 保存・復元と Ref

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

Container の mount 前・unmount 後の ref 操作は no-op です。`initialState` は初回 mount 時だけ読みます。Snapshot は version 1 の node tree で、params に関数、循環参照、Date などの非 JSON 値を入れるとエラーになります。component、options、React の local state、最後の focus control は保存しません。ストレージは利用側で選択します。

`theme` は `NavigationTheme` を受け取り、`DefaultTheme` / `useNavigationTheme` を公開しています。

## 検証と互換性

peerDependencies は React `>=18` / React Native `>=0.78` です。これはインストール可能な範囲で、全組合せの native 動作保証ではありません。

| Library | React / RN 型定義                             | RN macOS native | RN Windows native |
| ------- | --------------------------------------------- | --------------- | ----------------- |
| 0.1.0   | React 19.1.0 / RN 0.81.0 でローカル自動テスト | 未検証          | 未検証            |

CI は Linux / macOS / Windows 上で型チェック、Router / Store テスト、native primitives を置き換えた React UI テスト、パッケージビルドを実行します。CI 設定の追加時点では、リモート CI の実行結果は未確認です。実機検証を完了したバージョンだけ、この表に追加します。

```sh
npm ci
npm run check
npm run format:check
npm pack --dry-run
```

[Example App](examples/desktop/App.tsx) と [実行・受け入れ確認手順](examples/desktop/README.md) を用意しています。画面保持、ネスト、focus restore、各 OS のキー割当、Tabs、Split drag、responsive layout、serialize / restore を自動テストで検証します。

## 内部構成

```text
src/core       Store / Container / hooks / events / focus / scene
src/routers    Platform と React に依存しない state transition
src/stack      Stack / Header
src/sidebar    Sidebar / Section
src/tabs       Desktop Tabs
src/split      Columns / resizing / responsive layout
src/platform   macOS / Windows adapter と native props の型境界
```

Router 単体は `@natsuneko-laboratory/react-native-desktop-navigation/routers` から利用できます。Navigator は Store に action を dispatch し、Router と State を直接変更しません。

Multi Window、detachable tabs、native titlebar、Group、deep linking、独自 transition driver はこのバージョンの対象外です。
