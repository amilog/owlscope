import 'package:flutter/widgets.dart';

import '../client.dart';
import '../events.dart';
import '../plugin.dart';

/// Drop into MaterialApp/CupertinoApp via `navigatorObservers`.
class OwlScopeNavigatorObserver extends NavigatorObserver {
  Map<String, dynamic> _routeInfo(Route<dynamic>? route) {
    if (route == null) return {};
    return {
      'name': route.settings.name,
      'arguments': route.settings.arguments?.toString(),
      'isFirst': route.isFirst,
      'isCurrent': route.isCurrent,
    };
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    if (!OwlScope.isConfigured) return;
    OwlScope.instance.emit(
      type: EventTypes.navigationPush,
      payload: {
        'route': _routeInfo(route),
        'previous': _routeInfo(previousRoute),
      },
    );
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);
    if (!OwlScope.isConfigured) return;
    OwlScope.instance.emit(
      type: EventTypes.navigationPop,
      payload: {
        'route': _routeInfo(route),
        'previous': _routeInfo(previousRoute),
      },
    );
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
    if (!OwlScope.isConfigured) return;
    OwlScope.instance.emit(
      type: EventTypes.navigationPush,
      payload: {
        'replace': true,
        'route': _routeInfo(newRoute),
        'previous': _routeInfo(oldRoute),
      },
    );
  }

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didRemove(route, previousRoute);
    if (!OwlScope.isConfigured) return;
    OwlScope.instance.emit(
      type: EventTypes.navigationPop,
      payload: {
        'remove': true,
        'route': _routeInfo(route),
        'previous': _routeInfo(previousRoute),
      },
    );
  }
}

class NavigationPlugin implements OwlScopePlugin {
  final OwlScopeNavigatorObserver observer;

  NavigationPlugin(this.observer);

  @override
  String get name => 'navigation';

  @override
  void install(OwlScope client) {
    // The observer is wired by the user via MaterialApp.navigatorObservers.
    client.addCapability('navigation');
  }

  @override
  void uninstall() {}
}
