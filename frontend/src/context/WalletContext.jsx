import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import { WalletContext } from "./walletContext";
import { CHAIN_ID, RPC_URL, getReadProvider } from "../services/contract";
import { formatEth } from "../services/format";

const NETWORK_PARAMS = {
  chainId: `0x${CHAIN_ID.toString(16)}`,
  chainName: CHAIN_ID === 31337 ? "Hardhat local" : `Chain ${CHAIN_ID}`,
  rpcUrls: [RPC_URL],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
};

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const hasWallet = typeof window !== "undefined" && Boolean(window.ethereum);

  const refreshBalance = useCallback(async (address) => {
    try {
      const value = await getReadProvider().getBalance(address);
      setBalance(formatEth(value));
    } catch {
      setBalance(null);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Install it to send transactions.");
      return null;
    }
    setConnecting(true);
    setError(null);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      await refreshBalance(accounts[0]);
      return accounts[0];
    } catch (err) {
      setError(err?.shortMessage || err?.message || "Could not connect the wallet");
      return null;
    } finally {
      setConnecting(false);
    }
  }, [refreshBalance]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setBalance(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    setError(null);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: NETWORK_PARAMS.chainId }],
      });
    } catch {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [NETWORK_PARAMS],
        });
      } catch (addError) {
        setError(addError?.message || "Could not switch to the Hardhat network");
      }
    }
  }, []);

  useEffect(() => {
    if (!window.ethereum) return undefined;
    let active = true;

    (async () => {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (!active || accounts.length === 0) return;
        const network = await provider.getNetwork();
        setAccount(accounts[0]);
        setChainId(Number(network.chainId));
        refreshBalance(accounts[0]);
      } catch {
        // Wallet locked or unavailable - the read-only provider still works.
      }
    })();

    const handleAccounts = (accounts) => {
      const next = accounts[0] ?? null;
      setAccount(next);
      if (next) refreshBalance(next);
      else setBalance(null);
    };
    const handleChain = () => window.location.reload();

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged", handleChain);
    return () => {
      active = false;
      window.ethereum.removeListener("accountsChanged", handleAccounts);
      window.ethereum.removeListener("chainChanged", handleChain);
    };
  }, [refreshBalance]);

  const value = useMemo(
    () => ({
      account,
      chainId,
      balance,
      connecting,
      error,
      hasWallet,
      isCorrectNetwork: chainId !== null && chainId === CHAIN_ID,
      connect,
      disconnect,
      switchNetwork,
      refreshBalance,
      clearError: () => setError(null),
    }),
    [
      account,
      chainId,
      balance,
      connecting,
      error,
      hasWallet,
      connect,
      disconnect,
      switchNetwork,
      refreshBalance,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
