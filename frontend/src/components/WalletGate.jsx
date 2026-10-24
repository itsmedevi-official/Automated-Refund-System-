import { CHAIN_ID } from "../services/contract";
import { useWallet } from "../hooks/useWallet";
import WalletButton from "./WalletButton";

/** Renders its children only when a wallet is connected to the expected chain. */
export default function WalletGate({ children, message }) {
  const { account, isCorrectNetwork } = useWallet();

  if (!account) {
    return (
      <section className="panel center">
        <h2>Wallet required</h2>
        <p className="muted">
          {message ||
            "Connect MetaMask to sign transactions. Read-only pages such as the explorer work without a wallet."}
        </p>
        <WalletButton />
      </section>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <section className="panel center">
        <h2>Wrong network</h2>
        <p className="muted">
          This demo runs on chain {CHAIN_ID}. Switch networks in MetaMask to continue.
        </p>
        <WalletButton />
      </section>
    );
  }

  return children;
}
