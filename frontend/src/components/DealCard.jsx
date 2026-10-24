import { Link } from "react-router-dom";
import StateBadge from "./StateBadge";
import { useNow } from "../hooks/useEscrow";
import {
  DEAL_STATE,
  formatAddress,
  formatCountdown,
  formatDistance,
  formatEth,
} from "../services/format";

export default function DealCard({ deal, children }) {
  useNow(2000);
  const showWindow = deal.state === DEAL_STATE.DELIVERED && deal.disputeDeadline;

  return (
    <article className="deal-card">
      <header className="deal-card-head">
        <div>
          <h3>
            <Link to={`/deals/${deal.id}`}>Deal #{deal.id}</Link>
          </h3>
          <p className="muted">{formatEth(deal.amount)} ETH locked</p>
        </div>
        <StateBadge state={deal.state} />
      </header>

      <dl className="deal-parties">
        <div>
          <dt>Buyer</dt>
          <dd title={deal.buyer}>{formatAddress(deal.buyer)}</dd>
        </div>
        <div>
          <dt>Seller</dt>
          <dd title={deal.seller}>{formatAddress(deal.seller)}</dd>
        </div>
        <div>
          <dt>Delivery agent</dt>
          <dd title={deal.deliveryAgent}>{formatAddress(deal.deliveryAgent)}</dd>
        </div>
      </dl>

      <ul className="deal-meta">
        {deal.otpVerified && (
          <li>
            Delivery distance: <strong>{formatDistance(deal.distanceMeters)}</strong>
          </li>
        )}
        {showWindow && (
          <li>
            Dispute window: <strong>{formatCountdown(deal.disputeDeadline)}</strong>
          </li>
        )}
        {deal.disputeRaised && (
          <li>
            Dispute: <strong>{deal.disputeReason}</strong>
          </li>
        )}
        {deal.resolutionNote && (
          <li>
            Resolution: <strong>{deal.resolutionNote}</strong>
          </li>
        )}
      </ul>

      <div className="deal-actions">
        <Link className="btn btn-ghost btn-sm" to={`/deals/${deal.id}`}>
          Open deal
        </Link>
        {children}
      </div>
    </article>
  );
}
