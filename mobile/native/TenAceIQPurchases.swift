import Foundation
import UIKit
import Capacitor
import StoreKit

final class TenAceIQBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TenAceIQPurchases())
    }
}

// A deadline covers read-only preparation, never Apple's payment confirmation.
@MainActor private final class TiqStoreRead {
    private let call: CAPPluginCall
    private let code: String
    private let onTimeout: () -> Void
    private var timer: Task<Void, Never>?
    private var work: Task<Void, Never>?
    private(set) var active = true
    private var deadlineActive = true
    init(_ call: CAPPluginCall, nanoseconds: UInt64, code: String, onTimeout: @escaping () -> Void = {}) {
        self.call = call; self.code = code; self.onTimeout = onTimeout
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
    func reject(_ message: String, _ code: String) {
        guard active else { return }
        active = false; stopDeadline(); work = nil; call.reject(message, code)
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
              transaction.appAccountToken != nil else { return }
        let id = String(transaction.id)
        if waiting[id] != nil || waiting.count < 50 { waiting[id] = result }
        if announce { notifyListeners("transactionsChanged", data: [:], retainUntilConsumed: true) }
    }
    @MainActor private func entries() -> [[String: String]] {
        waiting.values.compactMap { result in
            guard case .verified(let transaction) = result, let token = transaction.appAccountToken else { return nil }
            return ["transactionId": String(transaction.id), "accountToken": token.uuidString.lowercased(),
                    "signedTransaction": result.jwsRepresentation]
        }
    }
    @MainActor private func monthly(_ product: Product) -> Bool {
        product.type == .autoRenewable && product.subscription?.subscriptionPeriod.unit == .month && product.subscription?.subscriptionPeriod.value == 1
    }
    @MainActor private func matchesEnvironment(_ call: CAPPluginCall) async throws -> Bool {
        guard #available(iOS 16.0, *), let expected = call.getString("environment"), ["Sandbox", "Production"].contains(expected),
              case .verified(let app) = try await AppTransaction.shared,
              app.bundleID == "com.tenaceiq.app" else { return false }
        return expected == "Sandbox" && app.environment == .sandbox || expected == "Production" && app.environment == .production
    }
    @objc func products(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                guard let expected = call.getString("environment"), ["Sandbox", "Production"].contains(expected) else { call.reject("Open the correct app build.", "environment_mismatch"); return }
                guard Bundle.main.bundleIdentifier == "com.tenaceiq.app" else { call.reject("Update the app before loading plans.", "app_identity_mismatch"); return }
                // Price discovery does not need an app receipt or an existing purchase.
                // Purchase and restore still verify the signed AppTransaction environment.
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
    @objc func purchase(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard !showingStoreSheet, let id = call.getString("productId"), allowed.contains(id),
                  let rawToken = call.getString("accountToken"), let token = UUID(uuidString: rawToken) else { call.reject("Purchase is unavailable.", "store_unavailable"); return }
            guard purchasePresenter() != nil else { call.reject("Reopen account settings before purchasing.", "purchase_presenter_unavailable"); return }
            let operation = UUID()
            showingStoreSheet = true; purchaseOperation = operation
            let gate = TiqStoreRead(call, nanoseconds: 30_000_000_000, code: "purchase_preparation_timeout") { [weak self] in
                if self?.purchaseOperation == operation { self?.purchaseOperation = nil; self?.showingStoreSheet = false }
            }
            gate.start { gate in
                defer { if self.purchaseOperation == operation { self.purchaseOperation = nil; self.showingStoreSheet = false } }
                do {
                    let environmentMatches = try await self.matchesEnvironment(call)
                    guard gate.active else { return }
                    guard environmentMatches else { gate.reject("Apple environment does not match this account.", "environment_mismatch"); return }
                    let storefront = await Storefront.current
                    guard gate.active else { return }
                    guard storefront?.countryCode == "USA" else { gate.reject("U.S. App Store required.", "unsupported_storefront"); return }
                    let products = try await Product.products(for: [id])
                    guard gate.active else { return }
                    guard let product = products.first, self.monthly(product), self.waiting.count < 50 else { gate.reject("Purchase is unavailable.", "store_unavailable"); return }
                    // Reject an existing membership bound to either account before another buy.
                    for await entitlement in Transaction.currentEntitlements {
                        guard gate.active else { return }
                        if case .verified(let current) = entitlement, self.allowed.contains(current.productID) {
                            gate.reject("Restore or manage the existing Apple membership first.", current.appAccountToken == token ? "existing_purchase" : "account_mismatch")
                            return
                        }
                    }
                    guard gate.active else { return }
                    // Refresh the actual visible controller after all asynchronous preparation.
                    guard let presenter = self.purchasePresenter(), let scene = presenter.viewIfLoaded?.window?.windowScene else { gate.reject("Reopen the account screen before purchasing.", "purchase_presenter_unavailable"); return }
                    gate.stopDeadline()
                    let result: Product.PurchaseResult
                    if #available(iOS 18.2, *) { result = try await product.purchase(confirmIn: presenter, options: [.appAccountToken(token)]) }
                    else if #available(iOS 17.0, *) { result = try await product.purchase(confirmIn: scene, options: [.appAccountToken(token)]) }
                    else { result = try await product.purchase(options: [.appAccountToken(token)]) }
                    switch result {
                    case .success(let verified):
                        guard case .verified(let transaction) = verified, transaction.appAccountToken == token else { gate.reject("Purchase could not be verified.", "unverified_transaction"); return }
                        self.capture(verified, announce: false)
                        gate.resolve(["state": "purchased", "transactionId": String(transaction.id),
                                      "accountToken": token.uuidString.lowercased(), "signedTransaction": verified.jwsRepresentation])
                    case .pending: gate.resolve(["state": "pending"])
                    case .userCancelled: gate.resolve(["state": "cancelled"])
                    @unknown default: gate.reject("Purchase is unavailable.", "store_unavailable")
                    }
                } catch { gate.reject("Apple purchase did not complete.", "store_unavailable") }
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
                guard try await matchesEnvironment(call) else { call.reject("Apple environment does not match this account.", "environment_mismatch"); return }
                // Authentication prompt is allowed only after the explicit Restore button.
                try await AppStore.sync()
                for await result in Transaction.unfinished { capture(result, announce: false) }
                for await result in Transaction.currentEntitlements { capture(result, announce: false) }
                call.resolve(["transactions": entries()])
            } catch { call.reject("Restore did not complete.", "store_unavailable") }
        }
    }
    @objc func finish(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let id = call.getString("transactionId"), let raw = call.getString("accountToken"), let token = UUID(uuidString: raw), let signed = call.getString("signedTransaction") else { call.reject("Invalid receipt.", "receipt_mismatch"); return }
            guard let result = waiting[id] else { call.resolve(["finished": true]); return }
            guard case .verified(let transaction) = result, transaction.appAccountToken == token else { call.reject("Receipt belongs to another account.", "receipt_mismatch"); return }
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
