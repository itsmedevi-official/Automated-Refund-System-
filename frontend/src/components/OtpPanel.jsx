import { useState } from "react";
import { useDealOtp } from "../hooks/useEscrow";
import { formatTime } from "../services/format";
import Notice from "./Notice";

/** Buyer-only panel: reveals the OTP emitted when the delivery agent generated it. */
export default function OtpPanel({ dealId, enabled = true }) {
  const { otp, loading, error } = useDealOtp(dealId, enabled);
  const [copied, setCopied] = useState(false);

  if (!enabled) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(otp.otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="otp-panel">
      <h4>Delivery OTP</h4>
      {loading && <p className="muted">Reading the OTP event…</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {!loading && !otp && (
        <p className="muted">The delivery agent has not generated the OTP yet.</p>
      )}
      {otp && (
        <>
          <div className="otp-code" aria-live="polite">
            {otp.otp}
          </div>
          <p className="muted small">
            Generated at {formatTime(otp.at)}. Share it with the delivery agent when the
            parcel actually arrives - it is stored on-chain only as a hash.
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
            {copied ? "Copied" : "Copy OTP"}
          </button>
        </>
      )}
    </div>
  );
}
