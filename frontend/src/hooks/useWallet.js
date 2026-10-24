import { useContext } from "react";
import { WalletContext } from "../context/walletContext";

/** Access the injected wallet: account, chainId, balance, connect/switch helpers. */
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside <WalletProvider>");
  }
  return context;
}
