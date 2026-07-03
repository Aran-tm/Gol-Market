// Whether an in-page wallet connect will actually work here.
//
// A plain mobile browser has no injected provider, yet Phantom still registers a
// Wallet-Standard adapter that reports readyState === Installed — its connect()
// only works via a deeplink round-trip that routinely times out. So we do NOT
// trust readyState on mobile. The reliable signal is whether a provider is truly
// injected on `window`, which only happens in a desktop extension or Phantom's
// own in-app browser. Read at call time, not module load: Phantom injects at
// document_start, but this keeps us safe from any import-order race.
export const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const inWalletBrowser = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  !!(window as any).solana?.isPhantom || !!(window as any).phantom?.solana;

/** True when we must deeplink into Phantom instead of connecting in-page. */
export const needsPhantomDeepLink = () => IS_MOBILE && !inWalletBrowser();

/** Reopens the current page inside Phantom's in-app browser, where connect works. */
export const phantomDeepLink = () =>
  `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=${encodeURIComponent(window.location.origin)}`;
