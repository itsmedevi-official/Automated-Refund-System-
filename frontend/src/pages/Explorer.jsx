import { useMemo, useState } from "react";
import DealCard from "../components/DealCard";
import Notice from "../components/Notice";
import Stats from "../components/Stats";
import { useAllDealIds, useDeals } from "../hooks/useEscrow";
import { DEAL_STATE, formatEth, isOpen } from "../services/format";

export default function Explorer() {
  const { ids, loading, error } = useAllDealIds();
  const { deals, loading: dealsLoading, error: dealsError } = useDeals(ids);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return deals.filter((deal) => {
      const matchesTerm =
        !term ||
        String(deal.id) === term ||
        [deal.buyer, deal.seller, deal.deliveryAgent].some((address) =>
          address.toLowerCase().includes(term)
        );
      const matchesState = stateFilter === "all" || String(deal.state) === stateFilter;
      return matchesTerm && matchesState;
    });
  }, [deals, query, stateFilter]);

  const locked = deals
    .filter((deal) => isOpen(deal.state))
    .reduce((total, deal) => total + deal.amount, 0n);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Deal explorer</h1>
          <p className="muted">Every deal stored in the SmartEscrow contract.</p>
        </div>
      </header>

      <Stats
        items={[
          { label: "Deals", value: deals.length },
          { label: "Locked now", value: `${formatEth(locked)} ETH` },
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

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by deal id or address"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
          <option value="all">All states</option>
          <option value={DEAL_STATE.FUNDED}>Funded</option>
          <option value={DEAL_STATE.OTP_GENERATED}>OTP generated</option>
          <option value={DEAL_STATE.DELIVERED}>Delivered</option>
          <option value={DEAL_STATE.DISPUTED}>Disputed</option>
          <option value={DEAL_STATE.ESCALATED}>Escalated</option>
          <option value={DEAL_STATE.COMPLETED}>Completed</option>
          <option value={DEAL_STATE.REFUNDED}>Refunded</option>
        </select>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {dealsError && <Notice tone="error">{dealsError}</Notice>}
      {(loading || dealsLoading) && <p className="muted">Loading deals…</p>}

      {!loading && !dealsLoading && deals.length === 0 && (
        <section className="panel center">
          <h2>No deals yet</h2>
          <p className="muted">
            Deploy and seed the backend, or create the first deal from the buyer dashboard.
          </p>
        </section>
      )}

      {!loading && deals.length > 0 && filtered.length === 0 && (
        <p className="muted">No deal matches this filter.</p>
      )}

      <div className="grid grid-2">
        {filtered.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}
