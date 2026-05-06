## 0.1.1

* Loosen `web_socket_channel` constraint to `>=2.4.5 <4.0.0` so apps that depend
  on `web ^1.x` (e.g. `device_info_plus 12.x`) can resolve.

## 0.1.0

* Initial release.
* `owlscopeAuto(() => runApp(...))` zero-config entry — installs all default plugins.
* `OwlScope.configure(...)` for fine-grained control.
* Plugins:
  * `print` / `debugPrint` interception via `Zone`.
  * `HttpPlugin` — captures all `dart:io HttpClient` traffic (`http`, `dio`, custom).
  * `ErrorPlugin` — `FlutterError.onError` + `PlatformDispatcher.onError` + uncaught zone errors.
  * `NavigationPlugin` — `OwlScopeNavigatorObserver` for route push/pop.
  * `PerformancePlugin` — frame timings (avgBuild, avgRaster, slowFrames per second).
* Manual emit API: `log`, `info`, `warn`, `debug`, `error`, `event`.
* `dart run owlscope:setup` / `:teardown` — idempotent platform config patcher
  (macOS network entitlement, iOS ATS local exception, Android cleartext debug).
* `kReleaseMode` no-op — zero overhead in release builds.
* Sensitive data redaction (default keys: `password`, `authorization`, `token`,
  `cookie`, `set-cookie`, `x-api-key`, `secret`).
