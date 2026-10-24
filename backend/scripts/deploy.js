const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
require("dotenv").config();
const { exportAbi } = require("./lib/exportAbi");

const FRONTEND_CONFIG = path.join(__dirname, "..", "..", "frontend", "src", "config.json");
const BACKEND_ENV = path.join(__dirname, "..", ".env");

function writeEnv(contractAddress) {
  const existing = fs.existsSync(BACKEND_ENV) ? fs.readFileSync(BACKEND_ENV, "utf8") : "";
  const kept = existing
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.startsWith("ESCROW_CONTRACT="));
  kept.push(`ESCROW_CONTRACT=${contractAddress}`);
  fs.writeFileSync(BACKEND_ENV, kept.join("\n") + "\n", "utf8");
}

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const escrowAgentAddress = process.env.ESCROW_AGENT_ADDRESS || deployer.address;

  console.log(`\nDeploying SmartEscrow on network "${network.name}"`);
  console.log(`  owner / deployer : ${deployer.address}`);
  console.log(`  escrow agent     : ${escrowAgentAddress}`);

  const Escrow = await ethers.getContractFactory("SmartEscrow");
  const escrow = await Escrow.deploy(escrowAgentAddress);
  await escrow.waitForDeployment();
  const contractAddress = await escrow.getAddress();

  // Optional parameter overrides coming from backend/.env
  const threshold = Number(process.env.DISTANCE_THRESHOLD_METERS || 200);
  const disputeWindow = Number(process.env.DISPUTE_WINDOW_SECONDS || 60);

  if (threshold !== 200) {
    await (await escrow.setDistanceThreshold(threshold)).wait();
  }
  if (disputeWindow !== 60) {
    await (await escrow.setDisputeWindow(disputeWindow)).wait();
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const config = {
    contractAddress,
    chainId,
    network: network.name,
    rpcUrl:
      process.env.RPC_URL ||
      (chainId === 31337 ? "http://127.0.0.1:8545" : ""),
    escrowAgent: escrowAgentAddress,
    deployedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(FRONTEND_CONFIG), { recursive: true });
  fs.writeFileSync(FRONTEND_CONFIG, JSON.stringify(config, null, 2) + "\n", "utf8");
  writeEnv(contractAddress);
  const abiTarget = exportAbi();

  console.log(`\nSmartEscrow deployed at: ${contractAddress}`);
  console.log(`  distance threshold : ${await escrow.distanceThresholdMeters()} m`);
  console.log(`  dispute window     : ${await escrow.disputeWindowSeconds()} s`);
  console.log(`  frontend config    : ${FRONTEND_CONFIG}`);
  console.log(`  frontend ABI       : ${abiTarget}`);
  console.log(`  backend .env       : ${BACKEND_ENV}`);
  console.log("\nNext steps:");
  console.log("  1. npx hardhat node                                   (terminal 1)");
  console.log("  2. npx hardhat run scripts/deploy.js --network localhost");
  console.log("  3. npx hardhat run scripts/seed-demo.js --network localhost");
  console.log("  4. cd ../frontend && npm run dev\n");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
