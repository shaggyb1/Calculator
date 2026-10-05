# Calculator for Android

A small Android app (Android 5.0 / API 21 and newer) that shows the calculator
web app from the repository root in a full-screen WebView. The web files are
copied into the APK at build time, so the app works fully offline. The only
network use is the optional "Update rates" button in the currency converter.

## Build

Needs JDK 17 and the Android SDK (platform 35).

    cd android
    ./gradlew assembleRelease

The APK is written to `app/build/outputs/apk/release/app-release.apk`. Every
push also builds it on GitHub Actions (the "Android APK" workflow); download it
from the run's `Calculator-apk` artifact.

## Signing

Builds are signed with `sideload.keystore` (password `calculator`) so each new
APK installs over the previous one. This key is public, so it is only meant
for installing the app yourself. To sign with a private key, set
`CALC_KEYSTORE_FILE`, `CALC_KEYSTORE_PASSWORD`, `CALC_KEY_ALIAS` and
`CALC_KEY_PASSWORD` before building.

## Install on a phone

Copy the APK to the phone, open it, and allow installing from that source when
Android asks.
