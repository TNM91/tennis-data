import assert from 'node:assert/strict'

// Injected only into the generated unsigned simulator app, never signed source.
const probe=String.raw`
#if DEBUG
private final class TiqSmokeLAContext: LAContext {
    static var replies: [(Bool, Error?) -> Void] = []
    static var policyCorrect = true
    override func canEvaluatePolicy(_ policy: LAPolicy, error: NSErrorPointer) -> Bool {
        Self.policyCorrect = Self.policyCorrect && policy == .deviceOwnerAuthentication
        return true
    }
    override func evaluatePolicy(_ policy: LAPolicy, localizedReason: String, reply: @escaping (Bool, Error?) -> Void) {
        Self.policyCorrect = Self.policyCorrect && policy == .deviceOwnerAuthentication && !localizedReason.isEmpty
        Self.replies.append(reply)
    }
    override func invalidate() {} // Deliver late success to prove it cannot unlock.
}
@MainActor private func tiqAppLockProbe() async -> Bool {
    let name = "tiq-app-lock-smoke"
    guard let defaults = UserDefaults(suiteName: name) else { return false }
    defaults.removePersistentDomain(forName: name)
    defer { defaults.removePersistentDomain(forName: name) }
    let lock = TiqAppLockController(defaults: defaults)
    let host = UIViewController()
    let privateView = UIView()
    host.view.addSubview(privateView)
    lock.attach(to: host)
    lock.becomeActive()
    guard let cover = host.view.subviews.last, cover.accessibilityIdentifier == "tenaceiq-app-lock", cover.isHidden, !lock.enabled else { return false }
    func change(_ value: Bool, _ success: Bool, background: Bool = false) async -> Bool {
        let task = Task { @MainActor in
            await withCheckedContinuation { continuation in
                lock.setEnabled(value) { ok, _ in continuation.resume(returning: ok) }
            }
        }
        for _ in 0..<10 { if !TiqSmokeLAContext.replies.isEmpty { break }; await Task.yield() }
        guard !TiqSmokeLAContext.replies.isEmpty else { task.cancel(); return false }
        let reply = TiqSmokeLAContext.replies.removeFirst()
        if background { lock.enterBackground(); lock.becomeActive() }
        reply(success, nil)
        return await task.value
    }
    guard !(await change(true, false)), !lock.enabled, !defaults.bool(forKey: "tenaceiq.requireDeviceUnlock") else { return false }
    guard await change(true, true), lock.enabled, !lock.locked, cover.isHidden else { return false }
    lock.resignActive()
    guard !cover.isHidden, privateView.accessibilityElementsHidden, !privateView.isUserInteractionEnabled else { return false }
    lock.becomeActive()
    guard !lock.locked, cover.isHidden, privateView.isUserInteractionEnabled else { return false }
    guard !(await change(false, true, background: true)), lock.enabled, lock.locked, !cover.isHidden else { return false }
    let cold = TiqAppLockController(defaults: defaults)
    guard cold.enabled, cold.locked else { return false }
    let button = (cover.subviews.first as? UIStackView)?.arrangedSubviews.last as? UIButton
    guard let button else { return false }
    for success in [false, true] {
        button.sendActions(for: .touchUpInside)
        guard !TiqSmokeLAContext.replies.isEmpty else { return false }
        TiqSmokeLAContext.replies.removeFirst()(success, nil)
        try? await Task.sleep(nanoseconds: 20_000_000)
        guard lock.locked == !success, cover.isHidden == success else { return false }
    }
    guard await change(false, true), !lock.enabled, cover.isHidden else { return false }
    lock.resignActive(); lock.enterBackground(); lock.becomeActive()
    guard !lock.locked, cover.isHidden, !TiqAppLockController(defaults: defaults).enabled else { return false }
    return TiqSmokeLAContext.policyCorrect
}
#endif
`
export function instrumentAppLockSmoke(source){
 assert.ok(!source.includes('tiqAppLockProbe'),'Refuse duplicate app lock instrumentation')
 const marker='private func authenticate(reason: String, reply: @escaping (Bool, String) -> Void) {'
 assert.equal(source.split(marker).length,2,'Expected one native lock authentication entry')
 const start=source.indexOf(marker),prefix=source.slice(0,start),tail=source.slice(start)
 assert.ok(tail.includes('let candidate = LAContext()'))
 return prefix+tail.replace('let candidate = LAContext()','let candidate = TiqSmokeLAContext()')+probe
}
export function verifyAppLockSmoke(report){
 assert.equal(report.nativeAppLockLifecycleVerified,true,'Native lock lifecycle, persistence or late-reply guard failed')
 assert.equal(report.nativeAppLockBridgeVerified,true,'Native lock did not respond through the app bridge')
 return true
}
