import { Link } from "react-router-dom";
import DealCard from "../components/DealCard";
import Notice from "../components/Notice";
import Stats from "../components/Stats";
import WalletGate from "../components/WalletGate";
import { useDealIds, useDeals } from "../hooks/useEscrow";
import { useWallet } from "../hooks/useWallet";
import { DEAL_STATE, formatEth, isOpen } from "../services/format";

function BuyerContent() {
  const { account } = useWallet();
  const { ids, loading, error } = useDealIds("buyer", account);
  const { deals, loading: dealsLoading, error: dealsError } = useDeals(ids);

  const locked = deals
    .filter((deal) => isOpen(deal.state))
    .reduce((total, deal) => total + deal.amount, 0n);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Buyer dashboard</h1>
          <p className="muted">Deals you funded. Open a deal to reveal its OTP or to dispute it.</p>
        </div>
        <Link className="btn btn-primary" to="/buyer/new">
          New deal
        </Link>
      </header>

      <Stats
        items={[
          { label: "Your deals", value: deals.length },
          { label: "Locked in escrow", value: `${formatEth(locked)} ETH` },
          {
            label: "Completed",
            value: deals.filter((deal) => deal.state === DEAL_STATE.COMPLETED).length,
          },
          {
            label: "Refunded",
            value: deals.filter((deal) => deal.state === DEAL_STATE.REFUNDED).length,
          },
        ]}
      />

      {error && <Notice tone="error">{error}</Notice>}
      {dealsError && <Notice tone="error">{dealsError}</Notice>}
      {(loading || dealsLoading) && <p className="muted">Loading your deals…</p>}

      {!loading && !dealsLoading && deals.length === 0 && (
        <section className="panel center">
          <h2>No deals yet</h2>
          <p className="muted">Create your first escrow deal to see it here.</p>
          <Link className="btn btn-primary" to="/buyer/new">
            Create a deal
          </Link>
        </section>
      )}

      <div className="grid grid-2">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}

export default function BuyerDashboard() {
  return (
    <WalletGate message="Connect the buyer wallet to see the deals you funded.">
      <BuyerContent />
    </WalletGate>
  );
}
