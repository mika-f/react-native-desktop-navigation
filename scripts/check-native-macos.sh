#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
output_dir=$(mktemp -d "${TMPDIR:-/tmp}/desktop-navigation.XXXXXX")
trap 'rm -rf "$output_dir"' EXIT
xcrun swiftc -target "$(uname -m)-apple-macos14.0" \
  macos/DDNNavigationView.swift tests/native-macos/Smoke.swift \
  -o "$output_dir/native-smoke"
"$output_dir/native-smoke"
