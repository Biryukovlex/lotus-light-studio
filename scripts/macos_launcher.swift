import Cocoa
import WebKit
import ImageIO

// Local wrapper: no Codex runtime, remote assets, or Bluetooth commands at startup.
let studioURL = URL(string: "http://127.0.0.1:8420/")!

func writeIcons(to directory: URL) throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    for size in [16, 32, 128, 256, 512] {
        for scale in [1, 2] {
            let pixels = size * scale
            let unit = CGFloat(pixels) / 64
            let context = CGContext(data: nil, width: pixels, height: pixels,
                                    bitsPerComponent: 8, bytesPerRow: pixels * 4,
                                    space: CGColorSpaceCreateDeviceRGB(),
                                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.setFillColor(CGColor(red: 0.035, green: 0.024, blue: 0.067, alpha: 1))
            context.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: pixels, height: pixels),
                                   cornerWidth: 16 * unit, cornerHeight: 16 * unit, transform: nil))
            context.fillPath()
            context.setFillColor(CGColor(red: 0.475, green: 0.294, blue: 0.616, alpha: 1))
            context.fillEllipse(in: CGRect(x: 16 * unit, y: 8 * unit,
                                           width: 32 * unit, height: 6 * unit))
            context.setFillColor(CGColor(red: 0.769, green: 0.604, blue: 1, alpha: 1))
            context.addPath(CGPath(roundedRect: CGRect(x: 28 * unit, y: 14 * unit,
                                                      width: 8 * unit, height: 40 * unit),
                                   cornerWidth: 4 * unit, cornerHeight: 4 * unit, transform: nil))
            context.fillPath()
            let suffix = scale == 2 ? "@2x" : ""
            let file = directory.appendingPathComponent("icon_\(size)x\(size)\(suffix).png")
            let output = CGImageDestinationCreateWithURL(file as CFURL, "public.png" as CFString, 1, nil)!
            CGImageDestinationAddImage(output, context.makeImage()!, nil)
            guard CGImageDestinationFinalize(output) else {
                throw NSError(domain: "LotusLauncher", code: 4,
                              userInfo: [NSLocalizedDescriptionKey: "The app icon could not be written."])
            }
        }
    }
}

final class StudioLauncher: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var server: Process?
    private var logHandle: FileHandle?
    private var closing = false
    private var loaded = false
    private var failed = false
    private var logURL: URL?
    private let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 1
        return URLSession(configuration: configuration)
    }()

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Lotus Light Studio", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)
        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        for (title, action, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"),
                                     ("Copy", "copy:", "c"), ("Paste", "paste:", "v"),
                                     ("Select All", "selectAll:", "a")] {
            editMenu.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        editItem.submenu = editMenu
        menu.addItem(editItem)
        NSApplication.shared.mainMenu = menu

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1120, height: 820),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Lotus Light Studio"
        window.minSize = NSSize(width: 400, height: 600)
        window.appearance = NSAppearance(named: .darkAqua)
        window.isReleasedWhenClosed = false
        window.center()
        window.setFrameAutosaveName("LotusLightStudioWindow")
        webView = WKWebView(frame: window.contentView!.bounds)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.underPageBackgroundColor = NSColor(calibratedRed: 0.055, green: 0.035, blue: 0.09, alpha: 1)
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
        checkServer(attempt: 0)
    }

    private func checkServer(attempt: Int) {
        guard !closing && !failed else { return }
        let request = URLRequest(url: studioURL.appendingPathComponent("api/status"))
        session.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self, !self.closing && !self.failed else { return }
                let status = data.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
                if status?["app"] as? String == "lotus-lamp-studio" {
                    if !self.loaded {
                        self.loaded = true
                        self.webView.load(URLRequest(url: studioURL))
                    }
                    return
                }
                if response != nil {
                    self.showFailure("Another service is using the lamp app’s local port. Close it and open Lotus Light Studio again.")
                    return
                }
                if self.server == nil {
                    do { try self.startServer() }
                    catch { self.showFailure(error.localizedDescription); return }
                }
                if attempt >= 60 || self.server?.isRunning == false {
                    self.showFailure("The local lamp app could not start. Check the log for details.")
                    return
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    self.checkServer(attempt: attempt + 1)
                }
            }
        }.resume()
    }

    private func startServer() throws {
        guard let root = Bundle.main.object(forInfoDictionaryKey: "LotusSourceRoot") as? String else {
            throw NSError(domain: "LotusLauncher", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "The launcher is missing its local app location. Rebuild it from the project."])
        }
        let directory = URL(fileURLWithPath: root, isDirectory: true)
        let python = directory.appendingPathComponent(".venv/bin/python")
        guard FileManager.default.isExecutableFile(atPath: python.path),
              FileManager.default.fileExists(atPath: directory.appendingPathComponent("lotus_lamp/app.py").path) else {
            throw NSError(domain: "LotusLauncher", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: "The local app or its Python environment has moved. Run Launch Lotus Lamp.command in the project, then reopen this launcher."])
        }
        let state = directory.appendingPathComponent(".local", isDirectory: true)
        try FileManager.default.createDirectory(at: state, withIntermediateDirectories: true)
        let log = state.appendingPathComponent("launcher.log")
        logURL = log
        if !FileManager.default.fileExists(atPath: log.path) {
            guard FileManager.default.createFile(atPath: log.path, contents: nil,
                                                attributes: [.posixPermissions: 0o600]) else {
                throw NSError(domain: "LotusLauncher", code: 3,
                              userInfo: [NSLocalizedDescriptionKey: "The local app log could not be created."])
            }
        }
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: log.path)
        let handle = try FileHandle(forWritingTo: log)
        handle.seekToEndOfFile()
        logHandle = handle
        let process = Process()
        process.executableURL = python
        process.arguments = ["-m", "lotus_lamp.app", "--no-browser"]
        process.currentDirectoryURL = directory
        var environment = ProcessInfo.processInfo.environment
        environment["PYTHONUNBUFFERED"] = "1"
        process.environment = environment
        process.standardOutput = handle
        process.standardError = handle
        process.standardInput = FileHandle.nullDevice
        process.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self, !self.closing && !self.failed else { return }
                self.showFailure("The local lamp app stopped. Reopen Lotus Light Studio to start it again.")
            }
        }
        server = process
        try process.run()
    }

    private func showFailure(_ message: String) {
        guard !failed else { return }
        failed = true
        let alert = NSAlert()
        alert.messageText = "Lotus Light Studio could not open"
        alert.informativeText = message
        alert.addButton(withTitle: "Close")
        if logURL != nil { alert.addButton(withTitle: "Open log") }
        if alert.runModal() == .alertSecondButtonReturn, let log = logURL {
            NSWorkspace.shared.open(log)
        }
        NSApplication.shared.terminate(nil)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window?.makeKeyAndOrderFront(nil)
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        closing = true
        session.invalidateAndCancel()
        // Only stop a server this launcher started; never terminate another instance.
        if let process = server, process.isRunning { process.terminate() }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "http" && url.host == "127.0.0.1" && url.port == 8420 {
            decisionHandler(.allow)
        } else {
            if url.scheme == "https" { NSWorkspace.shared.open(url) }
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme == "https" { NSWorkspace.shared.open(url) }
        return nil
    }
}

if CommandLine.arguments.count == 3 && CommandLine.arguments[1] == "--write-icons" {
    try writeIcons(to: URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true))
} else {
    let application = NSApplication.shared
    application.setActivationPolicy(.regular)
    let delegate = StudioLauncher()
    application.delegate = delegate
    application.run()
}
