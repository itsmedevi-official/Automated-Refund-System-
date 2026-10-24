import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import deployment from "../config.json";
import artifact from "../contracts/SmartEscrow.json";

// Everything the app needs to talk to the chain comes from these two generated files.
// backend/scripts/deploy.js rewrites them, so the frontend never reaches outside its root.
export const CONTRACT_ADDRESS = deployment.contractAddress || "";
export const CHAIN_ID = Number(deployment.chainId || 31337);
export const NETWORK_NAME = deployment.network || "localhost";
export const RPC_URL =
  import.meta.env.VITE_RPC_URL || deployment.rpcUrl || "http://127.0.0.1:8545";
export const ESCROW_ABI = artifact.abi;
export const CONFIGURED_ESCROW_AGENT = deployment.escrowAgent || "";
export const DEPLOYED_AT = deployment.deployedAt || "";

export const isConfigured = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);

let readProvider = null;

/** Provider used for read-only calls (works without MetaMask). */
export function getReadProvider() {
  if (!readProvider) {
    readProvider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
  }
  return readProvider;
}

/** Contract instance for read-only calls. */
export function getReadContract() {
  return new Contract(CONTRACT_ADDRESS, ESCROW_ABI, getReadProvider());
}

/** EIP-1193 provider injected by MetaMask. */
export function getBrowserProvider() {
  if (!window.ethereum) {
    throw new Error("MetaMask was not found. Install it or use a read-only view.");
  }
  return new BrowserProvider(window.ethereum);
}

/** Contract instance connected to the current MetaMask account (can send transactions). */
export async function getSignerContract() {
  const provider = getBrowserProvider();
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, ESCROW_ABI, signer);
}
