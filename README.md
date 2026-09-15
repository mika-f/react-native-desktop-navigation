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

2〜3 列に対応します。境界の mouse drag、← / →、accessibility の増減操作では、隣接する2列の幅を同時に更新します。両側の min/max を守り、3列の場合も他の境界の位置を保ちます。表示幅は Split 内側の実測幅と Divider の実測幅から計算し、最後の visible 列が残りの幅を使います。ウィンドウが縮む場合は各列の minWidth まで縮めます。全列の minWidth 合計を下回るサイズでは、`layout` で列を非表示にしてください。`layout` は重複のない既知の列 ID を1つ以上返してください。非表示の列も component と Navigation State を保持します。`collapsible` は列のアプリ側設定用情報で、表示は `layout` の返値が決定します。

### Sidebar も Divider に追従させる

Sidebar のバーが数値の固定幅だと、Split の列幅を変更してもバー自体の幅は変わりません。項目一覧を専用の Split 列に置く場合は、`width="fill"` を指定します。列をドラッグすると項目・選択背景・フッターも列の幅に追従します。バーは列の幅を超えて描画しません。

```tsx
function SidebarNavigation() {
  return (
    <Sidebar.Navigator width="fill" collapseButtonShown={false}>
      {/* 項目一覧用の Sidebar.Screen。画面の内容は別の Split 列に配置 */}
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

`width="fill"` は Sidebar のバーが親幅全体を使う指定です。同じ Sidebar Navigator 内でバーの横に画面を表示する場合は、従来どおり数値の `width` を使います。`collapsedWidth` は折り畳み時のバー幅です。

列幅と Divider の位置は同じ Navigation State を参照します。`onColumnResize` はユーザー操作で幅が変わった各列について呼ばれるため、1回のドラッグで左右2列分の通知が発生します。ウィンドウサイズ変更による幅の再計算は `onStateChange` に反映されます。リサイズや Divider の表示切り替えで列の component は再マウントしません。

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

## コンポーネントのデザインをカスタマイズする

全体の配色は Container の `theme`、各部位の形状・余白・文字は次の props / options で指定できます。`StyleSheet.create` の値、配列、通常の React Native `StyleProp` を受け付けます。

| 対象                       | カスタマイズ API                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Container / Navigator 全体 | `style`（Container は `theme` も利用可能）                                                                                  |
| Screen                     | `screenOptions` / Screen `options` の `sceneStyle`（外枠）、`contentStyle`（画面内容）                                      |
| Stack Header               | `headerStyle`、`headerTitleStyle`、`headerTintColor`                                                                        |
| Header 左右・Back          | `headerLeftContainerStyle`、`headerRightContainerStyle`、`headerBackButtonStyle`、`headerBackTitleStyle`、`headerBackTitle` |
| Modal / Dialog             | Stack options の `overlayStyle`（背景）、`dialogStyle`（ダイアログ面）                                                      |
| Sidebar / Tabs のバー      | Navigator の `barStyle`、`barContentStyle`（スクロール領域内）、`contentStyle`（画面領域の外枠）                            |
| Sidebar / Tabs の項目      | Screen options の `itemStyle`、`labelStyle`、`iconContainerStyle`、`badgeStyle`、`renderItemContent`                        |
| Sidebar Section 見出し     | Navigator の `sectionStyle` / `sectionTitleStyle`、Section の `style` / `titleStyle` / `renderTitle`                        |
| Sidebar 開閉ボタン         | Navigator の `collapseButtonShown`、`collapseButtonStyle`、`collapseLabelStyle`、`renderCollapseButtonContent`              |
| Split 列                   | Navigator の `columnStyle`、Column の `style` / `contentStyle`                                                              |
| Split 境界                 | Navigator / Column の `dividerShown`、`dividerStyle`、`renderDivider`                                                       |

`screenOptions` は各 Screen の既定値です。同じ option を Screen の `options` に指定すると、その option を置き換えます。既定の内部スタイルの後に指定スタイルを適用します。ただし、非表示 Scene の `display: none` と、Split の列幅・min/max・表示状態、および transition 中の `opacity` / `transform` は Navigation 側の制御を優先します。列幅は `defaultWidth` / `minWidth` / `maxWidth` とリサイズ操作で指定してください。

### 選択・フォーカス・ホバー・押下時のデザイン

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

項目の4つの style option は静的スタイルのほか、`NavigationItemState` を受け取る関数に対応します。状態は `selected`、`focused`、`hovered`、`pressed`、`disabled`、`collapsed` です。`selected` は現在の画面、`focused` は項目への native / keyboard focus を示します。既存の `icon({ focused })` の `focused` は従来どおり選択状態です。`badgeStyle` は文字列・数値のバッジ用で、ReactNode のバッジはその Node 自体をスタイリングします。

### Divider を消す / Sidebar 下部を置き換える

Split の境界を完全に消すには `dividerShown={false}` を指定します。線だけでなく、境界の幅・mouse drag 領域・keyboard / accessibility の操作対象も取り除きます。列の component と状態は保持します。

```tsx
<Split.Navigator dividerShown={false}>
  <Split.Column id="sidebar" component={SidebarNavigation} minWidth={180} />
  <Split.Column id="content" component={ContentNavigation} minWidth={320} />
</Split.Navigator>
```

Column に `dividerShown` を指定すると、その列の直後の境界について Navigator の指定を上書きできます。最後の visible 列には境界を表示しません。`renderDivider={() => null}` は境界の中身だけを消す既存 API なので、外枠ごと消す場合は `dividerShown` を使用します。リサイズ操作を残して線だけ透明にする場合は `dividerStyle={{ backgroundColor: 'transparent' }}` を使います。

Sidebar 自体の端の border は Split Divider とは別です。両方消す場合は Sidebar にも `barStyle={{ borderLeftWidth: 0, borderRightWidth: 0 }}` を指定してください。

Sidebar 下部に表示される `«` は Sidebar の開閉ボタンです。ボタンだけを消す場合は `collapseButtonShown={false}` を指定します。下部全体を自由な UI に置き換える場合は `renderSidebarFooter` を使います。

```tsx
<Sidebar.Navigator
  sidebarFooterStyle={{ padding: 8 }}
  renderSidebarFooter={({ collapsed, toggleSidebar }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={collapsed ? 'サイドバーを開く' : 'サイドバーを閉じる'}
      focusable
      onPress={toggleSidebar}
      style={{ padding: 10, borderWidth: 0 }}
    >
      <Text>{collapsed ? '開く' : '閉じる'}</Text>
    </Pressable>
  )}
>
  {/* Sidebar.Screen */}
</Sidebar.Navigator>
```

この renderer は既定の Pressable を丸ごと置き換えます。`renderSidebarFooter={() => null}` なら下部の外枠と余白も削除します。従来の `renderCollapseButtonContent` は既定ボタンの中身だけを置き換える API として引き続き使用できます。

`SidebarFooterProps` は `collapsed`、`toggleSidebar` / `collapseSidebar` / `expandSidebar`、既定ボタンの `children` を提供します。`children` を描画すれば既定ボタンを独自フッターに含めることもできます。`collapseButtonShown={false}` または `collapsible={false}` の場合、`children` は `null` です。独自フッターはこれらの指定とは独立して表示できます。完全に差し替える UI のラベル・role・キー操作はアプリ側で設定します。

### 項目や境界の中身を差し替える

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

`renderItemContent` の `children` はスタイル適用済みの標準 icon / label / badge です。全体を差し替えることもできます。外側の Pressable はライブラリが管理するため、クリック・キー選択・disabled・accessibility label と selection は引き継がれます。戻り値には表示用 Node を置き、入れ子のボタンなど独立した操作要素を置かないでください。

`renderCollapseButtonContent` も標準 `children` と `collapsed` を受け取ります。`renderDivider` は `columnId`、列の現在幅 `width`、`dragging` を受け取り、外側の resize / keyboard / accessibility 処理を保持します。Column に指定した renderer は Navigator の renderer より優先され、divider styles は Navigator → Column の順で適用します。

Header 全体は既存の `header`、左右の内容は `headerLeft` / `headerRight` でも差し替えられます。これらを完全に置き換える場合、独自の描画・操作・アクセシビリティ属性は renderer 側で実装します。Dialog の既定背景色は `theme.colors.surface` です。

設定した style や renderer は Navigation State の JSON に保存されません。実行可能な使用例は [Customization.tsx](examples/desktop/Customization.tsx) を参照してください。

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
