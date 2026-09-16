# Native desktop navigation (Fabric / experimental)

`@natsuneko-laboratory/react-native-desktop-navigation/native` は、既存の Router / Store / Context を使い、ナビゲーションの表示を SwiftUI / WinUI に接続するエントリーポイントです。既存の `/` は引き続き React Native の View ベースの Navigator を提供します。

| Navigator                | macOS                                            | Windows                                                   |
| ------------------------ | ------------------------------------------------ | --------------------------------------------------------- |
| `createStackNavigator`   | SwiftUI `NavigationStack` とネイティブのヘッダー | WinUI のヘッダーとコンテンツ領域。履歴は共通 Store が管理 |
| `createSidebarNavigator` | `NavigationSplitView` と `List`                  | `NavigationView`                                          |
| `createSplitNavigator`   | 2〜3 列の `NavigationSplitView`                  | `SplitView` と、3 列時の追加 Grid / Thumb                 |

画面の React ツリーは元の Fabric ツリー内に保持します。ネイティブから通知されたコンテンツ領域に React の Scene を配置するため、Context、画面の local state、ネストした Navigator、既存の Hooks を共用できます。React の画面を別の root に再マウントしたり、ネイティブ階層へ reparent したりしません。

## 対象と導入

- **Fabric 専用**です。Paper ではエラーにします。
- macOS: macOS **14 以降**、React Native macOS **0.81 系以降を実装対象**としています。
- Windows: React Native Windows **0.82 以降**の Fabric / XAML Island API を使用します。`UseExperimentalWinUI3` が必要です。0.81 の Windows は対象外です。
- Metro の Babel preset はホストの RN に対応した `@react-native/babel-preset` を使用してください。NativeComponent spec から静的 ViewConfig を生成します。

パッケージには Podspec、Fabric Codegen spec、Windows の C++ プロジェクト、autolinking 設定を同梱します。インストール後はネイティブアプリの再ビルドが必要です。未リンクの場合に JS 版へ自動で切り替えることはありません。

### macOS

ホストアプリの Fabric を有効にし、deployment target を 14.0 以上に設定します。ホストの macOS ディレクトリで `bundle exec pod install`（Bundler を使わないホストでは `pod install`）を実行してから Xcode で再ビルドしてください。`DesktopNavigation` Pod と、Codegen の `DesktopNavigationHost` component provider が組み込まれます。

### Windows

ホストの `windows/ExperimentalFeatures.props` の `PropertyGroup` に次を設定し、RNW の autolinking とビルドを実行します。既存の他の設定は維持してください。

```xml
<UseNewArchitecture>true</UseNewArchitecture>
<UseExperimentalWinUI3>true</UseExperimentalWinUI3>
```

```sh
npx react-native autolink-windows
npx react-native run-windows
```

ライブラリプロジェクトは VS 2022 の v143 ツールセットを指定しています。ホスト側にも対応する Desktop C++ / Windows SDK / RNW のビルド環境が必要です。autolinking が利用できないホストでは `windows/DesktopNavigation/DesktopNavigation.vcxproj` を参照し、`winrt::DesktopNavigation::ReactPackageProvider()` をホストの PackageProviders に追加します。

### JS 版だけを使うホスト

JS 版の API 自体にはネイティブホストは不要です。ネイティブプロジェクトの取り込みも不要なら、ホストの `react-native.config.js` の `dependencies` に以下を追加し、対象プラットフォームの autolinking を無効化できます。

```js
'@natsuneko-laboratory/react-native-desktop-navigation': {
  platforms: { ios: null, macos: null, windows: null },
},
```

## 使用例

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

`NavigationContainer`、Ref、Hooks、`StackNavigation` / `SidebarNavigation`、保存・復元関数は JS 版と同じ実装です。同じ Container 内で JS 版の Tabs やカスタム Sidebar と組み合わせられます。`/native` は Tabs をエクスポートしません。Tabs は `/` から import してください。

## スタイルと API

各 Native Navigator の `appearance` は以下の色を受け取ります。未指定の値は Container の `theme` の `background` / `text` / `accent` / `surface` を使用します。ネイティブ境界の色は `#RRGGBB` または `#RRGGBBAA` を使ってください。

- `backgroundColor`: コンテンツ背景
- `foregroundColor`: ヘッダーや項目の文字色
- `accentColor`: macOS の tint、Windows の戻るボタン・選択インジケーター
- `sidebarBackgroundColor`: Sidebar の背景

全体には `style`、Screen には `sceneStyle` / `contentStyle` を指定できます。OS が描く部品へ任意の `ViewStyle` を直接適用する API ではありません。

### Stack

`initialRouteName`、`historyBehavior`、`screenOptions`、Screen `options`、型付き params は JS 版と同じです。`title`、`headerShown`、`headerBackTitle` はネイティブヘッダーに反映します。

`header`、`headerStyle`、`headerTitleStyle`、`headerTintColor`、`headerLeft` / `headerRight` などのカスタムヘッダー指定がある画面では、既存の React Native `StackHeader` に切り替えます。ナビゲーションコンテナはネイティブのままです。

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

現段階では card 表示のみで、`presentation` / `animation` / overlay / dialog の options は提供しません。ネイティブのコンテナと React の Scene を別々にアニメーションさせないよう、SwiftUI の遷移アニメーションも無効化しています。これらが必要な階層には JS 版 Stack を利用できます。

### Sidebar

`Navigator` は `initialRouteName`、`defaultCollapsed`、`width`（100 以上の数値）、`appearance`、`style`、`screenOptions` を受け取ります。`Screen` は `label` / `title`、`icon`、`iconSize`、`hidden`、`disabled` と共通 Scene options に対応します。`Section title="…"` で見出しを指定できます。

選択・開閉は既存の `select` / `navigate` / `collapseSidebar` / `expandSidebar` / `toggleSidebar` と同期します。macOS の幅は SwiftUI に渡す推奨幅です。

`icon` は React 要素（Lucide / `react-native-svg` の JSX など）、ネイティブのシステムアイコン、または画像を指定できます。macOS は SF Symbols、Windows は `FontIcon` / `BitmapIcon` をネイティブ項目内に描画します。

```tsx
<Sidebar.Screen
  name="Home"
  component={Home}
  options={{
    icon: ({ focused, disabled }) => ({
      type: 'system',
      macos: focused ? 'house.fill' : 'house',
      windows: { glyph: '\uE80F' },
      size: 16,
      color: disabled ? '#888888' : '#c4a0ff',
    }),
  }}
/>
```

`icon` は React 要素、`NativeSidebarIcon` オブジェクト、`null`、または `{ focused, disabled }` を受け取る関数です。`focused` は JS 版と同様に項目の**選択状態**を表します。`null` を返すとアイコンを消せます。`screenOptions.icon` で既定値を設定し、Screen ごとに上書きすることもできます。

- `type: 'system'`: `macos` に SF Symbols 名、`windows.glyph` に Unicode **文字列**を渡します。Windows の `fontFamily` を省略すると WinUI の OS 標準アイコンフォントを使います。独自フォントを使う場合は `windows: { glyph: '\uE80F', fontFamily: 'My Icon Font' }` のように指定し、ホストアプリ側でそのフォントを導入してください。OS 側の値を省略した場合、その OS では文字のみになります。
- `size`: 既定値は 16。論理ポイント / DIP 単位です。標準の項目レイアウトに収まるサイズを指定してください。
- `color`: `#RRGGBB` / `#RRGGBBAA`。省略するとネイティブ項目のスタイルに従います。

独自の画像も利用できます。

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

`source` は Metro の `require()` または `{ uri: '…' }` です。PNG など両 OS で読めるラスター画像を使用してください。`template: true` は画像のアルファを使う単色アイコン、既定の `false` は元の色を維持する画像です。`color` はシステムアイコンと template 画像に適用します。

画像 URI は HTTP(S) / `file://` に対応し、Windows では `ms-appx:///` / `ms-appdata:///` も指定できます。ホストアプリがそのファイルや URI にアクセスできる必要があります。読み込み失敗時も項目のタイトルと選択操作は残ります。この画像 descriptor は SVG、data URI、認証ヘッダー付き source に対応しません。SVG は以下の React 要素として渡してください。アイコン画像自体は装飾として扱い、アクセシビリティのラベルは項目のタイトルを使います。

#### Lucide / React 要素のアイコン

アプリ側に `lucide-react-native` と、その依存である `react-native-svg` を導入・ネイティブリンクして使います（[Lucide 公式ガイド](https://lucide.dev/guide/react-native/getting-started)）。本ライブラリの実行時依存には含めません。

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

`icon: <House size={20} color="#c4a0ff" />` のように直接渡すこともできます。`iconSize` は React アイコン用にネイティブ項目内へ確保する正方形の領域で、既定値は 24 ポイント / DIP。`screenOptions.iconSize` でも指定できます。要素は中央に配置し、領域からはみ出す部分は切り抜きます。アイコン自身の `size` や `color` は JSX で指定してください。ネイティブの選択色・無効色は JSX に自動適用しません。descriptor のサイズは従来どおり `icon.size` です。

React アイコンは元の Fabric ツリー内で描画し、React Context を保持します。ネイティブ側へ送るのは空のアイコン領域のサイズだけで、React 要素や SVG を JSON 化・ラスター画像化しません。ネイティブ側で測定した位置とクリップ領域に追従し、スクロール中は SVG のサイズを維持して切り抜きます。クリックやスクロールはネイティブ項目へ通し、アイコンはアクセシビリティ上は装飾として扱います。macOS の折り畳み中は非表示、Windows はコンパクトペインの表示範囲に従います。

macOS 0.81 / Fabric では、`react-native-svg` 15.15.5 で SVG アイコンの表示を確認済みです。15.15.5 以降を使用してください。既存ホストにも本ライブラリのネイティブコードの再ビルドが必要です。

使用例は [`examples/desktop/NativeLucide.tsx`](examples/desktop/NativeLucide.tsx) にあります。

`renderItemContent`、React badge、項目ごとの RN style、独自 footer はこの Native Sidebar では提供しません。これらが必要な場合は JS 版 Sidebar を Native Split 内で使用してください。

### Split

JS 版と同様に、2〜3 個の `Split.Column` を宣言します。Column は `id`、`component`、`defaultWidth`、`minWidth`、`maxWidth`、`style` / `contentStyle` を受け取ります。`layout(size)` で表示する列を指定でき、非表示の列も React ツリーと Navigation State を保持します。

`onColumnResize` はネイティブで測定したコンテンツ幅が変わった列について呼ばれます。ドラッグのほか、ウィンドウのサイズ変更でも通知されます。幅は Store に保存され、復元時はネイティブの推奨幅になります。SwiftUI が決める余白や Divider 幅のため、JS 版と完全に同じピクセル幅にはなりません。

ネイティブ Divider の任意描画・非表示、子 Sidebar の collapse と列幅を結びつける JS 版の `collapsible` は提供しません。開閉するナビゲーションペインだけが必要なら Native Sidebar を使ってください。Windows の Divider は Thumb によるドラッグと、フォーカス時の左右矢印キーに対応します。

## 状態同期

ネイティブの戻る・選択・開閉は、共通 Store への action の要求として扱います。ネイティブの履歴で JS の状態を直接上書きしません。`beforeRemove` が戻る操作を抑止した場合も、現在の状態をネイティブへ再通知します。設定の revision と一致しない遅延イベントは破棄します。

ネイティブのレイアウト通知後にフォーカス復元を行います。`inactiveBehavior`、保存・復元、`historyBehavior="desktop"` の Back / Forward は共通実装を使います。

## 検証範囲

```sh
npm run check
npm run check:native-macos
```

`check` は TypeScript、Router / Store / React UI テスト、ビルド、Fabric Codegen を実行します。Native UI テストでは `beforeRemove`、古いイベントの破棄、画面保持、履歴復元、Sidebar の選択・アイコン切り替えと画像 source の解決、Split の測定値、JS Navigator とのネストを確認します。

`check:native-macos` は macOS / Xcode が必要です。SwiftUI 実装をコンパイルし、AppKit ウィンドウ内で Stack / Sidebar（SF Symbols・ローカル画像のアイコンを含む）/ 3 列 Split のレイアウト通知を検査します。ウィンドウは画面には表示しません。

このリポジトリには RN のネイティブホストアプリを同梱していません。macOS 0.81 / Fabric と `react-native-svg` 15.15.5 での SVG アイコン表示は利用者のホストアプリで確認済みです。**Windows の C++ ビルド・実機動作は未検証**です。現段階では experimental な実装として、ホストアプリで次を確認してください。

- Native component の登録、ネストしたコンテナの配置、ウィンドウのリサイズ。
- ネイティブの項目選択、戻る、ペイン開閉と JS 側の state / focus の一致。
- VoiceOver / Narrator、キーボード操作、Windows の XAML Island と React Scene の重なり・入力配送。

実装時に参照した公式資料: [RN macOS native development](https://microsoft.github.io/react-native-macos/docs/guides/native-development)、[RNW XAML Island component sample](https://github.com/microsoft/react-native-windows/blob/0.82-stable/packages/sample-custom-component/windows/SampleCustomComponent/CalendarView.cpp)、[NavigationView](https://learn.microsoft.com/en-us/windows/apps/design/controls/navigationview)。
