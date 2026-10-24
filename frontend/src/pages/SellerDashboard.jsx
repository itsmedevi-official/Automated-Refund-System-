import DealCard from "../components/DealCard";
import Notice from "../components/Notice";
import Stats from "../components/Stats";
import WalletGate from "../components/WalletGate";
import { useDealIds, useDeals } from "../hooks/useEscrow";
import { useWallet } from "../hooks/useWallet";
import { DEAL_STATE, formatEth, isOpen } from "../services/format";

function SellerContent() {
  const { account } = useWallet();
  const { ids, loading, error } = useDealIds("seller", account);
  const { deals, loading: dealsLoading, error: dealsError } = useDeals(ids);

  const pending = deals
    .filter((deal) => isOpen(deal.state))
    .reduce((total, deal) => total + deal.amount, 0n);
  const earned = deals
    .filter((deal) => deal.state === DEAL_STATE.COMPLETED)
    .reduce((total, deal) => total + deal.amount, 0n);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Seller dashboard</h1>
          <p className="muted">
            Deals where you are the payee. The contract releases the money - no invoice chasing.
          </p>
        </div>
      </header>

      <Stats
        items={[
          { label: "Sales in escrow", value: deals.length },
          { label: "Waiting for release", value: `${formatEth(pending)} ETH` },
          { label: "Received", value: `${formatEth(earned)} ETH` },
          {
            label: "In dispute",
            value: deals.filter(
              (deal) =>
                deal.state === DEAL_STATE.DISPUTED || deal.state === DEAL_STATE.ESCALATED
            ).length,
          },
        ]}
      />

      {error && <Notice tone="error">{error}</Notice>}
      {dealsError && <Notice tone="error">{dealsError}</Notice>}
      {(loading || dealsLoading) && <p className="muted">Loading your sales…</p>}

      {!loading && !dealsLoading && deals.length === 0 && (
        <section className="panel center">
          <h2>No sales yet</h2>
          <p className="muted">
            A buyer has to open a deal with your address as the seller before it shows up here.
          </p>
        </section>
      )}

      <div className="grid grid-2">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal}>
            {deal.state === DEAL_STATE.DELIVERED && (
              <span className="hint">Release possible after the window</span>
            )}
          </DealCard>
        ))}
      </div>
    </div>
  );
}

export default function SellerDashboard() {
  return (
    <WalletGate message="Connect the seller wallet to see the deals that pay you.">
      <SellerContent />
    </WalletGate>
  );
}
