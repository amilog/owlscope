// Minimal ambient declaration for the bits of React Native we touch in
// `rn.ts`. `react-native` is a peer dep and shipping the full @types is
// heavyweight for an SDK of this size — at runtime Metro resolves the
// real module, and these types only need to satisfy `tsc --noEmit` of
// our own source.
declare module 'react-native' {
  export const Platform: { OS: 'ios' | 'android' | 'windows' | 'macos' | 'web' | string };
  export const NativeModules: Record<string, unknown> & {
    SourceCode?: { scriptURL?: string };
  };
}
