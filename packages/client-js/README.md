# owlscope

> Universal debug & monitoring tool for **React Native** apps.
> The mobile-first alternative to Reactotron.

```sh
npm install owlscope@rn
npx owlscope setup
```

```ts
// index.js — top of the file
import { startOwlScope } from 'owlscope/rn';
if (__DEV__) startOwlScope();

// rest of your bootstrap below…
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
AppRegistry.registerComponent(appName, () => App);
```

That's the whole setup. Open the OwlScope desktop app, run your RN app —
your client appears in the sidebar.

## What `npx owlscope setup` does

One idempotent command that handles every scenario:

| Scenario             | What happens |
|----------------------|--------------|
| iOS Simulator        | nothing needed — `localhost` works out of the box |
| iOS Device (LAN)     | patches `Info.plist` with `NSLocalNetworkUsageDescription` and `NSAllowsLocalNetworking`; iOS will prompt the user once |
| Android Emulator     | nothing needed — `10.0.2.2` is auto-detected |
| Android Device (USB) | runs `adb reverse tcp:9090 tcp:9090` so `localhost` works |

Re-run any time you plug in a new device or unbox a fresh checkout.
The script skips work that's already done — safe to add to a postinstall
hook.

## What gets captured

| Plugin    | What |
|-----------|------|
| `console` | Every `console.log` / `info` / `warn` / `error` / `debug` |
| `network-fetch` | Every `fetch()` call with full request + response body |
| `network-xhr`   | Every `XMLHttpRequest` (Axios uses XHR under the hood) |
| `errors`        | `ErrorUtils.setGlobalHandler` + unhandled rejections |

Production builds (`NODE_ENV=production`) are no-op'd automatically.

## Host detection

`startOwlScope()` figures out the right host on its own:

| Target               | Host used               |
|----------------------|--------------------------|
| iOS simulator        | `localhost`              |
| Android emulator     | `10.0.2.2`               |
| Physical device      | Metro bundler IP (auto)  |

Override only if you need to point at a different machine:

```ts
startOwlScope({ name: 'my-app', host: '192.168.1.50', port: 9090 });
```

## Manual configuration

If you'd rather wire it up by hand:

```ts
import { configure } from 'owlscope';

configure({
  name: 'my-app',
  host: '10.0.2.2',
  port: 9090,
  plugins: {
    console: true,
    network: false,
    errors: true,
  },
  redact: ['password', 'token', 'authorization'],
});
```

## License

MIT
