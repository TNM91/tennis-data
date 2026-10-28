import Foundation
import UIKit
import Capacitor
import StoreKit

final class TenAceIQBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TenAceIQPurchases())
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
        guard #available(iOS 16.0, *), let expected = call.getString("environment"),
              case .verified(let app) = try await AppTransaction.shared,
              app.bundleID == "com.tenaceiq.app" else { return false }
        return expected == "Sandbox" && app.environment == .sandbox || expected == "Production" && app.environment == .production
    }
    @objc func products(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                guard try await matchesEnvironment(call), await Storefront.current?.countryCode == "USA" else { call.resolve(["available": false, "products": []]); return }
                let products = try await Product.products(for: Array(allowed))
                let valid = products.filter { allowed.contains($0.id) && monthly($0) }
                guard valid.count == 2 else { call.resolve(["available": false, "products": []]); return }
                call.resolve(["available": true, "products": valid.map { ["id": $0.id, "price": $0.displayPrice] }])
            } catch { call.reject("Apple products are unavailable.", "store_unavailable") }
        }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard !showingStoreSheet, let id = call.getString("productId"), allowed.contains(id),
                  let rawToken = call.getString("accountToken"), let token = UUID(uuidString: rawToken),
                  let scene = bridge?.viewController?.view.window?.windowScene else { call.reject("Purchase is unavailable.", "store_unavailable"); return }
            showingStoreSheet = true
            defer { showingStoreSheet = false }
            do {
                guard try await matchesEnvironment(call), await Storefront.current?.countryCode == "USA", let product = try await Product.products(for: [id]).first,
                      monthly(product), waiting.count < 50 else { call.reject("Purchase is unavailable.", "store_unavailable"); return }
                // Prevent upgrading or rebuying a subscription bound to another TenAceIQ account.
                for await entitlement in Transaction.currentEntitlements {
                    if case .verified(let current) = entitlement, allowed.contains(current.productID) {
                        call.reject("Restore or manage the existing Apple membership first.", current.appAccountToken == token ? "existing_purchase" : "account_mismatch")
                        return
                    }
                }
                let result: Product.PurchaseResult
                if #available(iOS 17.0, *) { result = try await product.purchase(confirmIn: scene, options: [.appAccountToken(token)]) }
                else { result = try await product.purchase(options: [.appAccountToken(token)]) }
                switch result {
                case .success(let verified):
                    guard case .verified(let transaction) = verified, transaction.appAccountToken == token else { call.reject("Purchase could not be verified.", "unverified_transaction"); return }
                    capture(verified, announce: false)
                    call.resolve(["state": "purchased", "transactionId": String(transaction.id),
                                  "accountToken": token.uuidString.lowercased(), "signedTransaction": verified.jwsRepresentation])
                case .pending: call.resolve(["state": "pending"])
                case .userCancelled: call.resolve(["state": "cancelled"])
                @unknown default: call.reject("Purchase is unavailable.", "store_unavailable")
                }
            } catch { call.reject("Apple purchase did not complete.", "store_unavailable") }
        }
    }
    @objc func pending(_ call: CAPPluginCall) {
        Task { @MainActor in
            for await result in Transaction.unfinished { capture(result, announce: false) }
            call.resolve(["transactions": entries()])
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
