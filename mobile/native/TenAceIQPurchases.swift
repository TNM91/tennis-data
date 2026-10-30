import Foundation
import UIKit
import Capacitor
import StoreKit

final class TenAceIQBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TenAceIQPurchases())
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
            showingStoreSheet = true
            defer { showingStoreSheet = false }
            do {
                guard matchesEnvironment(call) else { call.reject("Apple environment does not match this account.", "environment_mismatch"); return }
                // Authentication prompt is allowed only after the explicit Restore button.
                try await AppStore.sync()
                for await result in Transaction.unfinished { capture(result, announce: false) }
                for await result in Transaction.currentEntitlements { capture(result, announce: false) }
                call.resolve(["transactions": entries()])
            } catch {
                let (code, details) = self.purchaseFailure(error, stage: "restore")
                call.reject("Restore did not complete.", code, nil, details)
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
