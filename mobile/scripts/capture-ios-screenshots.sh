#!/usr/bin/env bash
set -euo pipefail

phone=$1
simulator_app=$2
fixture_bundle=$3
output=$4
bundle_id=com.tenaceiq.prototype

# Keep the packaged simulator build and signed store build free of sample data.
app="$RUNNER_TEMP/tiq-screenshot-app/App.app"
mkdir -p "$(dirname "$app")" "$output/iphone" "$output/ipad" "$output/subscription-review"
ditto "$simulator_app" "$app"
cp "$fixture_bundle/app.js" "$app/public/store-screenshot.js"
cp "$fixture_bundle/app.css" "$app/public/store-screenshot.css"
sed -i '' -e 's#\./app\.js#./store-screenshot.js#g' -e 's#\./app\.css#./store-screenshot.css#g' "$app/public/index.html"
grep -q 'src="./store-screenshot.js"' "$app/public/index.html"

capture() {
  local device=$1 screen=$2 file=$3 expected_width=$4 expected_height=$5
  local container marker actual
  container=$(xcrun simctl get_app_container "$device" "$bundle_id" data)
  marker="$container/Documents/tiq-store-screenshot-ready"
  rm -f "$marker"
  SIMCTL_CHILD_TIQ_STORE_SCREEN="$screen" xcrun simctl launch --terminate-running-process \
    "$device" "$bundle_id" --tiq-store-screenshot
  for attempt in $(seq 1 30); do
    test -f "$marker" && break
    sleep 1
  done
  test -f "$marker" || { echo "Timed out waiting for $screen to render"; return 1; }
  test "$(cat "$marker")" = "$screen" || { echo "$screen failed to render: $(cat "$marker")"; return 1; }
  xcrun simctl io "$device" screenshot --type=jpeg "$file"
  actual=$(sips -g pixelWidth -g pixelHeight "$file")
  echo "$actual"
  grep -q "pixelWidth: $expected_width$" <<<"$actual"
  grep -q "pixelHeight: $expected_height$" <<<"$actual"
}

capture_listing() {
  local device=$1 folder=$2 width=$3 height=$4
  xcrun simctl status_bar "$device" override --time '9:41' --dataNetwork wifi \
    --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 \
    --batteryState discharging --batteryLevel 100
  if xcrun simctl get_app_container "$device" "$bundle_id" app >/dev/null 2>&1; then
    xcrun simctl uninstall "$device" "$bundle_id"
  fi
  xcrun simctl install "$device" "$app"
  local installed
  installed=$(xcrun simctl get_app_container "$device" "$bundle_id" app)
  cmp "$app/public/store-screenshot.js" "$installed/public/store-screenshot.js"
  capture "$device" lab "$folder/01-my-lab.jpg" "$width" "$height"
  capture "$device" explore "$folder/02-explore.jpg" "$width" "$height"
  capture "$device" compete "$folder/03-compete.jpg" "$width" "$height"
}

capture_listing "$phone" "$output/iphone" 1320 2868
capture "$phone" player "$output/subscription-review/player.jpg" 1320 2868
capture "$phone" captain "$output/subscription-review/captain.jpg" 1320 2868
xcrun simctl shutdown "$phone"

tablet=$(xcrun simctl list devices available --json | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
tablets = [d for runtime in sorted(devices, reverse=True) for d in devices[runtime]
           if "iPad Pro" in d["name"] and "13-inch" in d["name"]]
assert tablets, "No 13-inch iPad Pro simulator available"
print(tablets[0]["udid"])
')
xcrun simctl boot "$tablet"
xcrun simctl bootstatus "$tablet" -b
capture_listing "$tablet" "$output/ipad" 2064 2752
xcrun simctl shutdown "$tablet"
