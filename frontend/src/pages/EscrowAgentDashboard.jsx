import { Link } from "react-router-dom";
import DealCard from "../components/DealCard";
import Notice from "../components/Notice";
import Stats from "../components/Stats";
import WalletGate from "../components/WalletGate";
import {
  useAllDealIds,
  useDeals,
  useEscalatedDealIds,
  useEscrowConfig,
} from "../hooks/useEscrow";
import { useWallet } from "../hooks/useWallet";
import { DEAL_STATE, formatAddress } from "../services/format";

function EscrowAgentContent() {
  const { account } = useWallet();
  const { config } = useEscrowConfig();
  const {
    ids: escalatedIds,
    loading: escalatedLoading,
    error: escalatedError,
  } = useEscalatedDealIds();
  const { deals: escalatedDeals } = useDeals(escalatedIds);
  const { ids: allIds } = useAllDealIds();
  const { deals: allDeals } = useDeals(allIds);

  const disputed = allDeals.filter((deal) => deal.state === DEAL_STATE.DISPUTED);
  const resolved = allDeals.filter((deal) => deal.resolvedAt > 0);
  const isEscrowAgent =
    Boolean(config && account) &&
    config.escrowAgent.toLowerCase() === account.toLowerCase();

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Escrow agent</h1>
          <p className="muted">
            Cases the contract could not decide alone. Review the evidence and settle them.
          </p>
        </div>
      </header>

      {config && !isEscrowAgent && (
        <Notice tone="info">
          Read-only view. Only the escrow agent ({formatAddress(config.escrowAgent)}) can submit a
          decision.
        </Notice>
      )}

      <Stats
        items={[
          { label: "Escalated queue", value: escalatedDeals.length },
          { label: "Disputes awaiting action", value: disputed.length },
          { label: "Cases settled", value: resolved.length },
          { label: "Threshold", value: config ? `${config.distanceThreshold} m` : "-" },
        ]}
      />

      {escalatedError && <Notice tone="error">{escalatedError}</Notice>}
      {escalatedLoading && <p className="muted">Loading escalated cases…</p>}

      <section className="page-section">
        <h2>Escalated cases</h2>
        {!escalatedLoading && escalatedDeals.length === 0 && (
          <p className="muted">No open escalations right now.</p>
        )}
        <div className="grid grid-2">
          {escalatedDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal}>
              <Link className="btn btn-primary btn-sm" to={`/deals/${deal.id}`}>
                {isEscrowAgent ? "Resolve case" : "Review case"}
              </Link>
            </DealCard>
          ))}
        </div>
      </section>

      <section className="page-section">
        <h2>Disputes waiting for the automatic rule</h2>
        {disputed.length === 0 && (
          <p className="muted">
            None. A dispute can be resolved automatically by the buyer, or escalated to you.
          </p>
        )}
        <div className="grid grid-2">
          {disputed.map((deal) => (
            <DealCard key={deal.id} deal={deal}>
              <Link className="btn btn-ghost btn-sm" to={`/deals/${deal.id}`}>
                Inspect deal
              </Link>
            </DealCard>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function EscrowAgentDashboard() {
  return (
    <WalletGate message="Connect the escrow agent wallet to review escalated disputes.">
      <EscrowAgentContent />
    </WalletGate>
  );
}
