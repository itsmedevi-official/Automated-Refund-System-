import { Link } from "react-router-dom";
import DealCard from "../components/DealCard";
import Notice from "../components/Notice";
import Stats from "../components/Stats";
import WalletGate from "../components/WalletGate";
import { useDealIds, useDeals } from "../hooks/useEscrow";
import { useWallet } from "../hooks/useWallet";
import { DEAL_STATE } from "../services/format";

function AgentContent() {
  const { account } = useWallet();
  const { ids, loading, error } = useDealIds("agent", account);
  const { deals, loading: dealsLoading, error: dealsError } = useDeals(ids);

  const toGenerate = deals.filter((deal) => deal.state === DEAL_STATE.FUNDED).length;
  const toVerify = deals.filter((deal) => deal.state === DEAL_STATE.OTP_GENERATED).length;
  const delivered = deals.filter((deal) => deal.state === DEAL_STATE.DELIVERED).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Delivery agent dashboard</h1>
          <p className="muted">
            Generate the OTP at the drop-off point, then verify the code together with your GPS
            position.
          </p>
        </div>
      </header>

      <Stats
        items={[
          { label: "Assigned deals", value: deals.length },
          { label: "OTP to generate", value: toGenerate },
          { label: "Deliveries to verify", value: toVerify },
          { label: "Delivered", value: delivered },
        ]}
      />

      {error && <Notice tone="error">{error}</Notice>}
      {dealsError && <Notice tone="error">{dealsError}</Notice>}
      {(loading || dealsLoading) && <p className="muted">Loading your deliveries…</p>}

      {!loading && !dealsLoading && deals.length === 0 && (
        <section className="panel center">
          <h2>Nothing assigned</h2>
          <p className="muted">
            A buyer has to name your address as the delivery agent when creating a deal.
          </p>
        </section>
      )}

      <div className="grid grid-2">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal}>
            {deal.state === DEAL_STATE.FUNDED && (
              <Link className="btn btn-secondary btn-sm" to={`/deals/${deal.id}`}>
                Generate OTP
              </Link>
            )}
            {deal.state === DEAL_STATE.OTP_GENERATED && (
              <Link className="btn btn-primary btn-sm" to={`/deals/${deal.id}`}>
                Verify delivery
              </Link>
            )}
          </DealCard>
        ))}
      </div>

      <Notice tone="info">
        Your dashboard never displays the OTP - the buyer reads it from their own deal page and
        tells you at hand-over. The contract only stores its hash.
      </Notice>
    </div>
  );
}

export default function DeliveryAgentDashboard() {
  return (
    <WalletGate message="Connect the delivery agent wallet to manage your deliveries.">
      <AgentContent />
    </WalletGate>
  );
}
