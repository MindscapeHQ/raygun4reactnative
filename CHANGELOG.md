## 1.5.4-alpha.1

**IMPORTANT** This alpha release disables `XHRInterceptor` in order to fix support for React-Native 0.79+. Real User Monitoring (RUM) will be affected by this change.

A bug in React-Native/Metro https://github.com/facebook/metro/issues/1516 related to conditional `import`/`require` is currently blocking release support for `XHRInterceptor` for this package.

This alpha build bypasses the error by disabling access to `XHRInterceptor` as a temporal solution.

- fix: Support for React-Native 0.79+
- perf: disabled XHRInterceptor in RUM

## 1.5.3

- fix: map RUM requests using a unique id (#149) (2025-04-02)
- docs: add Releasing and Contributing (#139) (2025-04-02)
- chore(deps-dev): bump @babel/core from 7.26.9 to 7.26.10 in /demo (#144) (2025-04-02)
- chore(deps): bump @babel/helpers from 7.26.0 to 7.27.0 in /ExpoDemo (#148) (2025-04-01)
- chore(deps): bump @babel/runtime from 7.26.0 to 7.27.0 in /ExpoDemo (#147) (2025-04-01)
- chore(deps): bump @babel/helpers from 7.26.9 to 7.27.0 in /demo (#146) (2025-04-01)
- chore(deps-dev): bump @babel/runtime from 7.26.9 to 7.27.0 in /demo (#145) (2025-04-01)
- chore(deps-dev): bump react-test-renderer from 19.0.0 to 19.1.0 in /demo (#143) (2025-04-01)
- chore(deps-dev): bump @react-native/typescript-config in /demo (#142) (2025-04-01)
- chore(deps-dev): bump @react-native/eslint-config in /demo (#141) (2025-04-01)
- chore(deps): bump react-native-screens from 4.9.1 to 4.10.0 in /demo (#140) (2025-04-01)
- chore(deps-dev): bump React version and related dependencies in /demo (#136) (2025-03-04)
- chore(deps-dev): bump @react-native/typescript-config in /demo (#134) (2025-03-04)
- chore(deps-dev): bump @babel/runtime from 7.26.0 to 7.26.9 in /demo (#135) (2025-03-03)
- chore(deps-dev): bump @react-native/metro-config in /demo (#137) (2025-03-03)
- chore(deps-dev): bump prettier from 3.4.1 to 3.5.2 in /demo (#138) (2025-03-03)
- chore(deps-dev): bump @react-native/babel-preset from 0.76.3 to 0.77.0 in /demo (#132) (2025-02-03)
- chore(deps-dev): bump @react-native/typescript-config from 0.76.1 to 0.77.0 in /demo (#133) (2025-02-03)
- chore(deps): bump @react-navigation/bottom-tabs from 7.1.3 to 7.2.0 in /demo (#131) (2025-02-03)
- chore(deps-dev): bump @react-native-community/cli-platform-ios from 15.1.2 to 15.1.3 in /demo (#130) (2025-02-03)
- chore(deps-dev): bump @babel/core from 7.26.0 to 7.26.7 in /demo (#129) (2025-02-03)
- chore(deps): bump undici from 6.21.0 to 6.21.1 in /ExpoDemo (#128) (2025-01-24)

## 1.5.2

- fix: #125 move README to sdk folder (#126) (2025-01-07)

## 1.5.1

*No changes*

## 1.5.0

- feat: Add GroupingKey callback (#115) (2024-12-11)
- fix: Update dependencies and setup GitHub Actions CI (#92) (2024-11-08)
- fix: Demo project cleanup (#87) (2024-11-07)
- perf: Enable eslint on sdk (#107) (2024-11-26)
- docs: Update README.md (#117) (2024-12-11)
- docs: Expo support (#116) (2024-12-11)
- docs: Add Sourcemap generation documentation reference (#114) (2024-12-11)
- docs: add issue and PR templates (#108) (2024-11-27)
- test: Adds SDK unit tests and CI task (#105) (2024-11-21)
- docs: Adds manual linking steps (#44) (2024-11-20)
- docs: Update README.md native crash reporting section (#104) (2024-11-15)
- chore(deps): bump @react-navigation/native from 6.1.18 to 7.0.9 in /demo (#110) (2024-12-03)
- chore(deps-dev): bump @react-native-community/cli from 15.1.1 to 15.1.2 in /demo (#112) (2024-12-03)
- chore(deps-dev): bump prettier from 3.3.3 to 3.4.1 in /demo (#113) (2024-12-03)
- chore(deps): bump react-native-screens from 4.0.0 to 4.3.0 in /demo (#111) (2024-12-02)
- chore(deps-dev): bump @react-native/babel-preset from 0.76.1 to 0.76.3 in /demo (#109) (2024-12-02)
- chore(deps): bump cross-spawn from 7.0.3 to 7.0.6 in /demo (#106) (2024-11-26)
- chore(deps-dev): bump @react-native-community/cli-platform-android (#102) (2024-11-11)
- chore(deps-dev): bump @react-native-community/cli-platform-ios in /demo (#101) (2024-11-10)
- chore(deps-dev): bump prettier from 2.8.8 to 3.3.3 in /demo (#100) (2024-11-10)
- chore(deps-dev): bump @react-native-community/cli-platform-ios in /demo (#98) (2024-11-10)
- chore(deps-dev): bump @react-native-community/cli in /demo (#97) (2024-11-10)
- chore(deps): bump react-native-screens from 3.35.0 to 4.0.0 in /demo (#96) (2024-11-10)
- chore(deps): bump gradle/wrapper-validation-action from 1 to 3 (#95) (2024-11-10)
- chore(deps): bump actions/setup-node from 3 to 4 (#94) (2024-11-10)
- chore(deps): bump actions/setup-java from 3 to 4 (#93) (2024-11-10)

