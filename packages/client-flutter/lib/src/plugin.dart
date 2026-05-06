import 'client.dart';

abstract class OwlScopePlugin {
  String get name;
  void install(OwlScope client);
  void uninstall() {}
}
