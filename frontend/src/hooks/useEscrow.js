import { useCallback, useEffect, useState } from "react";
import { MaxUint256 } from "ethers";
import { getReadContract, isConfigured } from "../services/contract";
import { describeError } from "../services/format";

const MISSING_CONFIG =
  "No contract address configured. Run `npx hardhat run scripts/deploy.js --network localhost` first.";

/**
 * Small data-fetching helper: runs `loader` whenever `deps` change and exposes a
 * `reload()` function so components can refresh after a transaction is mined.
 */
function useAsync(loader, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loader()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(describeError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, loading, error, reload };
}

/** Converts the ethers Result into a plain object with JS numbers where it is safe. */
export function normalizeDeal(raw) {
  const deadline =
    raw.disputeDeadline === MaxUint256 ? null : Number(raw.disputeDeadline);
  return {
    id: Number(raw.id),
    buyer: raw.buyer,
    seller: raw.seller,
    deliveryAgent: raw.deliveryAgent,
    amount: raw.amount,
    state: Number(raw.state),
    createdAt: Number(raw.createdAt),
    otpGeneratedAt: Number(raw.otpGeneratedAt),
    deliveredAt: Number(raw.deliveredAt),
    disputeDeadline: deadline,
    disputedAt: Number(raw.disputedAt),
    resolvedAt: Number(raw.resolvedAt),
    otpVerified: Boolean(raw.otpVerified),
    disputeRaised: Boolean(raw.disputeRaised),
    disputeReason: raw.disputeReason,
    resolutionNote: raw.resolutionNote,
    buyerLat: Number(raw.buyerLat),
    buyerLon: Number(raw.buyerLon),
    buyerLocationAt: Number(raw.buyerLocationAt),
    agentLat: Number(raw.agentLat),
    agentLon: Number(raw.agentLon),
    distanceMeters: Number(raw.distanceMeters),
    resolvedBy: raw.resolvedBy,
  };
}


export function useEscrowConfig() {
  const { data, loading, error, reload } = useAsync(async () => {
    if (!isConfigured) throw new Error(MISSING_CONFIG);
    const contract = getReadContract();
    const info = await contract.getEscrowConfig();
    return {
      owner: info.ownerAddress,
      escrowAgent: info.escrowAgentAddress,
      distanceThreshold: Number(info.distanceThreshold),
      disputeWindow: Number(info.disputeWindow),
      totalDeals: Number(info.totalDeals),
    };
  }, []);
  return { config: data, loading, error, reload };
}

export function useDealIds(kind, address) {
  const { data, loading, error, reload } = useAsync(async () => {
    if (!address || !isConfigured) return [];
    const getter = {
      buyer: "getDealsByBuyer",
      seller: "getDealsBySeller",
      agent: "getDealsByDeliveryAgent",
    }[kind];
    if (!getter) return [];
    const ids = await getReadContract()[getter](address);
    return ids.map((id) => Number(id)).reverse();
  }, [kind, address]);
  return { ids: data ?? [], loading, error, reload };
}

export function useAllDealIds() {
  const { data, loading, error, reload } = useAsync(async () => {
    if (!isConfigured) return [];
    const count = Number(await getReadContract().dealCount());
    return Array.from({ length: count }, (_, index) => count - index);
  }, []);
  return { ids: data ?? [], loading, error, reload };
}

export function useEscalatedDealIds() {
  const { data, loading, error, reload } = useAsync(async () => {
    if (!isConfigured) return [];
    const ids = await getReadContract().getEscalatedDealIds();
    return ids.map((id) => Number(id)).reverse();
  }, []);
  return { ids: data ?? [], loading, error, reload };
}

export function useDeals(ids) {
  const key = ids.join(",");
  const { data, loading, error, reload } = useAsync(async () => {
    if (!key) return [];
    const contract = getReadContract();
    const raw = await Promise.all(
      key.split(",").map((id) => contract.getDeal(id))
    );
    return raw.map(normalizeDeal);
  }, [key]);
  return { deals: data ?? [], loading, error, reload };
}

export function useDeal(dealId) {
  const { deals, loading, error, reload } = useDeals(dealId ? [dealId] : []);
  return { deal: deals[0] ?? null, loading, error, reload };
}

/**
 * The OTP is never stored in clear text on-chain - it is only emitted with the
 * OTPGenerated event so that the buyer's wallet can display it.
 */
export function useDealOtp(dealId, enabled = true) {
  const { data, loading, error, reload } = useAsync(async () => {
    if (!dealId || !enabled || !isConfigured) return null;
    const contract = getReadContract();
    const events = await contract.queryFilter(
      contract.filters.OTPGenerated(dealId),
      0,
      "latest"
    );
    if (events.length === 0) return null;
    const event = events[events.length - 1];
    return { otp: event.args.otp.toString(), at: Number(event.args.at) };
  }, [dealId, enabled]);
  return { otp: data, loading: enabled && loading, error, reload };
}

/** Wraps a transaction: pending flag, readable error, success message, returns the result. */
export function useTransaction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const run = useCallback(async (action, message = "Transaction confirmed") => {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await action();
      setSuccess(message);
      return result;
    } catch (err) {
      setError(describeError(err));
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return { run, pending, error, success, reset };
}

/** Re-renders every second so countdowns stay fresh. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      intervalMs
    );
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
