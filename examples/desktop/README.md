# Desktop Example

`App.tsx` は macOS / Windows のホストアプリで共有するデモです。Home / Timeline、Post、Profile、Albums、Settings、About、Dialog と Profile 内の Tabs を含みます。

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

## ホストへの組み込み

このディレクトリのデモは TypeScript ソースです。Xcode / Visual Studio のネイティブプロジェクトは含んでいません。各プラットフォームの動作済みホストアプリに組み込んで使います。

1. ライブラリのルートで `npm ci`、`npm run check`、`npm pack` を実行します。
2. macOS または Windows の RN アプリに、生成された `.tgz` を `npm install /path/to/package.tgz` でインストールします。
3. `App.tsx` をホスト側へコピーし、`../../src` からの import を `@natsuneko-laboratory/react-native-desktop-navigation` に変更します。
4. ホストの `AppRegistry.registerComponent` にこの `App` を登録し、ホストの既存の起動手順で実行します。

プラットフォームごとに RN / React の対応版を選びます。ライブラリは追加の native module や pod を要求しません。

## 手動確認

以下はまだ native 実行で確認していません。macOS / Windows の両方で記録してください。

- Sidebar の Timeline / Albums / Settings をクリックし、表示が切り替わる。
- Timeline の Draft を入力し、Open Post 123 → Open Profile と遷移する。
- Back を2回押して Post → Timeline に戻り、Draft が保持される。
- Draft のフォーカスが戻る。TextInput の編集中に OS の編集キーを奪わない。
- `inactiveBehavior="unmount"` に変更した場合、Draft は再生成される。
- Content をクリック後、macOS の Cmd+[ / Cmd+]、Windows の Alt+Left / Alt+Right が Content Stack に作用する。
- About を開いて戻ったとき、Content Stack の状態が残る。
- Sidebar にフォーカスし、↑ / ↓ / Home / End / Enter、折り畳みボタンを操作する。
- Sidebar を折り畳むと Split の列幅と Divider も `collapsedWidth` まで縮み、展開するとドラッグで調整した列幅に戻る。折り畳み中にウィンドウをリサイズしても Divider が追従する。
- Profile の Tabs で Ctrl+Tab / Ctrl+Shift+Tab を操作する。
- Split の境界を mouse drag し、sidebar の 240〜420 の制約を確認する。境界の ← / → 操作も確認する。
- ウィンドウを幅700未満にして content のみ表示し、拡大すると sidebar の状態が戻る。
- `onSave` の JSON をホストのファイル等へ保存し、再起動時に `JSON.parse` した値を `initialState` に渡す。画面と params が復元される。
- VoiceOver / Narrator でラベル、selection、disabled 状態と非表示画面が読み上げられないことを確認する。
- Dialog を開閉する。OS native modal や完全な focus trap ではなく、アプリ内 overlay として表示される。

自動テストはこれらの React / State / イベント配線を検証します。OS のイベント配送、mouse capture、accessibility bridge 自体はホストで確認する必要があります。

## カスタムデザインの Example

`Customization.tsx` を同じ手順でホストへコピーし、`App` の代わりに登録すると、ダークテーマの Header・Sidebar・Tabs・Split を確認できます。各部位のスタイル、選択 / focus / hover / press 状態、項目の描画差し替え、drag 中のリサイズハンドルを実装した例です。

`<Customization showDividers={false} />` で Split Divider を完全に非表示にできます。この Example の Sidebar 下部は `renderSidebarFooter` で既定ボタン全体を置き換えています。下部自体を削除する場合は `renderSidebarFooter={() => null}` を指定してください。

Split の境界をドラッグすると、隣接する2列の幅が同時に変化します。Sidebar のバーも列幅全体に追従させる場合は `Sidebar.Navigator` の `width` を `"fill"` に変更してください（項目一覧専用の列向け）。数値の場合はバー幅を固定し、同じ列内の画面領域が伸縮します。
