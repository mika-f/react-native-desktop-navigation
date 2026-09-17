#include "pch.h"

// Fabric's XamlIsland API requires RNW 0.82+ and UseExperimentalWinUI3.
// React scenes are siblings of this island in the Fabric composition tree.
// The island reports its content slots; it never owns/reparents React children.
namespace winrt::DesktopNavigation {
using namespace Microsoft::ReactNative;
using namespace Microsoft::ReactNative::Composition;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;
using namespace Microsoft::UI::Xaml::Controls::Primitives;
using namespace Microsoft::UI::Xaml::Media;
using namespace Windows::Data::Json;

REACT_STRUCT(HostProps)
struct HostProps : implements<HostProps, IComponentProps> {
  HostProps(ViewProps props, IComponentProps const &previous) : viewProps(props) {
    if (previous) configuration = previous.as<HostProps>()->configuration;
  }
  void SetProp(uint32_t hash, hstring name, IJSValueReader value) noexcept {
    ReadProp(hash, name, value, *this);
  }
  REACT_FIELD(configuration)
  hstring configuration;
  ViewProps viewProps;
};

REACT_STRUCT(PortalProps)
struct PortalProps : implements<PortalProps, IComponentProps> {
  PortalProps(ViewProps props, IComponentProps const &previous) : viewProps(props) {
    if (previous) {
      hostId = previous.as<PortalProps>()->hostId;
      slot = previous.as<PortalProps>()->slot;
    }
  }
  void SetProp(uint32_t hash, hstring name, IJSValueReader value) noexcept {
    ReadProp(hash, name, value, *this);
  }
  REACT_FIELD(hostId)
  hstring hostId;
  REACT_FIELD(slot)
  hstring slot;
  ViewProps viewProps;
};

// A XAML island composites above its Fabric siblings, so React content cannot be laid over it. Instead each
// piece of React content (a scene, a sidebar icon, the footer) is rendered by a DesktopNavigationPortal into
// its own React Native island, hosted inside the XAML element that reserves space for it. The content stays
// in the same React tree (Context, state) while appearing, and receiving input, inside the native control.
struct Portal : implements<Portal, IInspectable> {
  winrt::weak_ref<PortalComponentView> view;
  hstring hostId, slot;
  ReactNativeIsland reactIsland{nullptr};
  Microsoft::UI::Composition::SpriteVisual placement{nullptr};
  Microsoft::UI::Content::ChildSiteLink link{nullptr};
  FrameworkElement target{nullptr};
  event_token sizeToken{};
  float width = -1, height = -1;

  // Sizes the hosted island. The React content itself is sized from the frames native reports to JS: portal
  // state constraints are not re-applied by Fabric once the portal has been laid out.
  void Resize(float w, float h) {
    if (w == width && h == height) return;
    width = w; height = h;
    if (link && target) link.ActualSize({w, h});
    if (placement) placement.Size({w, h});
  }
  static Microsoft::UI::Composition::ContainerVisual HostVisual(FrameworkElement const &element) {
    if (auto existing = Microsoft::UI::Xaml::Hosting::ElementCompositionPreview::GetElementChildVisual(element))
      if (auto container = existing.try_as<Microsoft::UI::Composition::ContainerVisual>()) return container;
    auto compositor = Microsoft::UI::Xaml::Hosting::ElementCompositionPreview::GetElementVisual(element).Compositor();
    auto container = compositor.CreateContainerVisual();
    Microsoft::UI::Xaml::Hosting::ElementCompositionPreview::SetElementChildVisual(element, container);
    return container;
  }
  void Attach(Microsoft::UI::Content::ContentIsland const &xamlIsland, FrameworkElement const &element) {
    auto strong = view.get();
    if (!strong || element == target) return;
    Detach();
    target = element;
    if (!reactIsland) reactIsland = ReactNativeIsland::CreatePortal(strong);
    auto host = HostVisual(element);
    if (!placement) placement = host.Compositor().CreateSpriteVisual();
    host.Children().InsertAtTop(placement);
    if (!link) {
      link = Microsoft::UI::Content::ChildSiteLink::Create(xamlIsland, placement);
      link.ActualSize({static_cast<float>(element.ActualWidth()), static_cast<float>(element.ActualHeight())});
      link.Connect(reactIsland.Island());
    }
    placement.IsVisible(true);
    width = height = -1;
    Resize(static_cast<float>(element.ActualWidth()), static_cast<float>(element.ActualHeight()));
    sizeToken = element.SizeChanged([weak = get_weak()](auto const &, SizeChangedEventArgs const &args) {
      if (auto self = weak.get()) self->Resize(args.NewSize().Width, args.NewSize().Height);
    });
  }
  // Natural height of the portal's content as laid out by Fabric, or 0 before its first layout.
  float ContentHeight() const {
    auto strong = view.get();
    if (!strong) return 0;
    auto children = strong.ContentRoot().Children();
    return children.Size() ? children.GetAt(0).LayoutMetrics().Frame.Height : 0;
  }
  void Detach() {
    if (!target) return;
    target.SizeChanged(sizeToken);
    if (placement) {
      placement.IsVisible(false);
      if (auto parent = placement.Parent()) parent.Children().Remove(placement);
    }
    // An unattached portal must not keep a hit-testable area.
    if (link) link.ActualSize({0, 0});
    target = nullptr;
  }
  void Close() {
    Detach();
    if (link) { link.Close(); link = nullptr; }
    reactIsland = nullptr;
  }
};

struct Host;
static std::map<std::wstring, winrt::weak_ref<Host>> &Hosts() {
  static std::map<std::wstring, winrt::weak_ref<Host>> value;
  return value;
}
static std::map<std::wstring, std::vector<winrt::weak_ref<Portal>>> &Portals() {
  static std::map<std::wstring, std::vector<winrt::weak_ref<Portal>>> value;
  return value;
}

static void String(JsonObject const &object, wchar_t const *key, hstring const &value) {
  object.SetNamedValue(key, JsonValue::CreateStringValue(value));
}
static void Number(JsonObject const &object, wchar_t const *key, double value) {
  object.SetNamedValue(key, JsonValue::CreateNumberValue(value));
}
static SolidColorBrush Brush(hstring const &value, Windows::UI::Color fallback) {
  if (value.size() == 7 || value.size() == 9) {
    try {
      auto bits = std::stoull(std::wstring(value.c_str() + 1), nullptr, 16);
      if (value.size() == 7) bits = (bits << 8) | 255;
      return SolidColorBrush({static_cast<uint8_t>(bits & 255), static_cast<uint8_t>((bits >> 24) & 255),
        static_cast<uint8_t>((bits >> 16) & 255), static_cast<uint8_t>((bits >> 8) & 255)});
    } catch (...) {}
  }
  return SolidColorBrush(fallback);
}
// Colors omitted from the appearance fall back to the WinUI theme rather than to fixed colors.
static SolidColorBrush OptionalBrush(JsonObject const &appearance, wchar_t const *key) {
  auto value = appearance.GetNamedString(key, L"");
  return value.empty() ? nullptr : Brush(value, {255, 0, 0, 0});
}
static void SetResource(ResourceDictionary const &resources, wchar_t const *key, SolidColorBrush const &brush) {
  auto boxed = box_value(key);
  if (brush) resources.Insert(boxed, brush);
  else if (resources.HasKey(boxed)) resources.Remove(boxed);
}
static IconElement ItemIcon(JsonObject const &item) {
  if (!item.HasKey(L"icon")) return nullptr;
  auto descriptor = item.GetNamedObject(L"icon");
  auto type = descriptor.GetNamedString(L"type", L"");
  auto size = descriptor.GetNamedNumber(L"size", 16);
  IconElement icon{nullptr};
  if (type == L"react") {
    FontIcon placeholder;
    placeholder.Glyph(L" ");
    placeholder.Opacity(0);
    icon = placeholder;
  } else if (type == L"font") {
    FontIcon font;
    font.Glyph(descriptor.GetNamedString(L"glyph"));
    font.FontSize(size);
    // Without an override, WinUI uses SymbolThemeFontFamily (OS fallback).
    auto family = descriptor.GetNamedString(L"fontFamily", L"");
    if (!family.empty()) font.FontFamily(FontFamily(family));
    icon = font;
  } else if (type == L"image") {
    BitmapIcon bitmap;
    bitmap.ShowAsMonochrome(descriptor.GetNamedBoolean(L"template", false));
    try { bitmap.UriSource(Windows::Foundation::Uri(descriptor.GetNamedString(L"uri"))); }
    catch (hresult_error const &) { return nullptr; }
    icon = bitmap;
  }
  if (icon) {
    icon.Width(size); icon.Height(size);
    if (descriptor.HasKey(L"color")) icon.Foreground(Brush(descriptor.GetNamedString(L"color"), {255, 32, 33, 36}));
    Automation::AutomationProperties::SetAccessibilityView(icon, Automation::Peers::AccessibilityView::Raw);
  }
  return icon;
}
struct Host : implements<Host, IInspectable> {
  XamlIsland island{nullptr};
  Grid root{nullptr};
  EventEmitter emitter{nullptr};
  JsonObject config;
  bool updating = false;
  hstring structure;
  hstring lastLayout;
  NavigationView navigation{nullptr};
  SplitView split{nullptr};
  Button back{nullptr};
  TextBlock title{nullptr};
  Grid header{nullptr};
  Border content{nullptr};
  Border footer{nullptr};
  std::map<hstring, NavigationViewItem> menu;
  std::map<hstring, hstring> iconConfigurations;
  std::map<hstring, Border> slots;
  std::vector<ColumnDefinition> detailColumns;
  event_token layoutToken{};
  std::vector<std::pair<ScrollViewer, event_token>> scrollObservers;
  void ClearScrollObservers() {
    for (auto const &[viewer, token] : scrollObservers) viewer.ViewChanged(token);
    scrollObservers.clear();
  }
  void ObserveScroll(ScrollViewer const &viewer) {
    for (auto const &entry : scrollObservers) if (entry.first == viewer) return;
    auto token = viewer.ViewChanged([this](auto const &, auto const &) { ReportLayout(); });
    scrollObservers.emplace_back(viewer, token);
  }
  static Windows::Foundation::Rect Intersect(Windows::Foundation::Rect a, Windows::Foundation::Rect b) {
    auto x = std::max(a.X, b.X), y = std::max(a.Y, b.Y);
    return {x, y, std::max(0.0f, std::min(a.X + a.Width, b.X + b.Width) - x),
      std::max(0.0f, std::min(a.Y + a.Height, b.Y + b.Height) - y)};
  }
  Windows::Foundation::Rect Bounds(FrameworkElement const &element) {
    return element.TransformToVisual(root).TransformBounds({0, 0,
      static_cast<float>(element.ActualWidth()), static_cast<float>(element.ActualHeight())});
  }
  static JsonObject RectJSON(Windows::Foundation::Rect rect) {
    JsonObject value;
    Number(value, L"x", rect.X); Number(value, L"y", rect.Y);
    Number(value, L"width", rect.Width); Number(value, L"height", rect.Height);
    return value;
  }

  // RNW renders in physical pixels under a root visual scaled by 1/RasterizationScale, but lays out the
  // island's ChildSiteLink in DIPs without compensating, so the island is drawn shrunk on scaled displays.
  // The placement visual (this component's own visual) scales DIPs back to physical pixels.
  Microsoft::UI::Composition::ContainerVisual placement{nullptr};
  Microsoft::UI::Composition::Visual CreateVisual(Microsoft::UI::Composition::Compositor const &compositor) {
    placement = compositor.CreateSpriteVisual();
    return placement;
  }
  void Initialize(ContentIslandComponentView const &view) {
    root = Grid();
    island = XamlIsland();
    island.Content(root);
    // Connecting creates a ChildSiteLink on the React Native island this view is mounted in, which fails while
    // that island is not connected yet (a navigator nested in a portal is mounted before the portal attaches).
    view.Mounted([weak = get_weak()](auto const &, winrt::Microsoft::ReactNative::ComponentView const &sender) {
      if (auto self = weak.get()) self->ConnectWhenReady(sender.as<ContentIslandComponentView>());
    });
    layoutToken = root.LayoutUpdated([this](auto const &, auto const &) { ReportLayout(); });
    view.LayoutMetricsChanged([this](auto const &, LayoutMetricsChangedArgs const &args) { UpdateScale(args.NewLayoutMetrics()); });
  }
  Microsoft::UI::Content::ContentIsland pendingParent{nullptr};
  event_token pendingToken{};
  void ConnectWhenReady(ContentIslandComponentView const &view) {
    if (island.ContentIsland().IsConnected()) return;
    auto parent = view.Root().ReactNativeIsland().Island();
    if (parent.IsConnected()) { view.Connect(island.ContentIsland()); return; }
    if (pendingParent) return;
    pendingParent = parent;
    pendingToken = parent.Connected([weak = get_weak(), weakView = winrt::make_weak(view)](auto const &, auto const &) {
      auto self = weak.get(); auto strongView = weakView.get();
      if (!self) return;
      self->pendingParent.Connected(self->pendingToken); self->pendingParent = nullptr;
      if (strongView && !self->island.ContentIsland().IsConnected()) strongView.Connect(self->island.ContentIsland());
    });
  }
  void UpdateScale(LayoutMetrics const &metrics) {
    if (placement) placement.Scale({metrics.PointScaleFactor, metrics.PointScaleFactor, 1});
  }
  std::wstring hostId;
  static FrameworkElement FindNamed(DependencyObject const &node, std::wstring_view name) {
    auto count = VisualTreeHelper::GetChildrenCount(node);
    for (int32_t index = 0; index < count; ++index) {
      auto child = VisualTreeHelper::GetChild(node, index);
      if (auto element = child.try_as<FrameworkElement>(); element && element.Name() == name) return element;
      if (auto found = FindNamed(child, name)) return found;
    }
    return nullptr;
  }
  // Hosts each registered portal in the XAML element reserved for its slot, and hides the others.
  void SyncPortals() {
    if (hostId.empty() || !island) return;
    auto entry = Portals().find(hostId);
    if (entry == Portals().end()) return;
    auto &list = entry->second;
    list.erase(std::remove_if(list.begin(), list.end(), [](auto const &weak) { return !weak.get(); }), list.end());
    for (auto const &weak : list) {
      auto portal = weak.get();
      FrameworkElement element{nullptr};
      std::wstring slot(portal->slot);
      if (slot.rfind(L"content:", 0) == 0) {
        auto found = slots.find(hstring(slot.substr(8)));
        if (found != slots.end() && found->second.IsLoaded()) element = found->second;
      } else if (slot.rfind(L"icon:", 0) == 0) {
        auto key = hstring(slot.substr(5));
        auto item = menu.find(key);
        auto descriptor = iconConfigurations.find(key);
        if (item != menu.end() && descriptor != iconConfigurations.end() && !descriptor->second.empty() &&
            JsonObject::Parse(descriptor->second).GetNamedString(L"type", L"") == L"react" && item->second.IsLoaded()) {
          // The template's IconBox is a Viewbox that scales its child (the placeholder icon) down to the icon
          // size; hosting in the Viewbox itself keeps the React icon unscaled.
          if (auto box = FindNamed(item->second, L"IconBox"); box && box.ActualWidth() > 0) element = box;
        }
      } else if (slot == L"footer" && footer && navigation) {
        // Reserve the footer's natural height (laid out by React at the pane width) below the menu items.
        auto natural = portal->ContentHeight();
        if (natural > 0 && std::abs(footer.Height() - natural) >= 0.5) {
          footer.Height(natural);
          footer.Visibility(Visibility::Visible);
        }
        // Like the macOS sidebar, the footer is only shown while the pane is open.
        if (navigation.IsPaneOpen() && footer.IsLoaded() && footer.Visibility() == Visibility::Visible && footer.ActualWidth() > 0)
          element = footer;
      }
      if (element) portal->Attach(island.ContentIsland(), element);
      else portal->Detach();
    }
  }
  void Close() {
    if (!hostId.empty()) Hosts().erase(hostId);
    updating = true;
    ClearScrollObservers();
    root.LayoutUpdated(layoutToken);
    island.Close();
    emitter = nullptr;
  }
  void Send(JsonObject message) {
    if (updating || !emitter) return;
    Number(message, L"revision", config.GetNamedNumber(L"revision", 0));
    auto payload = message.Stringify();
    emitter.DispatchEvent(L"navigationEvent", [payload](IJSValueWriter const &writer) {
      writer.WriteObjectBegin();
      writer.WritePropertyName(L"payload");
      writer.WriteString(payload);
      writer.WriteObjectEnd();
    });
  }
  void Request(wchar_t const *type) { JsonObject event; String(event, L"type", type); Send(event); }
  void Collapsed(bool value) {
    if (value == config.GetNamedBoolean(L"collapsed", false)) return;
    JsonObject event; String(event, L"type", L"collapse");
    event.SetNamedValue(L"collapsed", JsonValue::CreateBooleanValue(value)); Send(event);
  }
  void Resize(hstring const &key, double width) {
    JsonObject event; String(event, L"type", L"resize"); String(event, L"key", key);
    Number(event, L"width", width); Send(event);
  }
  Border Slot(hstring const &key) {
    Border slot;
    slot.HorizontalAlignment(HorizontalAlignment::Stretch);
    slot.VerticalAlignment(VerticalAlignment::Stretch);
    slots.emplace(key, slot);
    return slot;
  }
  void ReportLayout() {
    if (updating || !emitter || !root || root.ActualWidth() <= 0) return;
    SyncPortals();
    JsonObject frames;
    for (auto const &[key, slot] : slots) {
      auto offset = slot.TransformToVisual(root).TransformPoint({0, 0});
      JsonObject frame;
      Number(frame, L"x", offset.X); Number(frame, L"y", offset.Y);
      Number(frame, L"width", slot.ActualWidth()); Number(frame, L"height", slot.ActualHeight());
      frames.SetNamedValue(key, frame);
    }
    JsonObject iconFrames;
    for (auto const &[key, item] : menu) {
      auto descriptor = iconConfigurations.find(key);
      if (descriptor == iconConfigurations.end() || descriptor->second.empty()) continue;
      if (JsonObject::Parse(descriptor->second).GetNamedString(L"type", L"") != L"react") continue;
      auto icon = item.Icon();
      if (!icon || !icon.IsLoaded() || icon.ActualWidth() <= 0) continue;
      auto frame = Bounds(icon);
      auto clip = Intersect(frame, Bounds(root));
      auto ancestor = VisualTreeHelper::GetParent(icon);
      while (ancestor && ancestor != root) {
        if (auto element = ancestor.try_as<FrameworkElement>()) {
          if (element.Visibility() != Visibility::Visible) { clip.Width = 0; clip.Height = 0; }
          // Includes NavigationView's menu viewport and compact-pane bounds.
          if (auto viewer = element.try_as<ScrollViewer>()) {
            ObserveScroll(viewer);
            clip = Intersect(clip, Bounds(viewer));
          }
          if (element.try_as<ScrollContentPresenter>()) clip = Intersect(clip, Bounds(element));
          if (auto geometry = element.Clip().try_as<RectangleGeometry>()) {
            clip = Intersect(clip, element.TransformToVisual(root).TransformBounds(geometry.Rect()));
          }
        }
        ancestor = VisualTreeHelper::GetParent(ancestor);
      }
      if (ancestor != root) continue;
      JsonObject geometry;
      geometry.SetNamedValue(L"frame", RectJSON(frame)); geometry.SetNamedValue(L"clip", RectJSON(clip));
      iconFrames.SetNamedValue(key, geometry);
    }
    JsonObject event; String(event, L"type", L"layout");
    Number(event, L"revision", config.GetNamedNumber(L"revision", 0));
    event.SetNamedValue(L"frames", frames);
    event.SetNamedValue(L"iconFrames", iconFrames);
    if (navigation && footer && navigation.IsPaneOpen() && footer.Visibility() == Visibility::Visible &&
        footer.IsLoaded() && footer.ActualWidth() > 0 && footer.ActualHeight() > 0) {
      event.SetNamedValue(L"footerFrame", RectJSON(Intersect(Bounds(footer), Bounds(root))));
    }
    auto serialized = event.Stringify();
    if (serialized == lastLayout) return;
    lastLayout = serialized;
    Send(event);
  }
  void BuildStack() {
    RowDefinition heading; heading.Height({1, GridUnitType::Auto});
    RowDefinition body; body.Height({1, GridUnitType::Star});
    root.RowDefinitions().Append(heading); root.RowDefinitions().Append(body);
    header = Grid(); header.MinHeight(44); header.Padding({10, 6, 10, 6});
    back = Button(); back.HorizontalAlignment(HorizontalAlignment::Left);
    back.Click([this](auto const &, auto const &) { Request(L"back"); });
    title = TextBlock(); title.HorizontalAlignment(HorizontalAlignment::Center);
    title.VerticalAlignment(VerticalAlignment::Center);
    header.Children().Append(back); header.Children().Append(title);
    root.Children().Append(header);
    content = Slot(config.GetNamedString(L"activeKey")); Grid::SetRow(content, 1);
    root.Children().Append(content);
  }
  void BuildSidebar(JsonArray const &items) {
    navigation = NavigationView();
    navigation.IsSettingsVisible(false);
    navigation.IsBackButtonVisible(NavigationViewBackButtonVisible::Collapsed);
    navigation.AlwaysShowHeader(false);
    navigation.PaneDisplayMode(NavigationViewPaneDisplayMode::Left);
    hstring section;
    for (auto const &entry : items) {
      auto item = entry.GetObject();
      if (item.GetNamedBoolean(L"hidden", false)) continue;
      auto heading = item.GetNamedString(L"section", L"");
      if (!heading.empty() && heading != section) {
        NavigationViewItemHeader group; group.Content(box_value(heading));
        navigation.MenuItems().Append(group);
      }
      section = heading;
      NavigationViewItem control; auto key = item.GetNamedString(L"key");
      control.Tag(box_value(key)); navigation.MenuItems().Append(control); menu.emplace(key, control);
    }
    navigation.SelectionChanged([this](auto const &, NavigationViewSelectionChangedEventArgs const &args) {
      auto item = args.SelectedItem().try_as<NavigationViewItem>();
      if (!item) return;
      JsonObject event; String(event, L"type", L"select");
      String(event, L"key", unbox_value<hstring>(item.Tag())); Send(event);
    });
    navigation.PaneOpened([this](auto const &, auto const &) { Collapsed(false); });
    navigation.PaneClosed([this](auto const &, auto const &) { Collapsed(true); });
    // An empty, measured placeholder; the React footer is composited over it.
    footer = Border(); footer.HorizontalAlignment(HorizontalAlignment::Stretch);
    Automation::AutomationProperties::SetAccessibilityView(footer, Automation::Peers::AccessibilityView::Raw);
    navigation.PaneFooter(footer);
    content = Slot(config.GetNamedString(L"activeKey"));
    navigation.Content(content); root.Children().Append(navigation);
  }
  Thumb Divider(hstring const &key, std::function<void(double)> resize) {
    Thumb thumb; thumb.Width(6); thumb.HorizontalAlignment(HorizontalAlignment::Right);
    thumb.Background(SolidColorBrush({255, 128, 128, 128}));
    thumb.IsTabStop(true);
    thumb.KeyDown([resize](auto const &, auto const &event) {
      if (event.Key() == Windows::System::VirtualKey::Left || event.Key() == Windows::System::VirtualKey::Right) {
        resize(event.Key() == Windows::System::VirtualKey::Right ? 10 : -10);
        event.Handled(true);
      }
    });
    Automation::AutomationProperties::SetName(thumb, L"Resize " + key);
    thumb.DragDelta([resize](auto const &, DragDeltaEventArgs const &event) { resize(event.HorizontalChange()); });
    return thumb;
  }
  double Clamp(JsonObject const &column, double width) {
    return std::clamp(width, column.GetNamedNumber(L"minWidth", 100), column.GetNamedNumber(L"maxWidth", 100000));
  }
  void BuildSplit(JsonArray const &columns) {
    if (columns.Size() == 1) { root.Children().Append(Slot(columns.GetObjectAt(0).GetNamedString(L"key"))); return; }
    split = SplitView(); split.DisplayMode(SplitViewDisplayMode::Inline); split.IsPaneOpen(true);
    auto first = columns.GetObjectAt(0); auto firstKey = first.GetNamedString(L"key");
    Grid pane;
    auto firstSlot = Slot(firstKey); firstSlot.Margin({0, 0, 6, 0}); pane.Children().Append(firstSlot);
    pane.Children().Append(Divider(firstKey, [this, firstKey](double delta) {
      auto col = config.GetNamedArray(L"columns").GetObjectAt(0);
      auto width = Clamp(col, split.OpenPaneLength() - 6 + delta);
      split.OpenPaneLength(width + 6); Resize(firstKey, width);
    }));
    split.Pane(pane);
    Grid detail;
    for (uint32_t index = 1; index < columns.Size(); ++index) {
      auto column = columns.GetObjectAt(index); auto key = column.GetNamedString(L"key");
      ColumnDefinition definition;
      definition.Width(index + 1 == columns.Size() ? GridLength{1, GridUnitType::Star} : GridLength{column.GetNamedNumber(L"width"), GridUnitType::Pixel});
      definition.MinWidth(column.GetNamedNumber(L"minWidth", 100));
      definition.MaxWidth(column.GetNamedNumber(L"maxWidth", 100000));
      detail.ColumnDefinitions().Append(definition); detailColumns.push_back(definition);
      Grid panel; Grid::SetColumn(panel, index - 1);
      auto slot = Slot(key); panel.Children().Append(slot);
      if (index + 1 < columns.Size()) {
        slot.Margin({0, 0, 6, 0});
        panel.Children().Append(Divider(key, [this, key, index, definition](double delta) {
          auto col = config.GetNamedArray(L"columns").GetObjectAt(index);
          auto width = Clamp(col, definition.ActualWidth() - 6 + delta);
          definition.Width({width + 6, GridUnitType::Pixel}); Resize(key, width);
        }));
      }
      detail.Children().Append(panel);
    }
    split.Content(detail); root.Children().Append(split);
  }
  void Apply(hstring const &json) {
    JsonObject next;
    if (!JsonObject::TryParse(json, next)) return;
    updating = true;
    config = next;
    auto mode = config.GetNamedString(L"mode");
    auto items = config.GetNamedArray(L"items", JsonArray());
    auto columns = config.GetNamedArray(L"columns", JsonArray());
    // Only structural changes recreate controls. Selection/ack updates retain focus.
    JsonObject signature; String(signature, L"mode", mode);
    if (mode == L"sidebar") {
      JsonArray structureItems;
      for (auto const &entry : items) {
        auto item = entry.GetObject(); JsonObject identity;
        String(identity, L"key", item.GetNamedString(L"key"));
        String(identity, L"section", item.GetNamedString(L"section", L""));
        identity.SetNamedValue(L"hidden", JsonValue::CreateBooleanValue(item.GetNamedBoolean(L"hidden", false)));
        structureItems.Append(identity);
      }
      signature.SetNamedValue(L"items", structureItems);
    }
    JsonArray keys;
    for (auto const &column : columns) keys.Append(JsonValue::CreateStringValue(column.GetObject().GetNamedString(L"key")));
    signature.SetNamedValue(L"columns", keys);
    auto nextStructure = signature.Stringify();
    if (structure != nextStructure) {
      ClearScrollObservers();
      root.Children().Clear(); root.RowDefinitions().Clear(); root.ColumnDefinitions().Clear();
      slots.clear(); menu.clear(); iconConfigurations.clear(); detailColumns.clear();
      navigation = nullptr; split = nullptr; content = nullptr; footer = nullptr;
      structure = nextStructure;
      if (mode == L"sidebar") BuildSidebar(items);
      else if (mode == L"split") BuildSplit(columns);
      else BuildStack();
    }
    auto appearance = config.GetNamedObject(L"appearance", JsonObject());
    // Follow the React Native color scheme so that WinUI's own colors match the app.
    auto scheme = config.GetNamedString(L"colorScheme", L"");
    root.RequestedTheme(scheme == L"dark" ? ElementTheme::Dark : scheme == L"light" ? ElementTheme::Light : ElementTheme::Default);
    root.Background(OptionalBrush(appearance, L"backgroundColor"));
    auto foreground = OptionalBrush(appearance, L"foregroundColor");
    auto accent = OptionalBrush(appearance, L"accentColor");
    auto active = config.GetNamedString(L"activeKey");
    if (content) { slots.clear(); slots.emplace(active, content); }
    if (mode == L"stack") {
      header.Visibility(config.GetNamedBoolean(L"headerShown", true) ? Visibility::Visible : Visibility::Collapsed);
      back.Visibility(config.GetNamedBoolean(L"canGoBack", false) ? Visibility::Visible : Visibility::Collapsed);
      back.Content(box_value(config.GetNamedString(L"backTitle", L"Back")));
      if (accent) back.Foreground(accent); else back.ClearValue(Control::ForegroundProperty());
      if (foreground) title.Foreground(foreground); else title.ClearValue(TextBlock::ForegroundProperty());
      for (auto const &entry : items) { auto item = entry.GetObject(); if (item.GetNamedString(L"key") == active) title.Text(item.GetNamedString(L"title")); }
    }
    if (navigation) {
      navigation.OpenPaneLength(config.GetNamedNumber(L"paneWidth", 240));
      navigation.IsPaneOpen(!config.GetNamedBoolean(L"collapsed", false));
      auto footerHeight = config.GetNamedNumber(L"footerHeight", 0);
      footer.Height(footerHeight > 0 ? footerHeight : 0);
      footer.Visibility(footerHeight > 0 ? Visibility::Visible : Visibility::Collapsed);
      if (foreground) navigation.Foreground(foreground); else navigation.ClearValue(Control::ForegroundProperty());
      auto pane = OptionalBrush(appearance, L"sidebarBackgroundColor");
      SetResource(navigation.Resources(), L"NavigationViewExpandedPaneBackground", pane);
      SetResource(navigation.Resources(), L"NavigationViewDefaultPaneBackground", pane);
      SetResource(navigation.Resources(), L"NavigationViewSelectionIndicatorForeground", accent);
      for (auto const &entry : items) {
        auto item = entry.GetObject(); auto it = menu.find(item.GetNamedString(L"key"));
        if (it == menu.end()) continue;
        it->second.Content(box_value(item.GetNamedString(L"title")));
        it->second.IsEnabled(!item.GetNamedBoolean(L"disabled", false));
        auto badge = item.GetNamedString(L"badge", L"");
        if (badge.empty()) it->second.InfoBadge(nullptr);
        else {
          // InfoBadge only displays integers; other strings render as a dot.
          InfoBadge info; wchar_t *end = nullptr;
          auto value = std::wcstol(badge.c_str(), &end, 10);
          if (end && *end == L'\0' && value > 0) info.Value(static_cast<int32_t>(value));
          it->second.InfoBadge(info);
        }
        auto iconJSON = item.HasKey(L"icon") ? item.GetNamedObject(L"icon").Stringify() : hstring{};
        auto oldIcon = iconConfigurations.find(it->first);
        if (oldIcon == iconConfigurations.end() || oldIcon->second != iconJSON) {
          it->second.Icon(ItemIcon(item));
          iconConfigurations[it->first] = iconJSON;
        }
      }
      auto selected = menu.find(active);
      navigation.SelectedItem(selected == menu.end() ? nullptr : selected->second);
    }
    if (split) {
      split.OpenPaneLength(columns.GetObjectAt(0).GetNamedNumber(L"width") + 6);
      for (size_t i = 0; i + 1 < detailColumns.size(); ++i)
        detailColumns[i].Width({columns.GetObjectAt(static_cast<uint32_t>(i + 1)).GetNamedNumber(L"width") + 6, GridUnitType::Pixel});
    }
    auto nextHostId = std::wstring(config.GetNamedString(L"hostId", L""));
    if (nextHostId != hostId) {
      if (!hostId.empty()) Hosts().erase(hostId);
      hostId = nextHostId;
      if (!hostId.empty()) Hosts()[hostId] = get_weak();
    }
    updating = false;
    SyncPortals();
    // LayoutUpdated will deliver the new geometry after XAML has arranged.
    lastLayout = L"";
    root.InvalidateArrange();
  }
};
static void RegisterPortal(Portal &portal, hstring const &hostId, hstring const &slot) {
  if (portal.hostId == hostId && portal.slot == slot) return;
  if (!portal.hostId.empty()) {
    auto &list = Portals()[std::wstring(portal.hostId)];
    list.erase(std::remove_if(list.begin(), list.end(), [&](auto const &weak) {
      auto other = weak.get();
      return !other || other.get() == &portal;
    }), list.end());
    portal.Detach();
  }
  portal.hostId = hostId;
  portal.slot = slot;
  if (hostId.empty()) return;
  Portals()[std::wstring(hostId)].push_back(portal.get_weak());
  auto found = Hosts().find(std::wstring(hostId));
  if (found != Hosts().end())
    if (auto host = found->second.get()) host->SyncPortals();
}
}

void RegisterDesktopNavigation(winrt::Microsoft::ReactNative::IReactPackageBuilder const &packageBuilder) {
  using namespace winrt;
  using namespace Microsoft::ReactNative;
  using namespace Microsoft::ReactNative::Composition;
  using namespace DesktopNavigation;
  packageBuilder.as<IReactPackageBuilderFabric>().AddViewComponent(L"DesktopNavigationPortal", [](IReactViewComponentBuilder const &builder) {
    builder.SetCreateProps([](ViewProps props, IComponentProps const &previous) { return make<PortalProps>(props, previous); });
    builder.as<IReactCompositionViewComponentBuilder>().SetPortalComponentViewInitializer([](PortalComponentView const &view) {
      auto portal = make_self<Portal>();
      portal->view = view;
      view.UserData(*portal);
      view.Destroying([](IInspectable const &sender, IInspectable const &) {
        auto portal = sender.as<PortalComponentView>().UserData().as<Portal>();
        RegisterPortal(*portal, L"", L"");
        portal->Close();
      });
    });
    builder.SetUpdatePropsHandler([](winrt::Microsoft::ReactNative::ComponentView const &view, IComponentProps const &props, IComponentProps const &) {
      auto next = props.as<PortalProps>();
      RegisterPortal(*view.UserData().as<Portal>(), next->hostId, next->slot);
    });
  });
  packageBuilder.as<IReactPackageBuilderFabric>().AddViewComponent(L"DesktopNavigationHost", [](IReactViewComponentBuilder const &builder) {
    // Host::Initialize creates XamlIsland/WinUI controls. RNW only creates its XamlApplication (which calls
    // WindowsXamlManager::InitializeForCurrentThread) when a registered component opts in; without it the
    // first XAML object throws RPC_E_WRONG_THREAD and the app fail-fasts on mount.
    builder.XamlSupport(true);
    builder.SetCreateProps([](ViewProps props, IComponentProps const &previous) { return make<HostProps>(props, previous); });
    auto compositionBuilder = builder.as<IReactCompositionViewComponentBuilder>();
    compositionBuilder.SetCreateVisualHandler([](winrt::Microsoft::ReactNative::ComponentView const &view) {
      if (!view.UserData()) view.UserData(make<Host>());
      return view.UserData().as<Host>()->CreateVisual(view.as<winrt::Microsoft::ReactNative::Composition::ComponentView>().Compositor());
    });
    compositionBuilder.SetContentIslandComponentViewInitializer([](ContentIslandComponentView const &view) {
      if (!view.UserData()) view.UserData(make<Host>());
      view.UserData().as<Host>()->Initialize(view);
      view.Destroying([](IInspectable const &sender, IInspectable const &) { sender.as<ContentIslandComponentView>().UserData().as<Host>()->Close(); });
    });
    builder.SetUpdatePropsHandler([](winrt::Microsoft::ReactNative::ComponentView const &view, IComponentProps const &props, IComponentProps const &) {
      view.UserData().as<Host>()->Apply(props.as<HostProps>()->configuration);
    });
    builder.SetUpdateEventEmitterHandler([](winrt::Microsoft::ReactNative::ComponentView const &view, EventEmitter const &emitter) {
      auto host = view.UserData().as<Host>(); host->emitter = emitter; host->lastLayout = L"";
    });
  });
}
