#!/usr/bin/env bash
set -euo pipefail

app="$RUNNER_TEMP/tiq-listing/Build/Products/Debug-iphonesimulator/App.app"
output="$RUNNER_TEMP/tiq-listing-screens"
bundle_id=com.tenaceiq.prototype
mkdir -p "$output"
device=$(xcrun simctl list devices available --json | python3 -c '
import json, sys
runtimes = json.load(sys.stdin)["devices"]
phones = [d for runtime in sorted(runtimes, reverse=True) for d in runtimes[runtime]
          if d["name"] in ("iPhone 17 Pro Max", "iPhone 16 Pro Max")]
assert phones, "A 6.9-inch iPhone simulator is required"
print(phones[0]["udid"])
')
xcrun simctl boot "$device"
trap 'xcrun simctl shutdown "$device" || true' EXIT
xcrun simctl bootstatus "$device" -b
xcrun simctl status_bar "$device" override --time '9:41' --dataNetwork wifi --wifiMode active \
  --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState discharging --batteryLevel 100
xcrun simctl install "$device" "$app"
container=$(xcrun simctl get_app_container "$device" "$bundle_id" data)
ready="$container/Documents/tiq-store-screenshot-ready"

capture() {
  local screen=$1 file=$2 actual
  rm -f "$ready"
  SIMCTL_CHILD_TIQ_STORE_SCREEN="$screen" xcrun simctl launch --terminate-running-process "$device" "$bundle_id"
  for attempt in $(seq 1 85); do
    test -f "$ready" && break
    sleep 1
  done
  if ! test -f "$ready" || ! test "$(cat "$ready")" = "$screen"; then
    cat "$ready.failed" 2>/dev/null || true
    echo "::warning::Review the native $screen image before using it"
  fi
  xcrun simctl io "$device" screenshot --type=jpeg "$file"
  actual=$(sips -g pixelWidth -g pixelHeight "$file")
  grep -q 'pixelWidth: 1320$' <<<"$actual"
  grep -q 'pixelHeight: 2868$' <<<"$actual"
}

capture coach-training "$output/05-coach-training.jpg"
