## 0.2.0

* **Breaking:** require `flutter_riverpod ^3.0.0`. Riverpod 3 changed the
  `ProviderObserver` API to take a `ProviderObserverContext` instead of
  separate `ProviderBase` + `ProviderContainer` parameters; the observer is
  now an `abstract base class` requiring `extends`.
* For Riverpod 2.x, stay on `owlscope_riverpod: ^0.1.0`.

## 0.1.0

* Initial release.
* `OwlScopeRiverpodObserver` forwards Riverpod lifecycle and state changes
  (`didAddProvider`, `didUpdateProvider`, `didDisposeProvider`,
  `providerDidFail`) to the OwlScope desktop app.
