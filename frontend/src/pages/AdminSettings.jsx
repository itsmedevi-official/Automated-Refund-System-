import { useState } from "react";
import Notice from "../components/Notice";
import Stats from "../components/Stats";
import TxStatus from "../components/TxStatus";
import WalletGate from "../components/WalletGate";
import { useEscrowConfig, useTransaction } from "../hooks/useEscrow";
import { useWallet } from "../hooks/useWallet";
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  DEPLOYED_AT,
  NETWORK_NAME,
  RPC_URL,
  getSignerContract,
} from "../services/contract";
import { formatAddress, formatDateTime } from "../services/format";

function SettingsContent() {
  const { config, loading, error, reload } = useEscrowConfig();
  const { account } = useWallet();
  const { run, pending, error: txError, success, reset } = useTransaction();
  const [threshold, setThreshold] = useState("");
  const [disputeWindow, setDisputeWindow] = useState("");
  const [agent, setAgent] = useState("");

  const isOwner =
    Boolean(config && account) && config.owner.toLowerCase() === account.toLowerCase();

  const exec = async (action, message) => {
    const receipt = await run(async () => {
      const contract = await getSignerContract();
      const tx = await action(contract);
      return tx.wait();
    }, message);
    if (receipt) reload();
  };

  const saveThreshold = (event) => {
    event.preventDefault();
    exec(
      (contract) => contract.setDistanceThreshold(Number(threshold)),
      "Distance threshold updated"
    );
  };

  const saveWindow = (event) => {
    event.preventDefault();
    exec((contract) => contract.setDisputeWindow(Number(disputeWindow)), "Dispute window updated");
  };

  const saveAgent = (event) => {
    event.preventDefault();
    exec((contract) => contract.setEscrowAgent(agent.trim()), "Escrow agent updated");
  };

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Contract settings</h1>
          <p className="muted">
            Parameters are stored on-chain and enforced by the contract. Only the owner can change
            them.
          </p>
        </div>
      </header>

      {error && <Notice tone="error">{error}</Notice>}
      {loading && <p className="muted">Loading configuration…</p>}

      {config && (
        <>
          {!isOwner && (
            <Notice tone="info">
              You are connected as {formatAddress(account)}. The owner is{" "}
              {formatAddress(config.owner)} - the forms below are read-only for you.
            </Notice>
          )}

          <Stats
            items={[
              { label: "Distance threshold", value: `${config.distanceThreshold} m` },
              { label: "Dispute window", value: `${config.disputeWindow} s` },
              { label: "Deals created", value: config.totalDeals },
              { label: "Escrow agent", value: formatAddress(config.escrowAgent) },
            ]}
          />

          <TxStatus pending={pending} error={txError} success={success} onDismiss={reset} />

          <form className="panel form" onSubmit={saveThreshold}>
            <h2>Distance threshold</h2>
            <p className="muted">
              Maximum distance between the buyer and the delivery agent for a delivery to count as
              verified. Default 200 m.
            </p>
            <div className="row wrap">
              <input
                type="number"
                min="1"
                placeholder={`${config.distanceThreshold}`}
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                disabled={!isOwner}
              />
              <span className="muted">metres</span>
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                disabled={!isOwner || pending || !threshold}
              >
                Save threshold
              </button>
            </div>
          </form>

          <form className="panel form" onSubmit={saveWindow}>
            <h2>Dispute window</h2>
            <p className="muted">
              Seconds the buyer has to raise a dispute after a verified delivery. When it expires
              without a dispute, anyone can release the funds.
            </p>
            <div className="row wrap">
              <input
                type="number"
                min="1"
                placeholder={`${config.disputeWindow}`}
                value={disputeWindow}
                onChange={(event) => setDisputeWindow(event.target.value)}
                disabled={!isOwner}
              />
              <span className="muted">seconds</span>
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                disabled={!isOwner || pending || !disputeWindow}
              >
                Save window
              </button>
            </div>
          </form>

          <form className="panel form" onSubmit={saveAgent}>
            <h2>Escrow agent</h2>
            <p className="muted">
              Address allowed to decide escalated disputes. Currently{" "}
              <span className="mono">{formatAddress(config.escrowAgent)}</span>.
            </p>
            <div className="row wrap">
              <input
                type="text"
                placeholder="0x…"
                value={agent}
                onChange={(event) => setAgent(event.target.value)}
                disabled={!isOwner}
              />
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                disabled={!isOwner || pending || !agent.trim()}
              >
                Save agent
              </button>
            </div>
          </form>

          <section className="panel">
            <h2>Deployment</h2>
            <dl className="kv">
              <div>
                <dt>Network</dt>
                <dd>
                  {NETWORK_NAME} (chain {CHAIN_ID})
                </dd>
              </div>
              <div>
                <dt>RPC endpoint</dt>
                <dd className="mono small">{RPC_URL}</dd>
              </div>
              <div>
                <dt>Contract</dt>
                <dd className="mono small">{CONTRACT_ADDRESS}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd className="mono small">{config.owner}</dd>
              </div>
              <div>
                <dt>Deployed at</dt>
                <dd>{DEPLOYED_AT ? formatDateTime(Date.parse(DEPLOYED_AT) / 1000) : "-"}</dd>
              </div>
            </dl>
            <p className="muted small">
              Re-deploy with <code>npx hardhat run scripts/deploy.js --network localhost</code> to
              refresh <code>src/config.json</code> and the ABI.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

export default function AdminSettings() {
  return (
    <WalletGate>
      <SettingsContent />
    </WalletGate>
  );
}

