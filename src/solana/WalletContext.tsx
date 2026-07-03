import { type FC, type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { WalletError } from "@solana/wallet-adapter-base";
import { NETWORKS, type Network } from "../lib/txlineConfig";
import { IS_MOBILE } from "./mobile";
import "@solana/wallet-adapter-react-ui/styles.css";

// The network we run against. User funded their Phantom on mainnet.
export const ACTIVE_NETWORK: Network = "mainnet";

// Wallet adapter errors (rejected connection, wallet not installed, etc.) only
// go to console.error by default — nothing shows up in the UI. This surfaces
// them so a failed connect isn't indistinguishable from a stuck one.
const WalletErrorContext = createContext<{ message: string | null; clear: () => void }>({
  message: null,
  clear: () => {},
});
export const useWalletError = () => useContext(WalletErrorContext);

function friendlyError(error: WalletError): string {
  if (error.name === "WalletNotReadyError") return "Phantom isn't installed or enabled in this browser.";
  if (error.name === "WalletConnectionError")
    // Include the raw detail: on mobile there's no console, this is the only clue.
    return `Connection was rejected or timed out — try again.${error.message ? ` (${error.message})` : ""}`;
  return error.message || "Wallet connection failed.";
}

export const SolanaProviders: FC<{ children: ReactNode }> = ({ children }) => {
  const endpoint = useMemo(
    () => import.meta.env.VITE_SOLANA_RPC || NETWORKS[ACTIVE_NETWORK].cluster,
    [],
  );
  // Empty array: Phantom & other Wallet-Standard wallets are auto-detected.
  const wallets = useMemo(() => [], []);
  const [message, setMessage] = useState<string | null>(null);
  const clear = useCallback(() => setMessage(null), []);
  const onError = useCallback((error: WalletError) => {
    console.error(error);
    // A failed connect leaves walletName in localStorage; autoConnect would then
    // retry it on every load and its pending request blocks the manual tap too.
    if (error.name === "WalletConnectionError") localStorage.removeItem("walletName");
    setMessage(friendlyError(error));
  }, []);

  return (
    <WalletErrorContext.Provider value={{ message, clear }}>
      <ConnectionProvider endpoint={endpoint}>
        {/* autoConnect off on mobile: Phantom's in-app browser mishandles the silent
            reconnect (hangs → WalletConnectionError) and the pending request also
            rejects the user's manual connect. One extra tap on mobile is the fix. */}
        <WalletProvider wallets={wallets} autoConnect={!IS_MOBILE} onError={onError}>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </WalletErrorContext.Provider>
  );
};
