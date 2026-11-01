#!/usr/bin/env python3
"""Build a local macOS wrapper; machine-specific paths stay in ignored output/."""

import argparse
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys


def main():
    if sys.platform != "darwin":
        raise SystemExit("The native launcher requires macOS and Xcode Command Line Tools.")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install-path", type=Path, help="Optional destination for the .app")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    bundle_id = "io.github.biryukovlex.lotus-light-studio"
    app = root / "output" / "launchers" / "Lotus Light Studio.app"
    contents = app / "Contents"
    executable = contents / "MacOS" / "LotusLightStudio"
    resources = contents / "Resources"
    cache = root / ".local" / "swift-module-cache"
    for path in (executable.parent, resources, cache):
        path.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "/usr/bin/xcrun", "swiftc", "-O", "-module-cache-path", str(cache),
        "-framework", "Cocoa", "-framework", "WebKit",
        str(root / "scripts" / "macos_launcher.swift"), "-o", str(executable),
    ], check=True)
    icons = root / "output" / "launchers" / "LotusLightStudio.iconset"
    subprocess.run([str(executable), "--write-icons", str(icons)], check=True)
    subprocess.run(["/usr/bin/iconutil", "-c", "icns", str(icons), "-o",
                    str(resources / "AppIcon.icns")], check=True)
    info = {
        "CFBundleName": "Lotus Light Studio",
        "CFBundleDisplayName": "Lotus Light Studio",
        "CFBundleIdentifier": bundle_id,
        "CFBundleExecutable": executable.name,
        "CFBundlePackageType": "APPL",
        "CFBundleShortVersionString": "1.0",
        "CFBundleVersion": "1",
        "CFBundleIconFile": "AppIcon",
        "LSMinimumSystemVersion": "12.0",
        "LSMultipleInstancesProhibited": True,
        "NSHighResolutionCapable": True,
        "NSBluetoothAlwaysUsageDescription": "Connect to your Bluetooth lamp so you can control its lighting.",
        "NSBluetoothPeripheralUsageDescription": "Connect to your Bluetooth lamp so you can control its lighting.",
        "NSAppTransportSecurity": {"NSAllowsLocalNetworking": True},
        "LotusSourceRoot": str(root),
    }
    (contents / "Info.plist").write_bytes(plistlib.dumps(info))
    subprocess.run(["/usr/bin/codesign", "--force", "--sign", "-", str(app)], check=True)
    if args.install_path:
        target = args.install_path.expanduser().absolute()
        if target.suffix != ".app":
            raise SystemExit("Choose a destination ending in .app.")
        if target == app:
            raise SystemExit("The output app is already at that location.")
        if target.exists():
            existing = target / "Contents" / "Info.plist"
            if not existing.is_file() or plistlib.loads(existing.read_bytes()).get("CFBundleIdentifier") != bundle_id:
                raise SystemExit("Destination contains a different app; it was left untouched.")
            shutil.rmtree(target)
        shutil.copytree(app, target)
        print("Installed:", target)
    print("Built:", app)


if __name__ == "__main__":
    main()
