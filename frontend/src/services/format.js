import { formatEther } from "ethers";

/** Mirrors the DealState enum of SmartEscrow.sol. */
export const DEAL_STATE = {
  NONE: 0,
  FUNDED: 1,
  OTP_GENERATED: 2,
  DELIVERED: 3,
  DISPUTED: 4,
  ESCALATED: 5,
  COMPLETED: 6,
  REFUNDED: 7,
};

const STATE_META = {
  0: { label: "Unknown", tone: "muted" },
  1: { label: "Funded", tone: "info" },
  2: { label: "OTP generated", tone: "info" },
  3: { label: "Delivered", tone: "warn" },
  4: { label: "Disputed", tone: "danger" },
  5: { label: "Escalated", tone: "danger" },
  6: { label: "Completed", tone: "success" },
  7: { label: "Refunded", tone: "muted" },
};

export function stateLabel(state) {
  return STATE_META[Number(state)]?.label ?? "Unknown";
}

export function stateTone(state) {
  return STATE_META[Number(state)]?.tone ?? "muted";
}

export function isTerminal(state) {
  return Number(state) === DEAL_STATE.COMPLETED || Number(state) === DEAL_STATE.REFUNDED;
}

export function isOpen(state) {
  const value = Number(state);
  return value >= DEAL_STATE.FUNDED && value <= DEAL_STATE.ESCALATED;
}

/** 1000000000000000000n -> "1", 1500000000000000000n -> "1.5" */
export function formatEth(wei) {
  const raw = formatEther(wei ?? 0n);
  if (!raw.includes(".")) return raw;
  return raw.replace(/0+$/, "").replace(/\.$/, "");
}

export function formatAddress(address, size = 4) {
  if (!address) return "-";
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

export function formatDateTime(unixSeconds) {
  if (!unixSeconds) return "-";
  return new Date(Number(unixSeconds) * 1000).toLocaleString();
}

export function formatTime(unixSeconds) {
  if (!unixSeconds) return "-";
  return new Date(Number(unixSeconds) * 1000).toLocaleTimeString();
}

/** Seconds between now and a unix timestamp, e.g. "42 s", "3 min". */
export function formatCountdown(unixSeconds) {
  if (!unixSeconds) return "-";
  const diff = Number(unixSeconds) - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "expired";
  if (diff < 90) return `${diff} s`;
  if (diff < 3600) return `${Math.ceil(diff / 60)} min`;
  return `${Math.ceil(diff / 3600)} h`;
}

export function formatDistance(meters) {
  const value = Number(meters || 0);
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${value} m`;
}

export function microToDegrees(value) {
  return Number(value) / 1e6;
}

export function formatCoordinates(lat, lon) {
  if (lat === 0 && lon === 0) return "not set";
  return `${microToDegrees(lat).toFixed(6)}, ${microToDegrees(lon).toFixed(6)}`;
}

/** Turns an ethers/contract error into a single readable line. */
export function describeError(error) {
  if (!error) return "Unknown error";
  if (error.code === "ACTION_REJECTED") return "Transaction rejected in MetaMask";
  return (
    error.shortMessage ||
    error.reason ||
    error.info?.error?.message ||
    error.message ||
    "Transaction failed"
  );
}
