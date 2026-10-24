import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseEther } from "ethers";
import LocationCapture from "../components/LocationCapture";
import Notice from "../components/Notice";
import TxStatus from "../components/TxStatus";
import WalletGate from "../components/WalletGate";
import { useTransaction } from "../hooks/useEscrow";
import { useWallet } from "../hooks/useWallet";
import { getSignerContract } from "../services/contract";
import { degreesToMicro } from "../services/geo";

function CreateDealForm() {
  const navigate = useNavigate();
  const { account, refreshBalance } = useWallet();
  const { run, pending, error, success, reset } = useTransaction();
  const [seller, setSeller] = useState("");
  const [agent, setAgent] = useState("");
  const [amount, setAmount] = useState("0.5");
  const [location, setLocation] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    const result = await run(async () => {
      const contract = await getSignerContract();
      const tx = await contract.createDeal(seller.trim(), agent.trim(), {
        value: parseEther(amount),
      });
      const receipt = await tx.wait();

      let dealId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === "DealCreated") {
            dealId = Number(parsed.args.dealId);
            break;
          }
        } catch {
          // Log emitted by another contract - ignore.
        }
      }

      if (dealId && location) {
        const locationTx = await contract.setBuyerLocation(
          dealId,
          degreesToMicro(location.lat),
          degreesToMicro(location.lon)
        );
        await locationTx.wait();
      }
      return { dealId };
    }, "Deal created and funded");

    if (result?.dealId) {
      await refreshBalance(account);
      navigate(`/deals/${result.dealId}`);
    }
  };

  return (
    <form className="panel form" onSubmit={submit}>
      <label className="field">
        <span>Seller address</span>
        <input
          type="text"
          required
          placeholder="0x…"
          value={seller}
          onChange={(event) => setSeller(event.target.value)}
        />
        <small className="muted">Receives the funds once the delivery is accepted.</small>
      </label>

      <label className="field">
        <span>Delivery agent address</span>
        <input
          type="text"
          required
          placeholder="0x…"
          value={agent}
          onChange={(event) => setAgent(event.target.value)}
        />
        <small className="muted">
          Generates and verifies the OTP at the drop-off point.
        </small>
      </label>

      <label className="field">
        <span>Amount (ETH)</span>
        <input
          type="number"
          min="0.000001"
          step="0.000001"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <small className="muted">Locked in the contract until the deal settles.</small>
      </label>

      <div className="field">
        <span>Your delivery location (optional but recommended)</span>
        <LocationCapture
          value={location}
          onChange={setLocation}
          label="Capture my delivery location"
        />
        <small className="muted">
          Stored on-chain and used by the automatic dispute resolution. You can also set it
          later from the deal page.
        </small>
      </div>

      <TxStatus
        pending={pending}
        pendingLabel="Creating the deal and locking the funds…"
        error={error}
        success={success}
        onDismiss={reset}
      />

      <Notice tone="info">
        The buyer, seller and delivery agent must be three different accounts. No platform fee
        is charged.
      </Notice>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Submitting…" : `Lock ${amount || "0"} ETH in escrow`}
      </button>
    </form>
  );
}

export default function CreateDeal() {
  return (
    <WalletGate message="Connect the buyer wallet to create and fund an escrow deal.">
      <div className="page narrow">
        <header className="page-head">
          <div>
            <h1>New escrow deal</h1>
            <p className="muted">
              The whole amount is locked by the contract; the seller can only be paid after
              delivery is verified.
            </p>
          </div>
        </header>
        <CreateDealForm />
      </div>
    </WalletGate>
  );
}
