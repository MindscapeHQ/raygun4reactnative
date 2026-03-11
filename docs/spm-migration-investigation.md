# Migrating raygun4apple from CocoaPods to Swift Package Manager

## Background

The `raygun4reactnative` iOS bridge depends on `raygun4apple` for crash reporting and RUM. Currently this dependency is managed via CocoaPods through the podspec:

```ruby
s.dependency "raygun4apple", '~> 2.1.3'
```

This investigation evaluates migrating that dependency to Swift Package Manager (SPM).

## CocoaPods Deprecation Timeline

CocoaPods trunk goes **permanently read-only on December 2, 2026**. After that date, existing pods will still resolve but no new versions can be published — meaning new raygun4apple releases could not be distributed via CocoaPods.

Google is also dropping CocoaPods support for their iOS SDKs after Q2 2026, accelerating ecosystem-wide migration. React Native has committed to providing a clear migration path for library authors before CocoaPods is deprecated, but has not yet delivered it.

## Current Architecture

- `sdk/raygun4reactnative.podspec` declares `raygun4apple` as a CocoaPods dependency
- `sdk/ios/RaygunNativeBridge.m` imports the CocoaPods-specific umbrella header `<raygun4apple/raygun4apple_iOS.h>`
- React Native autolinking resolves the pod via `use_native_modules!` in consuming app Podfiles
- The resolved version is 2.1.4 (from the `~> 2.1.3` constraint)

## Key Findings

### React Native's `spm_dependency` helper (RN 0.75+)

React Native provides a `spm_dependency` function for podspecs that bridges CocoaPods and SPM. The implementation lives in `react-native/scripts/cocoapods/spm.rb`.

**What it does:**
- Adds an `XCRemoteSwiftPackageReference` to the Pods project
- Links the SPM product to the pod's target within `Pods.xcodeproj`

**What it does NOT do:**
- Embed the framework in the main app bundle
- Add a "Copy Frameworks" or "Embed Frameworks" build phase
- Modify the main app target

This means SPM dependencies added via `spm_dependency` may work on simulators but **crash on physical devices** with `dyld: Library not loaded` because the dynamic framework isn't copied into the `.app` bundle.

### `use_frameworks! :linkage => :dynamic` is mandatory

The RN source code (`spm.rb`, lines 44-51) explicitly warns that static linking causes linker errors due to a known Xcode issue with the `-ObjC` flag. The original PR (#44627) confirmed `spm_dependency` only works with `USE_FRAMEWORKS=dynamic`.

Enabling dynamic frameworks is a project-wide change that can break other React Native libraries that don't support dynamic linking.

### CocoaPods umbrella header doesn't exist in SPM

The import `<raygun4apple/raygun4apple_iOS.h>` is a CocoaPods-generated umbrella header. The SPM package exposes individual headers in `Sources/public/`. Any migration requires updating imports to reference individual headers:

```objc
#import <raygun4apple/RaygunClient.h>
#import <raygun4apple/RaygunUserInformation.h>
#import <raygun4apple/RaygunBreadcrumb.h>
#import <raygun4apple/RaygunCrashReportConverter.h>
```

## Solutions

### Option 1: Update CocoaPods version constraint (no migration)

Update the existing CocoaPods dependency to pull the latest version.

**Changes:**
- `sdk/raygun4reactnative.podspec`: change `'~> 2.1.3'` to the desired version
- Consuming apps: `pod update raygun4apple`

**Pros:** Zero breaking changes, no risk, works today.
**Cons:** Doesn't move toward SPM. Not viable for new raygun4apple releases after December 2, 2026.

**Consumer impact:** None.

### Option 2: `spm_dependency` in podspec

Use React Native's built-in SPM helper to declare the dependency.

**Changes to the library:**
- `sdk/raygun4reactnative.podspec`: replace `s.dependency "raygun4apple"` with `spm_dependency(s, ...)`
- `sdk/ios/RaygunNativeBridge.m`: replace umbrella header import with individual headers

**Changes required by consuming apps:**
- Add `use_frameworks! :linkage => :dynamic` to their Podfile
- Potentially add raygun4apple as an SPM package to the main app target in Xcode to ensure framework embedding on physical devices
- Expo apps need a config plugin to modify `pbxproj` (since `ios/` is regenerated on each prebuild)

**Pros:** Uses RN's official mechanism, minimal library-side changes.
**Cons:** `use_frameworks! :dynamic` is a breaking project-wide change that can affect other pods. Physical device embedding is not guaranteed without manual steps. The RN SPM ecosystem is still maturing.

**Consumer impact:** Breaking. Requires Podfile changes and possibly Xcode project changes.

### Option 3: `spm_dependency` with backwards compatibility guard

Same as Option 2 but with a fallback for older React Native versions.

**Podspec change:**
```ruby
if defined?(spm_dependency)
  spm_dependency(s,
    url: 'https://github.com/MindscapeHQ/raygun4apple.git',
    requirement: {kind: 'upToNextMajorVersion', minimumVersion: '2.1.3'},
    products: ['raygun4apple']
  )
else
  s.dependency "raygun4apple", '~> 2.1.3'
end
```

**Pros:** Supports both RN < 0.75 (CocoaPods) and RN >= 0.75 (SPM).
**Cons:** Same physical device embedding concerns as Option 2 for SPM consumers. Two code paths to maintain.

**Consumer impact:** Breaking for RN >= 0.75 consumers (same as Option 2). Transparent for older RN versions.

### Option 4: `spm_dependency` + Expo config plugin

Option 2 or 3, plus an Expo config plugin that ensures the SPM framework is embedded in the main app target.

The plugin modifies `pbxproj` to add:
1. `XCRemoteSwiftPackageReference` (register the package)
2. `XCSwiftPackageProductDependency` (link product to app target)
3. `PBXProject.packageReferences` entry
4. `PBXBuildFile` entry
5. `PBXFrameworksBuildPhase` entry

**Pros:** Fully solves the physical device embedding problem for Expo apps.
**Cons:** Additional plugin code to build and maintain. Bare RN apps still need manual Xcode configuration.

**Consumer impact:** Expo apps add the plugin to `app.json`. Bare RN apps still need manual steps.

## Recommendation

**Short term: Option 1.** Update the CocoaPods version constraint. This is safe, immediate, and has zero consumer impact.

**Medium term: Option 3.** Add `spm_dependency` with the backwards compatibility guard once the RN SPM ecosystem matures and `use_frameworks! :dynamic` becomes less disruptive. This should be validated on physical devices before release.

**For Expo support: Option 4.** If Expo consumers are a priority, build the config plugin alongside Option 3. The Crossroads article provides a working reference implementation.

The core limitation is that React Native's `spm_dependency` does not handle framework embedding in the app target. Until this is resolved upstream, any SPM migration requires consumers to take additional manual steps or use an Expo plugin.

**Deadline: December 2, 2026.** The migration must be complete before this date to continue receiving raygun4apple updates. The 9-month runway is likely sufficient, but depends on React Native shipping a proper migration path. Revisit this investigation in Q3 2026.

## References

- [Integrating Swift Package Manager with React Native Libraries (Callstack)](https://www.callstack.com/blog/integrating-swift-package-manager-with-react-native-libraries)
- [Expo Plugin: Add SPM Dependency (React Native Crossroads)](https://www.reactnativecrossroads.com/posts/expo-plugin-add-spm-dependency/)
- [React Native `spm.rb` source](https://github.com/facebook/react-native/blob/main/packages/react-native/scripts/cocoapods/spm.rb)
- [React Native PR #44627 — Original `spm_dependency` implementation](https://github.com/facebook/react-native/pull/44627)
- [React Native Community Discussion — SPM Support Proposal #587](https://github.com/react-native-community/discussions-and-proposals/issues/587)
- [React Native Issue #46503 — SPM does not work with RN 0.75.2](https://github.com/facebook/react-native/issues/46503)
- [CocoaPods Trunk Read-only Plan (Official)](https://blog.cocoapods.org/CocoaPods-Specs-Repo/)
- [react-native-maps SPM Migration Issue #5700](https://github.com/react-native-maps/react-native-maps/issues/5700)
