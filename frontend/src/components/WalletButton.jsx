import { CHAIN_ID, NETWORK_NAME } from "../services/contract";
import { formatAddress } from "../services/format";
import { useWallet } from "../hooks/useWallet";

export default function WalletButton() {
  const {
    account,
    chainId,
    balance,
    connecting,
    isCorrectNetwork,
    hasWallet,
    connect,
    disconnect,
    switchNetwork,
  } = useWallet();

  if (!hasWallet) {
    return (
      <div className="wallet-row">
        <span className="wallet-hint">No wallet detected</span>
        <a
          className="btn btn-ghost btn-sm"
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer"
        >
          Get MetaMask
        </a>
      </div>
    );
  }

  if (!account) {
    return (
      <button
        type="button"
        className="btn btn-primary"
        onClick={connect}
        disabled={connecting}
      >
        {connecting ? "Connecting…" : "Connect MetaMask"}
      </button>
    );
  }

  return (
    <div className="wallet-row">
      {!isCorrectNetwork && (
        <button type="button" className="btn btn-warn btn-sm" onClick={switchNetwork}>
          Switch to chain {CHAIN_ID}
        </button>
      )}
      <span className="wallet-chip">
        <span className="dot" />
        <span className="wallet-address" title={account}>
          {formatAddress(account)}
        </span>
        <span className="wallet-balance">{balance ?? "—"} ETH</span>
      </span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={disconnect}>
        Disconnect
      </button>
      {chainId !== null && !isCorrectNetwork && (
        <span className="wallet-hint">
          Connected to chain {chainId}, demo expects {NETWORK_NAME} ({CHAIN_ID})
        </span>
      )}
    </div>
  );
}
