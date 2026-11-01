import Foundation
import CoreFoundation
import UIKit
import Capacitor
import StoreKit
import UserNotifications
import LocalAuthentication
import Security

final class TenAceIQBridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        _ = TiqBiometricSignInController.shared // Retire the old app-lock preference.
    }
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TenAceIQPurchases())
        bridge?.registerPluginInstance(TenAceIQNotifications())
        bridge?.registerPluginInstance(TenAceIQBiometricSignIn())
        bridge?.registerPluginInstance(TenAceIQFiles())
    }
}

enum TiqExportPayload {
    static func decode(name: String, mime: String, base64: String) -> Data? {
        let suffixes = ["image/png": ".png", "application/json": ".json", "text/calendar": ".ics", "text/plain": ".txt"]
        guard let suffix = suffixes[mime], name.hasSuffix(suffix),
              name.range(of: "^[A-Za-z0-9][A-Za-z0-9._-]{0,110}$", options: .regularExpression) != nil,
              !name.contains(".."), base64.utf8.count <= 50_331_648,
              let data = Data(base64Encoded: base64), data.count <= 37_748_736, !data.isEmpty else { return nil }
        if mime == "image/png" { return data.starts(with: [137,80,78,71,13,10,26,10]) ? data : nil }
        guard let text = String(data: data, encoding: .utf8) else { return nil }
        if mime == "application/json", (try? JSONSerialization.jsonObject(with: data)) == nil { return nil }
        if mime == "text/calendar", !text.hasPrefix("BEGIN:VCALENDAR") { return nil }
        return data
    }
}

/// Explicit user exports only. The app supplies bytes, never filesystem paths or remote URLs.
@objc(TenAceIQFiles)
public final class TenAceIQFiles: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TenAceIQFiles"
    public let jsName = "TiqFiles"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "exportFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "begin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "append", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]
    private var activity: UIActivityViewController?
    private var activeOwner: String?
    private var pending: CAPPluginCall?
    private var folder: URL?
    private var stagedOwner: String?
    private var stagedID: String?
    private var stagedURL: URL?
    private var stagedFolder: URL?
    private var stagedExpected = 0
    private var stagedReceived = 0
    private var stagedHandle: FileHandle?
    private var stagedExpiry: DispatchWorkItem?
    private func clearStage() {
        stagedExpiry?.cancel(); stagedExpiry = nil
        try? stagedHandle?.close(); stagedHandle = nil
        if let dir = stagedFolder { try? FileManager.default.removeItem(at: dir) }
        stagedOwner = nil; stagedID = nil; stagedURL = nil; stagedFolder = nil; stagedExpected = 0; stagedReceived = 0
    }
    @objc func begin(_ call: CAPPluginCall) {
        guard let owner = call.getString("owner"), UUID(uuidString: owner) != nil,
              let request = call.getString("requestId"), UUID(uuidString: request) != nil,
              let name = call.getString("name"), name.range(of: "^[A-Za-z0-9][A-Za-z0-9._-]{0,110}$", options: .regularExpression) != nil, !name.contains(".."),
              let mime = call.getString("mime"), let suffix = ["image/png":".png", "application/json":".json", "text/calendar":".ics", "text/plain":".txt", "video/mp4":".mp4", "video/quicktime":".mov", "video/webm":".webm"][mime], name.hasSuffix(suffix),
              let size = call.getInt("size"), size > 0, size <= 734_003_200 else { call.reject("Choose a supported export.", "invalid_export"); return }
        DispatchQueue.main.async {
            guard self.pending == nil, self.stagedID == nil else { call.reject("Finish the current export.", "export_busy"); return }
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("tenaceiq-export-" + UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
                let url = directory.appendingPathComponent(name)
                guard FileManager.default.createFile(atPath: url.path, contents: nil, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]) else { throw CocoaError(.fileWriteUnknown) }
                self.stagedHandle = try FileHandle(forWritingTo: url); self.stagedURL = url; self.stagedFolder = directory
                self.stagedOwner = owner; self.stagedID = request; self.stagedExpected = size; self.stagedReceived = 0
                let expiry = DispatchWorkItem { [weak self] in self?.clearStage() }; self.stagedExpiry = expiry
                DispatchQueue.main.asyncAfter(deadline: .now() + 300, execute: expiry)
                call.resolve()
            } catch { try? FileManager.default.removeItem(at: directory); self.clearStage(); call.reject("Export could not start.", "export_failed") }
        }
    }
    @objc func append(_ call: CAPPluginCall) {
        guard let owner = call.getString("owner"), let request = call.getString("requestId"), let offset = call.getInt("offset"),
              let raw = call.getString("base64"), raw.utf8.count <= 1_398_104,
              let data = Data(base64Encoded: raw), data.count > 0, data.count <= 1_048_576 else { call.reject("Invalid export chunk.", "invalid_export"); return }
        DispatchQueue.main.async {
            guard owner == self.stagedOwner, request == self.stagedID, offset == self.stagedReceived,
                  self.stagedReceived + data.count <= self.stagedExpected, let handle = self.stagedHandle else { call.reject("Export request changed.", "export_mismatch"); return }
            do { try handle.write(contentsOf: data); self.stagedReceived += data.count; call.resolve() }
            catch { self.clearStage(); call.reject("Export write failed.", "export_failed") }
        }
    }
    @objc func share(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard call.getString("owner") == self.stagedOwner, call.getString("requestId") == self.stagedID,
                  self.stagedReceived == self.stagedExpected, self.stagedExpected > 0,
                  let url = self.stagedURL, let directory = self.stagedFolder,
                  let host = self.bridge?.viewController, host.viewIfLoaded?.window != nil, host.presentedViewController == nil else { call.reject("Export is not ready.", "export_mismatch"); return }
            do { try self.stagedHandle?.synchronize(); try self.stagedHandle?.close(); self.stagedHandle = nil }
            catch { self.clearStage(); call.reject("Export write failed.", "export_failed"); return }
            self.pending = call; self.activeOwner = self.stagedOwner; self.folder = directory
            self.stagedExpiry?.cancel(); self.stagedExpiry = nil; self.stagedOwner = nil; self.stagedID = nil; self.stagedURL = nil; self.stagedFolder = nil; self.stagedExpected = 0; self.stagedReceived = 0
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let popover = sheet.popoverPresentationController { popover.sourceView = host.view; popover.sourceRect = CGRect(x: host.view.bounds.midX, y: host.view.bounds.midY, width: 1, height: 1) }
            self.activity = sheet; sheet.completionWithItemsHandler = { [weak self] _, completed, _, _ in DispatchQueue.main.async { self?.finish(completed: completed) } }
            host.present(sheet, animated: true)
        }
    }

    @objc func exportFile(_ call: CAPPluginCall) {
        guard let owner = call.getString("owner"), UUID(uuidString: owner) != nil,
              let requestID = call.getString("requestId"), UUID(uuidString: requestID) != nil,
              let name = call.getString("name"), let mime = call.getString("mime"), let raw = call.getString("base64"),
              let data = TiqExportPayload.decode(name: name, mime: mime, base64: raw) else {
            call.reject("Choose a smaller supported export.", "invalid_export"); return
        }
        DispatchQueue.main.async {
            guard self.pending == nil, self.stagedID == nil, let host = self.bridge?.viewController,
                  host.viewIfLoaded?.window != nil, host.presentedViewController == nil else {
                call.reject("Close the current sheet before exporting.", "export_busy"); return
            }
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("tenaceiq-export-" + UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
                let url = directory.appendingPathComponent(name, isDirectory: false)
                try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                if let popover = sheet.popoverPresentationController { popover.sourceView = host.view; popover.sourceRect = CGRect(x: host.view.bounds.midX, y: host.view.bounds.midY, width: 1, height: 1) }
                self.pending = call; self.activeOwner = owner; self.activity = sheet; self.folder = directory
                sheet.completionWithItemsHandler = { [weak self] _, completed, _, _ in
                    DispatchQueue.main.async { self?.finish(completed: completed) }
                }
                host.present(sheet, animated: true)
            } catch {
                try? FileManager.default.removeItem(at: directory)
                call.reject("The export could not be prepared.", "export_failed")
            }
        }
    }
    private func finish(completed: Bool) {
        let call = pending, oldFolder = folder
        pending = nil; activeOwner = nil; activity = nil; folder = nil
        call?.resolve(["completed": completed])
        if let oldFolder { try? FileManager.default.removeItem(at: oldFolder) }
    }
    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.stagedOwner == call.getString("owner") { self.clearStage() }
            if self.activeOwner == call.getString("owner") {
                self.activity?.dismiss(animated: false); self.finish(completed: false)
            }
            call.resolve()
        }
    }
}

/// Explicit sign-in only. Foregrounding never authenticates or covers the app.
@MainActor final class TiqBiometricSignInController: NSObject {
    static let shared = TiqBiometricSignInController()
    private let defaults: UserDefaults
    private static let ownerKey = "tenaceiq.biometricSignInOwner"
    nonisolated private static let service = "com.tenaceiq.app.biometric-sign-in"
    nonisolated private static let account = "saved-account"
    private var generation = 0
    private var context: LAContext?
    private var requestID: String?
    private var completion: (([String: String]?, String) -> Void)?

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        super.init()
        defaults.removeObject(forKey: "tenaceiq.requireDeviceUnlock")
        NotificationCenter.default.addObserver(self, selector: #selector(enterBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
    }
    deinit { NotificationCenter.default.removeObserver(self) }

    private func newContext() -> LAContext { LAContext() }
    func status(owner: String?) -> [String: Any] {
        let candidate = newContext()
        var error: NSError?
        let available = candidate.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        let saved = defaults.string(forKey: Self.ownerKey)
        return ["available": available, "saved": saved != nil,
                "forCurrentOwner": owner != nil && saved == owner,
                "biometry": candidate.biometryType == .touchID ? "touchID" : "faceID"]
    }
    nonisolated private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: Self.service, kSecAttrAccount as String: Self.account,
         kSecAttrSynchronizable as String: false]
    }
    private func store(_ credential: [String: String]) -> Bool {
        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .biometryCurrentSet, &error),
              let data = try? JSONSerialization.data(withJSONObject: credential) else { return false }
        // Replacing a saved account is explicit; no plaintext or iCloud fallback.
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecAttrAccessControl as String] = access
        item[kSecValueData as String] = data
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }
    nonisolated private func read(using candidate: LAContext) -> (OSStatus, [String: String]?) {
        var item = query
        item[kSecReturnData as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        item[kSecUseAuthenticationContext as String] = candidate
        var value: CFTypeRef?
        let code = SecItemCopyMatching(item as CFDictionary, &value)
        let credential = (value as? Data).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: String] }
        return (code, credential)
    }
    @discardableResult func forget(owner: String) -> Bool {
        guard defaults.string(forKey: Self.ownerKey) == owner else { return true }
        cancel()
        let code = SecItemDelete(query as CFDictionary)
        guard code == errSecSuccess || code == errSecItemNotFound else { return false }
        defaults.removeObject(forKey: Self.ownerKey)
        return true
    }
    func cancel(request: String? = nil) {
        guard request == nil || request == requestID else { return }
        generation += 1
        let pending = completion
        completion = nil
        requestID = nil
        context?.invalidate()
        context = nil
        pending?(nil, "authentication_cancelled")
    }
    @objc func enterBackground() { cancel() }
    private func finish(_ value: [String: String]?, code: String, candidate: LAContext, visit: Int) {
        guard context === candidate, generation == visit else { return }
        let pending = completion
        completion = nil
        requestID = nil
        context = nil
        candidate.invalidate()
        pending?(value, code)
    }
    func authenticate(request: String, credential: [String: String]? = nil, reply: @escaping ([String: String]?, String) -> Void) {
        guard context == nil else { reply(nil, "authentication_busy"); return }
        guard UIApplication.shared.applicationState != .background else { reply(nil, "authentication_cancelled"); return }
        let candidate = newContext()
        var error: NSError?
        guard candidate.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else { reply(nil, "authentication_unavailable"); return }
        if credential == nil && defaults.string(forKey: Self.ownerKey) == nil { reply(nil, "credential_missing"); return }
        let visit = generation
        context = candidate
        requestID = request
        completion = reply
        candidate.localizedFallbackTitle = ""
        candidate.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: credential == nil ? "Sign in to TenAceIQ with your saved account." : "Save this account for Face ID sign-in on this iPhone.") { [weak self] success, _ in
            DispatchQueue.main.async {
                guard let self, self.context === candidate, self.generation == visit else { return }
                guard success else { self.finish(nil, code: "authentication_cancelled", candidate: candidate, visit: visit); return }
                if let credential {
                    let saved = self.store(credential)
                    if saved { self.defaults.set(credential["owner"], forKey: Self.ownerKey) }
                    else { self.defaults.removeObject(forKey: Self.ownerKey) }
                    self.finish(saved ? [:] : nil, code: saved ? "" : "credential_storage_failed", candidate: candidate, visit: visit)
                } else {
                    // Keychain access can block for system authentication; keep it off the UI thread.
                    DispatchQueue.global(qos: .userInitiated).async {
                        let (code, saved) = self.read(using: candidate)
                        DispatchQueue.main.async {
                            guard self.context === candidate, self.generation == visit else { return }
                            let valid = code == errSecSuccess && saved?["owner"] == self.defaults.string(forKey: Self.ownerKey) && !(saved?["password"] ?? "").isEmpty && !(saved?["email"] ?? "").isEmpty
                            if code == errSecItemNotFound { self.defaults.removeObject(forKey: Self.ownerKey) }
                            self.finish(valid ? saved : nil, code: valid ? "" : code == errSecItemNotFound ? "credential_missing" : "credential_unavailable", candidate: candidate, visit: visit)
                        }
                    }
                }
            }
        }
    }
}

@objc(TenAceIQBiometricSignIn)
public final class TenAceIQBiometricSignIn: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TenAceIQBiometricSignIn"
    public let jsName = "TiqBiometricSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remember", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forget", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]
    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(TiqBiometricSignInController.shared.status(owner: call.getString("owner"))) }
    }
    @objc func remember(_ call: CAPPluginCall) {
        guard let owner = call.getString("owner"), UUID(uuidString: owner) != nil,
              let email = call.getString("email"), email.contains("@"), email.count <= 320,
              let password = call.getString("password"), !password.isEmpty, password.count <= 4096,
              let request = call.getString("request"), UUID(uuidString: request) != nil else { call.reject("Verify your account before saving sign-in.", "invalid_credential"); return }
        DispatchQueue.main.async {
            TiqBiometricSignInController.shared.authenticate(request: request, credential: ["owner": owner, "email": email, "password": password]) { value, code in
                if value != nil { call.resolve() } else { call.reject("Sign-in was not saved.", code) }
            }
        }
    }
    @objc func signIn(_ call: CAPPluginCall) {
        guard let request = call.getString("request"), UUID(uuidString: request) != nil else { call.reject("Choose Face ID sign-in.", "invalid_request"); return }
        DispatchQueue.main.async {
            TiqBiometricSignInController.shared.authenticate(request: request) { value, code in
                if let value { call.resolve(value) } else { call.reject("Use your password or email code to sign in.", code) }
            }
        }
    }
    @objc func forget(_ call: CAPPluginCall) {
        guard let owner = call.getString("owner"), UUID(uuidString: owner) != nil else { call.reject("Choose your saved account.", "invalid_credential"); return }
        DispatchQueue.main.async {
            if TiqBiometricSignInController.shared.forget(owner: owner) { call.resolve() }
            else { call.reject("Saved sign-in could not be removed.", "credential_storage_failed") }
        }
    }
    @objc func cancel(_ call: CAPPluginCall) {
        guard let request = call.getString("request") else { call.resolve(); return }
        DispatchQueue.main.async { TiqBiometricSignInController.shared.cancel(request: request); call.resolve() }
    }
}

// Clearing this app's displayed alerts does not require an APNs registration
// callback in this process. Capacitor's push plugin requires one for its helper.
@objc(TenAceIQNotifications)
public final class TenAceIQNotifications: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TenAceIQNotifications"
    public let jsName = "TiqNotifications"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "clearDelivered", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBadge", returnType: CAPPluginReturnPromise)
    ]

    @objc func clearDelivered(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            UIApplication.shared.applicationIconBadgeNumber = 0
            call.resolve()
        }
    }

    @objc func setBadge(_ call: CAPPluginCall) {
        guard let number = call.getValue("count") as? NSNumber,
              CFGetTypeID(number) != CFBooleanGetTypeID() else {
            call.reject("Invalid unread count.", "invalid_badge_count"); return
        }
        let value = number.doubleValue
        guard value.isFinite, value.rounded(.towardZero) == value, value >= 0, value <= 100 else {
            call.reject("Invalid unread count.", "invalid_badge_count"); return
        }
        let count = Int(value), center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            // Respect the iPhone's badge choice. Never request authorization here.
            guard count == 0 || settings.badgeSetting == .enabled else {
                call.resolve(["applied": false]); return
            }
            if #available(iOS 16.0, *) {
                center.setBadgeCount(count) { error in
                    if error != nil { call.reject("Unread badge unavailable.", "badge_unavailable") }
                    else { call.resolve(["applied": true]) }
                }
            } else {
                DispatchQueue.main.async {
                    UIApplication.shared.applicationIconBadgeNumber = count
                    call.resolve(["applied": true])
                }
            }
        }
    }
}

// A deadline covers read-only preparation, never Apple's sign-in or payment confirmation.
@MainActor private final class TiqStoreRead {
    private let call: CAPPluginCall
    private let code: String
    private let onTimeout: () -> Void
    private let nanoseconds: UInt64
    private var timer: Task<Void, Never>?
    private var work: Task<Void, Never>?
    private(set) var active = true
    private var deadlineActive = true
    init(_ call: CAPPluginCall, nanoseconds: UInt64, code: String, onTimeout: @escaping () -> Void = {}) {
        self.call = call; self.code = code; self.onTimeout = onTimeout; self.nanoseconds = nanoseconds
        resumeDeadline()
    }
    func resumeDeadline() {
        guard active else { return }
        timer?.cancel(); deadlineActive = true
        let nanoseconds = self.nanoseconds
        timer = Task { @MainActor [weak self] in
            do { try await Task.sleep(nanoseconds: nanoseconds) } catch { return }
            guard !Task.isCancelled, let self, self.active, self.deadlineActive else { return }
            self.active = false
            self.work?.cancel(); self.work = nil; self.timer = nil
            self.onTimeout()
            self.call.reject("Apple preparation took too long. No new purchase was started.", self.code)
        }
    }
    func start(_ action: @escaping @MainActor (TiqStoreRead) async -> Void) {
        work = Task { @MainActor in await action(self) }
    }
    func stopDeadline() { deadlineActive = false; timer?.cancel(); timer = nil }
    func resolve(_ data: [String: Any]) {
        guard active else { return }
        active = false; stopDeadline(); work = nil; call.resolve(data)
    }
    func reject(_ message: String, _ code: String, data: [String: Any]? = nil) {
        guard active else { return }
        active = false; stopDeadline(); work = nil; call.reject(message, code, nil, data)
    }
}

// This signed internal-beta channel cannot initiate production purchases.
// Subscription access still requires a verified, owner-bound transaction and server acknowledgment.
private enum TiqPurchaseChannel {
    static func matches(bundleID: String?, channel: String?, expected: String?) -> Bool {
        bundleID == "com.tenaceiq.app" && channel == "TestFlightInternalSandbox" && expected == "Sandbox"
    }
    @available(iOS 16.0, *) static func accepts(_ environment: AppStore.Environment) -> Bool { environment == .sandbox }
    static func cancelled(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if let store = error as? StoreKitError, case .userCancelled = store { return true }
        let failure = error as NSError
        return failure.domain == SKErrorDomain && failure.code == SKError.Code.paymentCancelled.rawValue
    }
}

// StoreKit keeps current entitlements available without an account-authentication refresh.
// Only ask Apple to synchronize when no verified membership is already available.
@MainActor private enum TiqRestoreRead {
    static func transactions<T>(read: () async -> [T], synchronize: () async throws -> Void) async throws -> [T] {
        let current = await read()
        if !current.isEmpty { return current }
        try await synchronize()
        return await read()
    }
}

@objc(TenAceIQPurchases)
public final class TenAceIQPurchases: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TenAceIQPurchases"
    public let jsName = "TiqPurchases"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise)
    ]
    private let allowed: Set<String> = ["com.tenaceiq.app.player.monthly", "com.tenaceiq.app.captain.monthly"]
    private var waiting: [String: VerificationResult<Transaction>] = [:]
    private var updatesTask: Task<Void, Never>?
    private var showingStoreSheet = false
    private var purchaseOperation: UUID?

    override public func load() {
        updatesTask = Task { @MainActor [weak self] in
            for await result in Transaction.updates {
                self?.capture(result, announce: true)
            }
        }
    }
    deinit { updatesTask?.cancel() }

    @MainActor private func capture(_ result: VerificationResult<Transaction>, announce: Bool) {
        guard case .verified(let transaction) = result,
              allowed.contains(transaction.productID), transaction.productType == .autoRenewable,
              transaction.appAccountToken != nil, verifiedForBuild(transaction) else { return }
        let id = String(transaction.id)
        if waiting[id] != nil || waiting.count < 50 { waiting[id] = result }
        if announce { notifyListeners("transactionsChanged", data: [:], retainUntilConsumed: true) }
    }
    @MainActor private func entries() -> [[String: String]] {
        waiting.values.compactMap { result in
            guard case .verified(let transaction) = result, verifiedForBuild(transaction), let token = transaction.appAccountToken else { return nil }
            return ["transactionId": String(transaction.id), "accountToken": token.uuidString.lowercased(),
                    "signedTransaction": result.jwsRepresentation]
        }
    }
    @MainActor private func monthly(_ product: Product) -> Bool {
        product.type == .autoRenewable && product.subscription?.subscriptionPeriod.unit == .month && product.subscription?.subscriptionPeriod.value == 1
    }
    @MainActor private func matchesEnvironment(_ call: CAPPluginCall) -> Bool {
        guard #available(iOS 16.0, *) else { return false }
        return TiqPurchaseChannel.matches(bundleID: Bundle.main.bundleIdentifier,
            channel: Bundle.main.object(forInfoDictionaryKey: "TiqApplePurchaseChannel") as? String,
            expected: call.getString("environment"))
    }
    @MainActor private func verifiedForBuild(_ transaction: Transaction) -> Bool {
        guard #available(iOS 16.0, *),
              TiqPurchaseChannel.matches(bundleID: Bundle.main.bundleIdentifier,
                channel: Bundle.main.object(forInfoDictionaryKey: "TiqApplePurchaseChannel") as? String, expected: "Sandbox") else { return false }
        return transaction.appBundleID == "com.tenaceiq.app" && TiqPurchaseChannel.accepts(transaction.environment)
    }
    @objc func products(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                guard matchesEnvironment(call) else { call.reject("Open the correct app build.", "environment_mismatch"); return }
                guard Bundle.main.bundleIdentifier == "com.tenaceiq.app" else { call.reject("Update the app before loading plans.", "app_identity_mismatch"); return }
                // App-download verification is separate from subscription transaction verification.
                let products = try await Product.products(for: Array(allowed))
                guard let storefront = await Storefront.current else { call.reject("App Store region unavailable.", "storefront_unavailable"); return }
                guard storefront.countryCode == "USA" else { call.reject("U.S. App Store required.", "unsupported_storefront"); return }
                let valid = products.filter { allowed.contains($0.id) && monthly($0) }
                guard !valid.isEmpty else { call.reject("Apple has not returned the membership plans.", "products_not_found"); return }
                call.resolve(["available": true, "products": valid.map { ["id": $0.id, "price": $0.displayPrice] }])
            } catch {
                let failure = error as NSError
                let safeDomains = [NSURLErrorDomain, SKErrorDomain, "ASDErrorDomain", "AMSErrorDomain"]
                let domain = safeDomains.contains(failure.domain) ? failure.domain : "StoreKit"
                // Never expose receipt data, account identifiers or localized error text.
                call.reject("Apple could not load membership prices.", "products_request_failed", nil, ["supportCode": "\(domain):\(failure.code)"])
            }
        }
    }
    @MainActor private func purchasePresenter() -> UIViewController? {
        guard let presenter = bridge?.viewController,
              let window = presenter.viewIfLoaded?.window,
              !window.isHidden, window.isKeyWindow,
              window.windowScene?.activationState == .foregroundActive,
              presenter.presentedViewController == nil,
              !presenter.isBeingDismissed, !presenter.isBeingPresented else { return nil }
        return presenter
    }
    // Only fixed stages and allowlisted error domains/codes cross the bridge.
    // Never forward localized descriptions, receipts, account details or arbitrary userInfo.
    @MainActor private func purchaseFailure(_ error: Error, stage: String) -> (String, [String: Any]) {
        let stages: Set<String> = ["environment", "app_receipt", "app_authentication", "storefront", "products", "entitlements", "confirmation", "restore"]
        let safeStage = stages.contains(stage) ? stage : "confirmation"
        let domains: Set<String> = [NSURLErrorDomain, SKErrorDomain, "ASDErrorDomain", "AMSErrorDomain", "SKServerErrorDomain", "StoreKit.StoreKitError", "StoreKit.Product.PurchaseError"]
        var chain: [String] = [], failure = error as NSError
        for _ in 0..<3 {
            let domain = domains.contains(failure.domain) ? failure.domain : "StoreKit"
            chain.append("\(domain):\(failure.code)")
            guard let underlying = failure.userInfo[NSUnderlyingErrorKey] as? NSError else { break }
            failure = underlying
        }
        var code = ["environment", "app_receipt", "app_authentication", "storefront", "products", "entitlements"].contains(safeStage) ? "purchase_preparation_failed" : "store_unavailable"
        if let purchase = error as? Product.PurchaseError {
            switch purchase {
            case .productUnavailable: code = "purchase_product_unavailable"
            case .purchaseNotAllowed: code = "purchase_not_allowed"
            default: break
            }
        }
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
        let safeBuild = build.range(of: #"^\d{1,6}$"#, options: .regularExpression) != nil ? build : ""
        return (code, ["supportCode": safeStage + "/" + chain.joined(separator: "/"), "build": safeBuild])
    }
    @MainActor private func purchaseCancelled(_ error: Error) -> Bool { TiqPurchaseChannel.cancelled(error) }
    @objc func purchase(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard !showingStoreSheet else { call.reject("Apple is already open.", "store_busy"); return }
            guard let id = call.getString("productId"), allowed.contains(id),
                  let rawToken = call.getString("accountToken"), let token = UUID(uuidString: rawToken) else { call.reject("Purchase request is invalid.", "purchase_request_invalid"); return }
            guard purchasePresenter() != nil else { call.reject("Reopen account settings before purchasing.", "purchase_presenter_unavailable"); return }
            let operation = UUID()
            showingStoreSheet = true; purchaseOperation = operation
            let gate = TiqStoreRead(call, nanoseconds: 30_000_000_000, code: "purchase_preparation_timeout") { [weak self] in
                if self?.purchaseOperation == operation { self?.purchaseOperation = nil; self?.showingStoreSheet = false }
            }
            gate.start { gate in
                defer { if self.purchaseOperation == operation { self.purchaseOperation = nil; self.showingStoreSheet = false } }
                var stage = "environment"
                do {
                    let environmentMatches = self.matchesEnvironment(call)
                    guard gate.active else { return }
                    guard environmentMatches else { gate.reject("Apple environment does not match this account.", "environment_mismatch"); return }
                    stage = "storefront"
                    let storefront = await Storefront.current
                    guard gate.active else { return }
                    guard storefront?.countryCode == "USA" else { gate.reject("U.S. App Store required.", "unsupported_storefront"); return }
                    stage = "products"
                    let products = try await Product.products(for: [id])
                    guard gate.active else { return }
                    guard let product = products.first, self.monthly(product) else { gate.reject("Apple did not return the requested plan.", "purchase_product_unavailable"); return }
                    guard self.waiting.count < 50 else { gate.reject("Sync earlier purchases first.", "purchase_sync_pending"); return }
                    // Reject an existing membership bound to either account before another buy.
                    stage = "entitlements"
                    for await entitlement in Transaction.currentEntitlements {
                        guard gate.active else { return }
                        if case .verified(let current) = entitlement, self.verifiedForBuild(current), self.allowed.contains(current.productID) {
                            gate.reject("Restore or manage the existing Apple membership first.", current.appAccountToken == token ? "existing_purchase" : "account_mismatch")
                            return
                        }
                    }
                    guard gate.active else { return }
                    // Refresh the actual visible controller after all asynchronous preparation.
                    guard let presenter = self.purchasePresenter(), let scene = presenter.viewIfLoaded?.window?.windowScene else { gate.reject("Reopen the account screen before purchasing.", "purchase_presenter_unavailable"); return }
                    gate.stopDeadline()
                    stage = "confirmation"
                    let result: Product.PurchaseResult
                    if #available(iOS 18.2, *) { result = try await product.purchase(confirmIn: presenter, options: [.appAccountToken(token)]) }
                    else if #available(iOS 17.0, *) { result = try await product.purchase(confirmIn: scene, options: [.appAccountToken(token)]) }
                    else { result = try await product.purchase(options: [.appAccountToken(token)]) }
                    switch result {
                    case .success(let verified):
                        guard case .verified(let transaction) = verified, transaction.appAccountToken == token, self.verifiedForBuild(transaction) else { gate.reject("Purchase could not be verified.", "unverified_transaction"); return }
                        self.capture(verified, announce: false)
                        gate.resolve(["state": "purchased", "transactionId": String(transaction.id),
                                      "accountToken": token.uuidString.lowercased(), "signedTransaction": verified.jwsRepresentation])
                    case .pending: gate.resolve(["state": "pending"])
                    case .userCancelled: gate.resolve(["state": "cancelled"])
                    @unknown default: gate.reject("Purchase is unavailable.", "store_unavailable")
                    }
                } catch {
                    if self.purchaseCancelled(error) { gate.resolve(["state": "cancelled"]); return }
                    let (code, details) = self.purchaseFailure(error, stage: stage)
                    gate.reject("Apple purchase did not complete.", code, data: details)
                }
            }
        }
    }
    @objc func pending(_ call: CAPPluginCall) {
        Task { @MainActor in
            let gate = TiqStoreRead(call, nanoseconds: 15_000_000_000, code: "purchase_history_timeout")
            gate.start { gate in
                for await result in Transaction.unfinished {
                    guard gate.active else { return }
                    self.capture(result, announce: false)
                }
                gate.resolve(["transactions": self.entries()])
            }
        }
    }
    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard !showingStoreSheet else { call.reject("Apple is already open.", "store_busy"); return }
            guard matchesEnvironment(call) else { call.reject("Apple environment does not match this account.", "environment_mismatch"); return }
            let operation = UUID()
            showingStoreSheet = true; purchaseOperation = operation
            let gate = TiqStoreRead(call, nanoseconds: 15_000_000_000, code: "restore_history_timeout") { [weak self] in
                if self?.purchaseOperation == operation { self?.purchaseOperation = nil; self?.showingStoreSheet = false }
            }
            gate.start { gate in
                defer { if self.purchaseOperation == operation { self.purchaseOperation = nil; self.showingStoreSheet = false } }
                do {
                    let entitlements: [VerificationResult<Transaction>] = try await TiqRestoreRead.transactions(read: {
                        var current: [VerificationResult<Transaction>] = []
                        for await result in Transaction.currentEntitlements {
                            guard gate.active else { return [] }
                            if case .verified(let transaction) = result, self.verifiedForBuild(transaction),
                               self.allowed.contains(transaction.productID), transaction.productType == .autoRenewable,
                               transaction.appAccountToken != nil { current.append(result) }
                            if current.count >= 50 { break }
                        }
                        return current
                    }, synchronize: {
                        guard gate.active else { throw CancellationError() }
                        // This optional authentication prompt is never subject to a read deadline.
                        gate.stopDeadline()
                        try await AppStore.sync()
                        guard gate.active else { throw CancellationError() }
                        gate.resumeDeadline()
                    })
                    guard gate.active else { return }
                    for result in entitlements { self.capture(result, announce: false) }
                    for await result in Transaction.unfinished {
                        guard gate.active else { return }
                        self.capture(result, announce: false)
                    }
                    gate.resolve(["transactions": self.entries()])
                } catch {
                    guard gate.active else { return }
                    let (_, details) = self.purchaseFailure(error, stage: "restore")
                    gate.reject("Restore did not complete.", self.purchaseCancelled(error) ? "restore_cancelled" : "restore_unavailable", data: details)
                }
            }
        }
    }
    @objc func finish(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let id = call.getString("transactionId"), let raw = call.getString("accountToken"), let token = UUID(uuidString: raw), let signed = call.getString("signedTransaction") else { call.reject("Invalid receipt.", "receipt_mismatch"); return }
            guard let result = waiting[id] else { call.resolve(["finished": true]); return }
            guard case .verified(let transaction) = result, transaction.appAccountToken == token, verifiedForBuild(transaction) else { call.reject("Receipt belongs to another account.", "receipt_mismatch"); return }
            guard result.jwsRepresentation == signed else { call.resolve(["finished": false]); return }
            // JS calls this only after the server durably acknowledges this exact transaction.
            await transaction.finish()
            waiting.removeValue(forKey: id)
            call.resolve(["finished": true])
        }
    }
    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard !showingStoreSheet, !ProcessInfo.processInfo.isiOSAppOnMac, let scene = bridge?.viewController?.view.window?.windowScene else { call.reject("Open subscriptions in Apple Settings.", "store_unavailable"); return }
            showingStoreSheet = true
            defer { showingStoreSheet = false }
            do { try await AppStore.showManageSubscriptions(in: scene); call.resolve() }
            catch { call.reject("Apple subscriptions could not open.", "store_unavailable") }
        }
    }
}
