import AppKit
import SwiftUI

private struct Item: Decodable, Identifiable {
  var key: String
  var title: String
  var disabled: Bool?
  var hidden: Bool?
  var section: String?
  var icon: SidebarIcon?
  var badge: String?
  var id: String { key }
}
// Resolved descriptors are shared with the Fabric JSON configuration.
private struct SidebarIcon: Decodable {
  var type: String
  var name: String?
  var uri: String?
  var template: Bool?
  var size: Double
  var color: String?
}
private struct SidebarIconView: View {
  let icon: SidebarIcon
  @State private var loaded: NSImage?
  @State private var loadedURI: String?
  @ViewBuilder var image: some View {
    if icon.type == "symbol", let name = icon.name {
      Image(systemName: name).resizable().scaledToFit()
    } else if let loaded, loadedURI == icon.uri {
      Image(nsImage: loaded).resizable()
        .renderingMode(icon.template == true ? .template : .original).scaledToFit()
    } else { Color.clear }
  }
  var body: some View {
    Group {
      if let tint = icon.color { image.foregroundStyle(color(tint, fallback: .primary)) }
      else { image }
    }
    .frame(width: icon.size, height: icon.size)
    .accessibilityHidden(true)
    .task(id: icon.uri) {
      loaded = nil
      loadedURI = nil
      guard icon.type == "image", let uri = icon.uri, let url = URL(string: uri) else { return }
      do {
        let data: Data
        if url.isFileURL {
          // File I/O does not block SwiftUI's main thread.
          data = try await Task.detached { try Data(contentsOf: url) }.value
        } else {
          let (responseData, response) = try await URLSession.shared.data(from: url)
          guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else { return }
          data = responseData
        }
        guard !Task.isCancelled else { return }
        loaded = NSImage(data: data)
        loadedURI = uri
      } catch { /* Keep the title usable when the image is unavailable. */ }
    }
  }
}
private struct Column: Decodable {
  var key: String
  var width: Double
  var minWidth: Double
  var maxWidth: Double?
}
private struct Appearance: Decodable {
  var backgroundColor: String?
  var foregroundColor: String?
  var accentColor: String?
  var sidebarBackgroundColor: String?
}
private struct Configuration: Decodable {
  var mode = "stack"
  var items: [Item] = []
  var activeKey = ""
  var revision = 0
  var appearance: Appearance?
  var headerShown: Bool?
  var canGoBack: Bool?
  var backTitle: String?
  var collapsed: Bool?
  var paneWidth: Double?
  var footerHeight: Double?
  var columns: [Column]?
  var hostId: String?
}
// Not a valid route key: route keys never start with a NUL character.
private let footerSlotKey = "\u{0}footer"

private func color(_ value: String?, fallback: Color) -> Color {
  guard let value, value.first == "#",
        let hex = UInt64(value.dropFirst(), radix: 16),
        value.count == 7 || value.count == 9 else { return fallback }
  let rgba = value.count == 7 ? (hex << 8) | 255 : hex
  return Color(.sRGB, red: Double((rgba >> 24) & 255) / 255,
    green: Double((rgba >> 16) & 255) / 255,
    blue: Double((rgba >> 8) & 255) / 255, opacity: Double(rgba & 255) / 255)
}
private extension View {
  /// Omitted appearance colors keep the adaptive system style instead of a fixed color.
  @ViewBuilder func foregroundStyle(hex value: String?) -> some View {
    if let value { foregroundStyle(color(value, fallback: .primary)) } else { self }
  }
}
private final class NavigationModel: ObservableObject {
  @Published var configuration = Configuration()
  var emit: ((String) -> Void)?
  var frames: [String: CGRect] = [:]
  var viewport = CGRect.zero
  func send(_ value: [String: Any]) {
    var message = value
    message["revision"] = configuration.revision
    guard let data = try? JSONSerialization.data(withJSONObject: message),
          let payload = String(data: data, encoding: .utf8) else { return }
    emit?(payload)
  }
  // Weak anchors avoid retaining a removed SwiftUI row or its hosting subtree.
  let iconAnchors = NSMapTable<NSString, IconAnchorView>(keyOptions: .strongMemory, valueOptions: .weakMemory)
  private var lastLayout = ""
  func iconContent(_ key: String) -> NSView? {
    guard let hostId = configuration.hostId else { return nil }
    return portalContents[portalKey(hostId, "icon:\(key)")]?.view
  }
  func attachIcons() {
    for case let anchor as IconAnchorView in iconAnchors.objectEnumerator()?.allObjects ?? [] { anchor.attachContent() }
  }
  func report(_ values: [String: CGRect]) {
    frames = values
    func rect(_ value: CGRect) -> [String: CGFloat] {
      let frame = value.isNull ? CGRect.zero : value
      return ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]
    }
    var slots = values
    let footer = slots.removeValue(forKey: footerSlotKey)
    var message: [String: Any] = ["type": "layout", "revision": configuration.revision,
      "frames": slots.mapValues { rect($0.intersection(viewport)) }]
    if configuration.mode == "sidebar", configuration.collapsed != true,
       (configuration.footerHeight ?? 0) > 0, let footer {
      let visible = footer.intersection(viewport)
      if !visible.isNull, visible.width > 0, visible.height > 0 { message["footerFrame"] = rect(visible) }
    }
    guard let data = try? JSONSerialization.data(withJSONObject: message, options: .sortedKeys),
          let payload = String(data: data, encoding: .utf8), payload != lastLayout else { return }
    lastLayout = payload
    emit?(payload)
  }
}
private final class WeakView {
  weak var view: NSView?
  init(_ view: NSView) { self.view = view }
}
// React icon contents registered by DesktopNavigationPortal views, keyed by host
// id and slot. Main thread only.
private var portalContents: [String: WeakView] = [:]
private let navigationHosts = NSHashTable<DDNNavigationView>.weakObjects()
private func portalKey(_ hostId: String, _ slot: String) -> String { "\(hostId)\u{0}\(slot)" }

// React icons are reparented into their row's AppKit view, so they scroll and
// clip with the List synchronously instead of following a JS layout round trip.
private final class IconAnchorView: NSView {
  weak var model: NavigationModel?
  var key = ""
  override var isFlipped: Bool { true }
  override func hitTest(_ point: NSPoint) -> NSView? { nil }
  func attachContent() {
    guard let content = model?.iconContent(key) else { return }
    if content.superview !== self { addSubview(content) }
    content.frame = bounds
    content.autoresizingMask = [.width, .height]
  }
  override func layout() { super.layout(); attachContent() }
}
private struct ReactIconAnchor: NSViewRepresentable {
  let key: String
  let model: NavigationModel
  func makeNSView(context: Context) -> IconAnchorView { IconAnchorView() }
  func updateNSView(_ view: IconAnchorView, context: Context) {
    view.key = key
    view.model = model
    model.iconAnchors.setObject(view, forKey: key as NSString)
    view.attachContent()
  }
  static func dismantleNSView(_ view: IconAnchorView, coordinator: ()) {
    if view.model?.iconAnchors.object(forKey: view.key as NSString) === view {
      view.model?.iconAnchors.removeObject(forKey: view.key as NSString)
    }
    view.subviews.forEach { $0.removeFromSuperview() }
  }
}
private struct FramePreference: PreferenceKey {
  static var defaultValue: [String: CGRect] { [:] }
  static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
    value.merge(nextValue(), uniquingKeysWith: { _, new in new })
  }
}
private struct ContentSlot: View {
  let id: String
  var body: some View {
    Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(GeometryReader { geometry in
        Color.clear.preference(key: FramePreference.self,
          value: [id: geometry.frame(in: .named("DDNNavigation"))])
      })
      .accessibilityHidden(true)
  }
}
private struct FooterSlot: View {
  var body: some View {
    Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(GeometryReader { geometry in
        Color.clear.preference(key: FramePreference.self,
          value: [footerSlotKey: geometry.frame(in: .named("DDNNavigation"))])
      })
      .accessibilityHidden(true)
  }
}
private struct NavigationRoot: View {
  @ObservedObject var model: NavigationModel
  var config: Configuration { model.configuration }
  var visibility: Binding<NavigationSplitViewVisibility> {
    Binding(get: { config.collapsed == true ? .detailOnly : .all }, set: { value in
      guard config.mode == "sidebar" else { return }
      model.send(["type": "collapse", "collapsed": value == .detailOnly])
    })
  }
  var body: some View {
    Group {
      switch config.mode {
      case "sidebar": sidebar
      case "split": split
      default: stack
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    // Sidebar rows apply the foreground individually so that selected rows keep
    // the system's selected label color.
    .foregroundStyle(hex: config.mode == "sidebar" ? nil : config.appearance?.foregroundColor)
    .tint(config.appearance?.accentColor.map { color($0, fallback: .accentColor) })
    .background(color(config.appearance?.backgroundColor, fallback: Color(nsColor: .windowBackgroundColor)))
    .coordinateSpace(name: "DDNNavigation")
    // RN scenes are composited over the measured native content slots. Avoid
    // animating the placeholders independently of their React content.
    .transaction { $0.disablesAnimations = true; $0.animation = nil }
    .onPreferenceChange(FramePreference.self) { frames in
      let revision = config.revision
      // Defer events until after SwiftUI's layout pass has completed.
      DispatchQueue.main.async {
        guard model.configuration.revision == revision else { return }
        model.report(frames)

      }
    }
    .onChange(of: config.revision) {
      DispatchQueue.main.async { model.report(model.frames) }
    }
  }
  var stack: some View {
    VStack(spacing: 0) {
      if config.headerShown != false {
        HStack {
          if config.canGoBack == true {
            Button { model.send(["type": "back"]) } label: {
              Label(config.backTitle ?? "Back", systemImage: "chevron.left")
            }
          }
          Spacer()
          Text(config.items.first(where: { $0.key == config.activeKey })?.title ?? "")
            .font(.headline).lineLimit(1).accessibilityAddTraits(.isHeader)
          Spacer()
        }.padding(10)
        Divider()
      }
      NavigationStack(path: Binding(get: { Array(config.items.dropFirst().map(\.key)) }, set: { path in
        let count = config.items.count - 1 - path.count
        if count > 0 { model.send(["type": "pop", "count": count]) }
      })) {
        Color.clear
          .navigationDestination(for: String.self) { _ in
            Color.clear.navigationBarBackButtonHidden(true)
          }
      }
      // Destination geometry can retain NavigationStack's offscreen transition
      // position even with animations disabled. React scenes need the stable
      // content viewport, not the moving placeholders inside the native stack.
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(ContentSlot(id: config.activeKey))
    }
  }
  var sidebar: some View {
    NavigationSplitView(columnVisibility: visibility) {
      VStack(spacing: 0) {
        List(selection: Binding<String?>(get: { config.activeKey }, set: { key in
          if let key { model.send(["type": "select", "key": key]) }
        })) {
          ForEach(Array(config.items.filter { $0.hidden != true }.enumerated()), id: \.element.key) { index, item in
            if let section = item.section,
               index == 0 || config.items.filter({ $0.hidden != true })[index - 1].section != section {
              Text(section).font(.caption).foregroundStyle(.secondary).accessibilityAddTraits(.isHeader)
                .selectionDisabled()
            }
            Group {
              if let icon = item.icon {
                Label { title(item) } icon: {
                  if icon.type == "react" {
                    ReactIconAnchor(key: item.key, model: model)
                      .frame(width: icon.size, height: icon.size).accessibilityHidden(true)
                  } else { SidebarIconView(icon: icon) }
                }
                  .labelStyle(.titleAndIcon)
              } else { title(item) }
            }
            .badge(item.badge.map { Text($0) })
            .tag(item.key).disabled(item.disabled == true)
            .selectionDisabled(item.disabled == true)
          }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        if let height = config.footerHeight, height > 0 {
          FooterSlot().frame(height: height)
        }
      }
      // Without an explicit color, keep the translucent system sidebar material.
      .background(config.appearance?.sidebarBackgroundColor.map { color($0, fallback: .clear) } ?? .clear)
      .navigationSplitViewColumnWidth(min: 100, ideal: config.paneWidth ?? 240, max: 600)
    } detail: { ContentSlot(id: config.activeKey) }
  }
  // Only the label is tinted, so selection neither overrides the system's selected
  // label color nor recreates native icon anchors.
  func title(_ item: Item) -> some View {
    Text(item.title).foregroundStyle(hex: item.key == config.activeKey ? nil : config.appearance?.foregroundColor)
  }
  @ViewBuilder func column(_ value: Column) -> some View {
    ContentSlot(id: value.key).navigationSplitViewColumnWidth(
      min: value.minWidth, ideal: value.width, max: value.maxWidth ?? 100000)
  }
  @ViewBuilder var split: some View {
    let columns = config.columns ?? []
    if columns.count == 3 {
      NavigationSplitView(columnVisibility: .constant(.all)) {
        column(columns[0]).toolbar(removing: .sidebarToggle)
      } content: { column(columns[1]) } detail: { column(columns[2]) }
      .navigationSplitViewStyle(.balanced)
    } else if columns.count == 2 {
      NavigationSplitView(columnVisibility: .constant(.all)) {
        column(columns[0]).toolbar(removing: .sidebarToggle)
      } detail: { column(columns[1]) }
      .navigationSplitViewStyle(.balanced)
    } else if let first = columns.first { column(first) }
  }
}

/// The Fabric view hosts only native chrome/layout. React scenes remain in the
/// original Fabric tree, preserving context, Yoga layout and responder ancestry.
@objc(DDNNavigationView)
public final class DDNNavigationView: NSView {
  private let model = NavigationModel()
  private var hosting: NSHostingView<NavigationRoot>!
  @objc public var onEvent: ((String) -> Void)? {
    didSet { model.emit = onEvent }
  }
  public override var isFlipped: Bool { true }
  @objc public override init(frame: NSRect) {
    super.init(frame: frame)
    hosting = NSHostingView(rootView: NavigationRoot(model: model))
    hosting.frame = bounds
    hosting.autoresizingMask = [.width, .height]
    // This view is embedded in an RN layout: Yoga owns its size, and React places
    // scenes in host coordinates. Do not let SwiftUI inset content for window
    // safe areas (e.g. a full-size content title bar) or constrain the window.
    hosting.safeAreaRegions = []
    hosting.sizingOptions = []
    addSubview(hosting)
    navigationHosts.add(self)
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }
  public override func layout() {
    super.layout()
    if model.viewport != bounds {
      model.viewport = bounds
      model.report(model.frames)
    }
  }
  @objc public func setConfiguration(_ json: String) {
    model.viewport = bounds
    guard let data = json.data(using: .utf8),
          let value = try? JSONDecoder().decode(Configuration.self, from: data) else { return }
    let hostChanged = model.configuration.hostId != value.hostId
    model.configuration = value
    if hostChanged { model.attachIcons() }
  }
  /// Registers (or with a nil host id, removes) React content for a native slot.
  @objc public static func setPortalContent(_ content: NSView, hostId: String?, slot: String?) {
    portalContents = portalContents.filter { $0.value.view != nil && $0.value.view !== content }
    guard let hostId, let slot, !hostId.isEmpty, !slot.isEmpty else {
      content.removeFromSuperview()
      return
    }
    portalContents[portalKey(hostId, slot)] = WeakView(content)
    for host in navigationHosts.allObjects where host.model.configuration.hostId == hostId {
      host.model.attachIcons()
    }
  }
}
