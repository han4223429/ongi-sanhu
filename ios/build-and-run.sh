#!/bin/bash
# iOS 시뮬레이터에 "온기산후" 앱을 빌드·설치·실행한다. (Xcode 필요, 개발 서버가 켜져  있어야 화면이 나온다)
# 사용법: ios/build-and-run.sh [시뮬레이터 이름 또는 UDID]   기본값: 이미 켜져 있는 기기
set -euo pipefail

cd "$(dirname "$0")"
DEVICE="${1:-booted}"
BUNDLE_ID="com.ongi.sanhu"
OUT="build/OngiApp.app"
SDK="$(xcrun --sdk iphonesimulator --show-sdk-path)"

rm -rf build && mkdir -p "$OUT"

xcrun swiftc App.swift \
  -sdk "$SDK" -target arm64-apple-ios17.0-simulator \
  -module-name OngiApp -parse-as-library -O -o "$OUT/OngiApp"

cp Info.plist "$OUT/Info.plist"
# 홈 화면 아이콘: 웹앱의 512px 아이콘에서 만든다.
sips -z 120 120 ../public/icon-512.png --out "$OUT/AppIcon60x60@2x.png" >/dev/null
sips -z 180 180 ../public/icon-512.png --out "$OUT/AppIcon60x60@3x.png" >/dev/null
codesign --force --sign - "$OUT"

xcrun simctl install "$DEVICE" "$OUT"
xcrun simctl launch "$DEVICE" "$BUNDLE_ID"
