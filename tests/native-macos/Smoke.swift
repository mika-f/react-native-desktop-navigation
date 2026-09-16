import AppKit

@main
struct Smoke {
  static func main() {
    let app = NSApplication.shared
    app.setActivationPolicy(.prohibited)
    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1000, height: 600), styleMask: [.titled, .resizable], backing: .buffered, defer: false)
    let view = DDNNavigationView(frame: NSRect(x: 0, y: 0, width: 1000, height: 600))
    window.contentView = view
    var layouts: [[String: Any]] = []
    view.onEvent = { json in
      if let data = json.data(using: .utf8), let event = try? JSONSerialization.jsonObject(with: data) as? [String: Any], event["type"] as? String == "layout" { layouts.append(event) }
    }
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try! FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let iconURL = directory.appendingPathComponent("icon.png")
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 16, pixelsHigh: 16, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    for x in 0..<16 { for y in 0..<16 { bitmap.setColor(NSColor(deviceRed: 0, green: 0.3, blue: 1, alpha: 1), atX: x, y: y) } }
    try! bitmap.representation(using: .png, properties: [:])!.write(to: iconURL)
    let cases = [
      #"{"mode":"stack","items":[{"key":"home","title":"Home"}],"activeKey":"home","revision":1}"#,
      #"{"mode":"stack","items":[{"key":"home","title":"Home"},{"key":"detail","title":"Detail"}],"activeKey":"detail","revision":2,"canGoBack":true}"#,
      ##"{"mode":"sidebar","items":[{"key":"home","title":"Home","icon":{"type":"symbol","name":"house","size":18,"color":"#9966ff"}},{"key":"detail","title":"Detail","icon":{"type":"image","uri":"\##(iconURL.absoluteString)","size":16,"template":true}}],"activeKey":"home","revision":3,"paneWidth":240}"##,
      #"{"mode":"split","items":[],"activeKey":"a","revision":4,"columns":[{"key":"a","width":240,"minWidth":100},{"key":"b","width":400,"minWidth":100},{"key":"c","width":300,"minWidth":100}]}"#
    ]
    for config in cases {
      layouts = []
      view.setConfiguration(config)
      view.layoutSubtreeIfNeeded()
      let deadline = Date().addingTimeInterval(0.4)
      while Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.02)) }
      guard let last = layouts.last, let frames = last["frames"] as? [String: Any], !frames.isEmpty else { fatalError("Missing native layout for \(config)") }
      for (key, value) in frames {
        guard let rect = value as? [String: Double], let x = rect["x"], let y = rect["y"], let width = rect["width"], let height = rect["height"] else { fatalError("Invalid frame") }
        precondition(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1000.5 && y + height <= 600.5, "Invalid viewport for \(key): \(rect)")
      }
      print("Native layout passed: revision \(last["revision"]!), slots \(frames.keys.sorted())")
    }
    func pump() {
      view.layoutSubtreeIfNeeded()
      let deadline = Date().addingTimeInterval(0.3)
      while Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.02)) }
    }
    var sidebar: [String: Any] = ["mode": "sidebar", "activeKey": "row0", "revision": 5,
      "paneWidth": 240, "items": (0..<50).map { index -> [String: Any] in
        ["key": "row\(index)", "title": "Row \(index)", "icon": ["type": "react", "size": 24]]
      }]
    func applySidebar() {
      layouts = []
      view.setConfiguration(String(data: try! JSONSerialization.data(withJSONObject: sidebar), encoding: .utf8)!)
      pump()
    }
    func iconFrames() -> [String: [String: [String: Double]]] {
      guard let result = layouts.last?["iconFrames"] as? [String: [String: [String: Double]]] else { fatalError("Missing icon geometry") }
      return result
    }
    func descendants(_ parent: NSView) -> [NSView] {
      parent.subviews.flatMap { [$0] + descendants($0) }
    }
    applySidebar()
    let initial = iconFrames()
    guard let first = initial["row0"], let frame = first["frame"], let clip = first["clip"] else { fatalError("Missing first React icon: \(initial)") }
    precondition(frame["width"] == 24 && frame["height"] == 24 && clip["height"]! > 0, "React icon needs its full native slot: \(first)")
    let scrollers = descendants(view).compactMap { $0 as? NSScrollView }
    guard let scroller = scrollers.first(where: { ($0.documentView?.frame.height ?? 0) > $0.contentView.bounds.height + 100 }) else { fatalError("Missing scrollable native sidebar") }
    scroller.contentView.scroll(to: NSPoint(x: 0, y: 150))
    scroller.reflectScrolledClipView(scroller.contentView)
    pump()
    let scrolled = iconFrames()
    precondition(scrolled["row0"] == nil || scrolled["row0"]?["clip"]?["height"] == 0, "Scrolled-out React icon must be hidden: \(scrolled["row0"] as Any)")
    precondition(scrolled.values.contains { ($0["clip"]?["height"] ?? 0) > 0 }, "Scrolling must expose other icons")
    for value in scrolled.values {
      let frame = value["frame"]!, clip = value["clip"]!
      precondition(frame["width"] == 24 && frame["height"] == 24, "Scrolling must not resize SVGs")
      precondition(clip["height"]! <= 24 && clip["width"]! <= 24, "Clip must fit its icon")
    }
    sidebar["revision"] = 6
    sidebar["collapsed"] = true
    applySidebar()
    precondition(iconFrames().isEmpty, "Collapsed macOS sidebar must hide React icons")
    sidebar["revision"] = 7
    sidebar["collapsed"] = false
    applySidebar()
    precondition(!iconFrames().isEmpty, "Expanded sidebar must restore React icon anchors")
    sidebar["revision"] = 8
    sidebar["items"] = [["key": "row0", "title": "Plain"]]
    applySidebar()
    precondition(iconFrames().isEmpty, "Removed icons must not retain stale anchors")
    print("Native React icon slots passed: scrolling, clipping, collapse/expand, removal")
    func footerFrame() -> [String: Double]? { layouts.last?["footerFrame"] as? [String: Double] }
    sidebar["revision"] = 9
    sidebar["footerHeight"] = 64
    applySidebar()
    guard let footer = footerFrame() else { fatalError("Missing native footer slot") }
    // The headless window offsets SwiftUI content by its toolbar, so frames are
    // clipped at the viewport bottom; the footer must end there, never above.
    precondition(footer["width"]! > 0 && footer["height"]! > 0 && footer["height"]! <= 64 && abs(footer["y"]! + footer["height"]! - 600) < 0.5, "Footer must be reserved at the bottom of the sidebar: \(footer)")
    precondition((layouts.last?["frames"] as? [String: Any])?.keys.allSatisfy { !$0.hasPrefix("\u{0}") } ?? false, "Footer must not leak into content frames")
    sidebar["revision"] = 10
    sidebar["collapsed"] = true
    applySidebar()
    precondition(footerFrame() == nil, "Collapsed sidebar must hide the footer")
    sidebar["revision"] = 11
    sidebar["collapsed"] = false
    sidebar["footerHeight"] = nil
    applySidebar()
    precondition(footerFrame() == nil, "Removed footer must not report a frame")
    print("Native sidebar footer slot passed: reservation, collapse, removal")
    print("SwiftUI native layout smoke passed")
  }
}
