import assert from 'node:assert/strict'

// Injected only into the generated unsigned Debug simulator app.
const probe=String.raw`
#if DEBUG
private enum TiqSmokeBiometricVault {
    static var credential: [String: String]?
    static var stage = "waiting for foreground"
    static var deleteStatus: OSStatus = errSecSuccess
    static func remove() -> OSStatus {
        if deleteStatus == errSecSuccess || deleteStatus == errSecItemNotFound { credential = nil }
        return deleteStatus
    }
}
private final class TiqSmokeLAContext: LAContext {
    static var replies: [(Bool, Error?) -> Void] = []
    static var policyCorrect = true
    override func canEvaluatePolicy(_ policy: LAPolicy, error: NSErrorPointer) -> Bool {
        Self.policyCorrect = Self.policyCorrect && policy == .deviceOwnerAuthenticationWithBiometrics
        return true
    }
    override func evaluatePolicy(_ policy: LAPolicy, localizedReason: String, reply: @escaping (Bool, Error?) -> Void) {
        Self.policyCorrect = Self.policyCorrect && policy == .deviceOwnerAuthenticationWithBiometrics && !localizedReason.isEmpty
        Self.replies.append(reply)
    }
    override func invalidate() {} // A late success must be ignored.
}
@MainActor private func tiqBiometricSignInProbe() async -> Bool {
    // A cold simulator can load the controller before its scene is active.
    // Keep the production background-authentication guard in force.
    for _ in 0..<600 {
        if UIApplication.shared.applicationState == .active { break }
        try? await Task.sleep(nanoseconds: 50_000_000)
    }
    guard UIApplication.shared.applicationState == .active else { return false }
    TiqSmokeBiometricVault.stage = "migration and prompt-free status"
    let name = "tiq-biometric-sign-in-smoke"
    guard let defaults = UserDefaults(suiteName: name) else { return false }
    defaults.removePersistentDomain(forName: name)
    defer { defaults.removePersistentDomain(forName: name); TiqSmokeBiometricVault.credential = nil; TiqSmokeBiometricVault.deleteStatus = errSecSuccess }
    defaults.set(true, forKey: "tenaceiq.requireDeviceUnlock")
    let signIn = TiqBiometricSignInController(defaults: defaults)
    guard !defaults.bool(forKey: "tenaceiq.requireDeviceUnlock"), TiqSmokeLAContext.replies.isEmpty else { return false }
    let owner = "00000000-0000-4000-8000-000000000001"
    let credential = ["owner": owner, "email": "synthetic@example.test", "password": "synthetic-only"]
    guard signIn.status(owner: owner)["saved"] as? Bool == false, TiqSmokeLAContext.replies.isEmpty else { return false }
    signIn.enterBackground()
    guard TiqSmokeLAContext.replies.isEmpty else { return false }
    func authenticate(_ save: Bool, _ success: Bool, background: Bool = false) async -> [String: String]? {
        let task = Task { @MainActor in
            await withCheckedContinuation { continuation in
                signIn.authenticate(request: UUID().uuidString, credential: save ? credential : nil) { value, _ in continuation.resume(returning: value) }
            }
        }
        for _ in 0..<50 { if !TiqSmokeLAContext.replies.isEmpty { break }; try? await Task.sleep(nanoseconds: 10_000_000) }
        guard !TiqSmokeLAContext.replies.isEmpty else { signIn.cancel(); return nil }
        let reply = TiqSmokeLAContext.replies.removeFirst()
        signIn.cancel(request: "different-request")
        if background { signIn.enterBackground() }
        reply(success, nil)
        return await task.value
    }
    TiqSmokeBiometricVault.stage = "cancelled setup"
    guard await authenticate(true, false) == nil, TiqSmokeBiometricVault.credential == nil else { return false }
    TiqSmokeBiometricVault.stage = "verified setup"
    guard await authenticate(true, true) != nil, TiqSmokeBiometricVault.credential == credential,
          signIn.status(owner: owner)["forCurrentOwner"] as? Bool == true else { return false }
    TiqSmokeBiometricVault.stage = "explicit sign-in"
    guard await authenticate(false, true) == credential else { return false }
    TiqSmokeBiometricVault.stage = "different owner removal"
    signIn.forget(owner: "other-owner")
    guard signIn.status(owner: owner)["saved"] as? Bool == true else { return false }
    TiqSmokeBiometricVault.stage = "background cancellation"
    guard await authenticate(false, true, background: true) == nil else { return false }
    guard await authenticate(true, true, background: true) == nil else { return false }
    try? await Task.sleep(nanoseconds: 30_000_000)
    guard TiqSmokeBiometricVault.credential == credential else { return false }
    TiqSmokeBiometricVault.stage = "cold start without prompting"
    let cold = TiqBiometricSignInController(defaults: defaults)
    guard cold.status(owner: owner)["forCurrentOwner"] as? Bool == true, TiqSmokeLAContext.replies.isEmpty else { return false }
    TiqSmokeBiometricVault.stage = "failed removal preserves saved sign-in"
    TiqSmokeBiometricVault.deleteStatus = errSecInteractionNotAllowed
    guard !signIn.forget(owner: owner), signIn.status(owner: owner)["saved"] as? Bool == true, TiqSmokeBiometricVault.credential == credential else { return false }
    TiqSmokeBiometricVault.stage = "explicit removal"
    TiqSmokeBiometricVault.deleteStatus = errSecSuccess
    guard signIn.forget(owner: owner) else { return false }
    guard signIn.status(owner: owner)["saved"] as? Bool == false, TiqSmokeBiometricVault.credential == nil else { return false }
    TiqSmokeBiometricVault.stage = "complete"
    return TiqSmokeLAContext.policyCorrect
}
#endif
`
export function instrumentAppLockSmoke(source){
 source=source.replace(/\r\n/g,'\n')
 assert.ok(!source.includes('tiqBiometricSignInProbe'),'Refuse duplicate biometric instrumentation')
 const context='private func newContext() -> LAContext { LAContext() }'
 assert.equal(source.split(context).length,2,'Expected the explicit sign-in context factory')
 const store='private func store(_ credential: [String: String]) -> Bool {',read='nonisolated private func read(using candidate: LAContext) -> (OSStatus, [String: String]?) {'
 for(const marker of [store,read])assert.equal(source.split(marker).length,2,'Review changed Keychain helpers')
 const removal='let code = SecItemDelete(query as CFDictionary)'
 assert.equal(source.split(removal).length,2,'Review changed Keychain removal helper')
 const result=source.replace(store,store+`
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--tiq-storekit-smoke") { TiqSmokeBiometricVault.credential = credential; return true }
        #endif`).replace(read,read+`
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--tiq-storekit-smoke") { return (errSecSuccess, TiqSmokeBiometricVault.credential) }
        #endif`).replace(removal,`
        #if DEBUG
        let code = ProcessInfo.processInfo.arguments.contains("--tiq-storekit-smoke") ? TiqSmokeBiometricVault.remove() : SecItemDelete(query as CFDictionary)
        #else
        let code = SecItemDelete(query as CFDictionary)
        #endif
        `)
 return result.replace(context,'private func newContext() -> LAContext { TiqSmokeLAContext() }')+probe
}
export function verifyAppLockSmoke(report){
 assert.equal(report.nativeBiometricSignInLifecycleVerified,true,'Explicit sign-in, migration, ownership or late-reply guard failed')
 assert.equal(report.nativeBiometricSignInBridgeVerified,true,'Biometric sign-in did not respond through the app bridge')
 return true
}
