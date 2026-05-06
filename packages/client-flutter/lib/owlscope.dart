/// Public API for the OwlScope Flutter client SDK.
library owlscope;

export 'src/client.dart' show OwlScope, PluginConfig;
export 'src/events.dart' show DebugEvent, EventTypes, LogLevels, HandshakePayload;
export 'src/plugin.dart' show OwlScopePlugin;
export 'src/redact.dart' show defaultRedactKeys, redact;
export 'src/runner.dart' show OwlScopeRunner;

export 'src/plugins/error_plugin.dart' show ErrorPlugin;
export 'src/plugins/http_plugin.dart' show HttpPlugin;
export 'src/plugins/navigation_plugin.dart'
    show NavigationPlugin, OwlScopeNavigatorObserver;
export 'src/plugins/performance_plugin.dart' show PerformancePlugin;
