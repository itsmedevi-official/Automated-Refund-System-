import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import DealTimeline from "../components/DealTimeline";
import LocationCapture from "../components/LocationCapture";
import Notice from "../components/Notice";
import OtpPanel from "../components/OtpPanel";
import StateBadge from "../components/StateBadge";
import TxStatus from "../components/TxStatus";
import { useDeal, useEscrowConfig, useNow, useTransaction } from "../hooks/useEscrow";
import { useWallet } from "../hooks/useWallet";
import { getSignerContract } from "../services/contract";
import { degreesToMicro } from "../services/geo";
import {
  DEAL_STATE,
  formatAddress,
  formatCoordinates,
  formatCountdown,
  formatDateTime,
  formatDistance,
  formatEth,
  isOpen,
} from "../services/format";

const sameAddress = (a, b) => Boolean(a && b) && a.toLowerCase() === b.toLowerCase();

export default function DealDetails() {
  const { dealId } = useParams();
  const id = Number(dealId);
  const { deal, loading, error, reload } = useDeal(id);
  const { config } = useEscrowConfig();
  const { account } = useWallet();
  const { run, pending, error: txError, success, reset } = useTransaction();
  const now = useNow();

  const [location, setLocation] = useState(null);
  const [agentLocation, setAgentLocation] = useState(null);
  const [agentAddress, setAgentAddress] = useState("");
  const [reason, setReason] = useState("");
  const [otp, setOtp] = useState("");
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState(true);

  if (loading) {
    return <div className="page"><p className="muted">Loading deal #{id}…</p></div>;
  }
  if (error || !deal) {
    return (
      <div className="page">
        <Notice tone="error">{error || `Deal #${id} was not found.`}</Notice>
        <Link className="btn btn-ghost" to="/deals">Back to the explorer</Link>
      </div>
    );
  }

  const isBuyer = sameAddress(account, deal.buyer);
  const isSeller = sameAddress(account, deal.seller);
  const isAgent = sameAddress(account, deal.deliveryAgent);
  const isEscrowAgent = sameAddress(account, config?.escrowAgent);
  const windowPassed = deal.disputeDeadline ? now >= deal.disputeDeadline : false;
  const overThreshold = config ? deal.distanceMeters > config.distanceThreshold : false;

  const exec = async (action, message, onSuccess) => {
    const receipt = await run(async () => {
      const contract = await getSignerContract();
      const tx = await action(contract);
      return tx.wait();
    }, message);
    if (receipt) {
      onSuccess?.();
      reload();
    }
  };

  const saveLocation = () =>
    exec(
      (contract) =>
        contract.setBuyerLocation(
          deal.id,
          degreesToMicro(location.lat),
          degreesToMicro(location.lon)
        ),
      "Buyer location stored on-chain"
    );

  const updateAgent = () =>
    exec(
      (contract) => contract.updateDeliveryAgent(deal.id, agentAddress.trim()),
      "Delivery agent updated",
      () => setAgentAddress("")
    );

  const raiseDispute = () =>
    exec(
      (contract) => contract.raiseDispute(deal.id, reason.trim()),
      "Dispute opened",
      () => setReason("")
    );

  const escalate = () =>
    exec((contract) => contract.escalateDispute(deal.id), "Dispute escalated to the escrow agent");

  const autoResolve = () =>
    exec(
      (contract) => contract.autoResolveDispute(deal.id),
      "Automatic resolution executed"
    );

  const release = () =>
    exec((contract) => contract.releaseFunds(deal.id), "Funds released to the seller");

  const generate = () =>
    exec((contract) => contract.generateOTP(deal.id), "OTP generated on-chain");

  const verify = () =>
    exec(
      (contract) =>
        contract.verifyOTP(
          deal.id,
          BigInt(otp),
          degreesToMicro(agentLocation.lat),
          degreesToMicro(agentLocation.lon)
        ),
      "Delivery verified",
      () => {
        setOtp("");
        setAgentLocation(null);
      }
    );

  const resolve = () =>
    exec(
      (contract) => contract.resolveDispute(deal.id, refund, note.trim()),
      "Decision recorded and funds settled",
      () => setNote("")
    );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <Link className="back-link" to="/deals">
            ← Back to the explorer
          </Link>
          <h1>Deal #{deal.id}</h1>
          <p className="muted">
            {formatEth(deal.amount)} ETH · created {formatDateTime(deal.createdAt)}
          </p>
        </div>
        <StateBadge state={deal.state} />
      </header>

      {!account && (
        <Notice tone="info">Read-only view. Connect MetaMask to act on this deal.</Notice>
      )}

      <TxStatus pending={pending} error={txError} success={success} onDismiss={reset} />

      <div className="grid grid-2 deal-layout">
        <section className="panel">
          <h2>Overview</h2>
          <dl className="kv">
            <div>
              <dt>Buyer</dt>
              <dd className="mono" title={deal.buyer}>
                {formatAddress(deal.buyer, 6)}
              </dd>
            </div>
            <div>
              <dt>Seller</dt>
              <dd className="mono" title={deal.seller}>
                {formatAddress(deal.seller, 6)}
              </dd>
            </div>
            <div>
              <dt>Delivery agent</dt>
              <dd className="mono" title={deal.deliveryAgent}>
                {formatAddress(deal.deliveryAgent, 6)}
              </dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{formatEth(deal.amount)} ETH</dd>
            </div>
            {deal.otpVerified && (
              <div>
                <dt>Distance at delivery</dt>
                <dd className={overThreshold ? "danger" : "success"}>
                  {formatDistance(deal.distanceMeters)}
                  {config ? ` / limit ${config.distanceThreshold} m` : ""}
                </dd>
              </div>
            )}
            <div>
              <dt>Buyer location</dt>
              <dd className="mono small">
                {formatCoordinates(deal.buyerLat, deal.buyerLon)}
              </dd>
            </div>
            <div>
              <dt>Agent location</dt>
              <dd className="mono small">
                {formatCoordinates(deal.agentLat, deal.agentLon)}
              </dd>
            </div>
            {deal.state === DEAL_STATE.DELIVERED && (
              <div>
                <dt>Dispute window</dt>
                <dd>{windowPassed ? "expired" : formatCountdown(deal.disputeDeadline)}</dd>
              </div>
            )}
            {deal.disputeRaised && (
              <div>
                <dt>Dispute reason</dt>
                <dd>{deal.disputeReason}</dd>
              </div>
            )}
            {deal.resolvedAt > 0 && (
              <>
                <div>
                  <dt>Resolution</dt>
                  <dd>{deal.resolutionNote}</dd>
                </div>
                <div>
                  <dt>Settled by</dt>
                  <dd className="mono">{formatAddress(deal.resolvedBy)}</dd>
                </div>
                <div>
                  <dt>Settled at</dt>
                  <dd>{formatDateTime(deal.resolvedAt)}</dd>
                </div>
              </>
            )}
          </dl>

          <h3>Timeline</h3>
          <DealTimeline deal={deal} />
        </section>

        <div className="stack">
          {isBuyer && deal.otpGeneratedAt > 0 && (
            <section className="panel">
              <OtpPanel dealId={deal.id} />
            </section>
          )}

          {isBuyer && isOpen(deal.state) && (
            <section className="panel action-panel">
              <h3>Buyer actions</h3>

              {deal.state === DEAL_STATE.FUNDED && (
                <div className="action-block">
                  <h4>Change the delivery agent</h4>
                  <div className="row wrap">
                    <input
                      type="text"
                      placeholder="New delivery agent address"
                      value={agentAddress}
                      onChange={(event) => setAgentAddress(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={updateAgent}
                      disabled={pending || !agentAddress.trim()}
                    >
                      Update agent
                    </button>
                  </div>
                  <p className="muted small">Only possible before the OTP is generated.</p>
                </div>
              )}

              <div className="action-block">
                <h4>Delivery location</h4>
                <LocationCapture value={location} onChange={setLocation} />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={saveLocation}
                  disabled={pending || !location}
                >
                  Save location on-chain
                </button>
              </div>

              {deal.state === DEAL_STATE.ESCALATED && (
                <div className="action-block">
                  <h4>Under manual review</h4>
                  <p className="muted small">
                    The escrow agent decides this case. You can still store or update your delivery
                    location to strengthen the evidence.
                  </p>
                </div>
              )}

              {!deal.disputeRaised && (
                <div className="action-block">
                  <h4>Raise a dispute</h4>
                  <textarea
                    rows={3}
                    placeholder="What went wrong with the delivery?"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-warn btn-sm"
                    onClick={raiseDispute}
                    disabled={pending || !reason.trim()}
                  >
                    Open dispute
                  </button>
                </div>
              )}

              {deal.state === DEAL_STATE.DISPUTED && (
                <div className="action-block">
                  <h4>Dispute resolution</h4>
                  <div className="row wrap">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={autoResolve}
                      disabled={pending}
                    >
                      Run automatic resolution
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={escalate}
                      disabled={pending}
                    >
                      Escalate to the escrow agent
                    </button>
                  </div>
                  <p className="muted small">
                    The automatic rule pays the seller when the delivery location is within the
                    threshold, otherwise it refunds you. Incomplete evidence escalates the case.
                  </p>
                </div>
              )}
            </section>
          )}

          {isAgent && isOpen(deal.state) && (
            <section className="panel action-panel">
              <h3>Delivery agent actions</h3>

              {deal.state === DEAL_STATE.FUNDED && (
                <div className="action-block">
                  <h4>Step 1 - generate the OTP</h4>
                  <p className="muted small">
                    Do this only when you are at the delivery address with the parcel.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={generate}
                    disabled={pending}
                  >
                    Generate OTP
                  </button>
                </div>
              )}

              {deal.state === DEAL_STATE.OTP_GENERATED && (
                <div className="action-block">
                  <h4>Step 2 - verify the delivery</h4>
                  <input
                    className="otp-input"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4-digit OTP"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                  />
                  <LocationCapture
                    value={agentLocation}
                    onChange={setAgentLocation}
                    label="Capture drop-off location"
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={verify}
                    disabled={pending || otp.length !== 4 || !agentLocation}
                  >
                    Verify delivery
                  </button>
                  <p className="muted small">
                    The OTP comes from the buyer, never from this dashboard.
                  </p>
                </div>
              )}

              {deal.state !== DEAL_STATE.FUNDED && deal.state !== DEAL_STATE.OTP_GENERATED && (
                <p className="muted">Delivery already verified for this deal.</p>
              )}
            </section>
          )}


          {isEscrowAgent &&
            (deal.state === DEAL_STATE.DISPUTED || deal.state === DEAL_STATE.ESCALATED) && (
              <section className="panel action-panel">
                <h3>Arbitration</h3>
                <div className="row wrap">
                  <label className="radio">
                    <input
                      type="radio"
                      name="decision"
                      checked={refund}
                      onChange={() => setRefund(true)}
                    />
                    Refund the buyer
                  </label>
                  <label className="radio">
                    <input
                      type="radio"
                      name="decision"
                      checked={!refund}
                      onChange={() => setRefund(false)}
                    />
                    Pay the seller
                  </label>
                </div>
                <textarea
                  rows={3}
                  placeholder="Reason for the decision (stored on-chain)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <div className="row wrap">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={resolve}
                    disabled={pending || !note.trim()}
                  >
                    Submit decision
                  </button>
                  {deal.state === DEAL_STATE.DISPUTED && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={escalate}
                      disabled={pending}
                    >
                      Escalate instead
                    </button>
                  )}
                </div>
              </section>
            )}

          {account && deal.state === DEAL_STATE.DELIVERED && !deal.disputeRaised && (
            <section className="panel action-panel">
              <h3>Automatic release</h3>
              {windowPassed ? (
                <>
                  <p className="muted">
                    The dispute window has expired. Anyone can release the funds to the seller.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={release}
                    disabled={pending}
                  >
                    Release {formatEth(deal.amount)} ETH to the seller
                  </button>
                </>
              ) : (
                <p className="muted">
                  The buyer can still raise a dispute for {formatCountdown(deal.disputeDeadline)}.
                </p>
              )}
            </section>
          )}

          {isSeller && isOpen(deal.state) && (
            <section className="panel">
              <h3>Seller</h3>
              <p className="muted">
                {formatEth(deal.amount)} ETH are locked in escrow. You are paid automatically once
                the delivery is verified and the dispute window passes without a dispute.
              </p>
            </section>
          )}

          {account && !isBuyer && !isSeller && !isAgent && !isEscrowAgent && (
            <section className="panel">
              <h3>Actions</h3>
              <p className="muted">
                You are not a party to this deal. Only the buyer, delivery agent and escrow agent
                can act, although anyone may release the funds after the dispute window.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

