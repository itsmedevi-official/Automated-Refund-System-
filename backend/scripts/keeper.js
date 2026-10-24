const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const CONFIG_PATH = path.join(__dirname, "..", "..", "frontend", "src", "config.json");
const DELIVERED = 3n;

/**
 * Optional convenience worker. The contract itself already enforces the release
 * conditions, so this script is not required for correctness: it simply calls
 * releaseFunds()/autoResolveDispute() as soon as they became valid.
 */
async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error("frontend/src/config.json not found. Deploy the contract first.");
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const [keeper] = await ethers.getSigners();
  const escrow = await ethers.getContractAt("SmartEscrow", config.contractAddress, keeper);

  console.log(`Keeper watching ${config.contractAddress} as ${keeper.address}`);
  console.log("Waiting for OTPVerified / DisputeRaised events... (Ctrl+C to stop)");

  escrow.on("OTPVerified", async (dealId) => {
    try {
      const deal = await escrow.getDeal(dealId);
      const now = Math.floor(Date.now() / 1000);
      const waitMs = Math.max(0, Number(deal.disputeDeadline) - now) * 1000 + 1500;
      console.log(`[keeper] deal ${dealId} delivered, release scheduled in ${Math.round(waitMs / 1000)}s`);

      setTimeout(async () => {
        try {
          const fresh = await escrow.getDeal(dealId);
          const timeNow = Math.floor(Date.now() / 1000);
          if (
            fresh.state === DELIVERED &&
            !fresh.disputeRaised &&
            timeNow >= Number(fresh.disputeDeadline)
          ) {
            const tx = await escrow.releaseFunds(dealId);
            await tx.wait();
            console.log(`[keeper] deal ${dealId}: funds released (${tx.hash})`);
          } else {
            console.log(`[keeper] deal ${dealId}: release skipped (state ${fresh.state})`);
          }
        } catch (error) {
          console.error(`[keeper] release failed for deal ${dealId}:`, error.shortMessage || error.message);
        }
      }, waitMs);
    } catch (error) {
      console.error(`[keeper] could not read deal ${dealId}:`, error.shortMessage || error.message);
    }
  });

  escrow.on("DisputeRaised", async (dealId) => {
    try {
      const tx = await escrow.autoResolveDispute(dealId);
      await tx.wait();
      const deal = await escrow.getDeal(dealId);
      console.log(
        `[keeper] deal ${dealId}: dispute processed -> state ${deal.state} (distance ${deal.distanceMeters} m)`
      );
    } catch (error) {
      console.error(`[keeper] dispute resolution failed for deal ${dealId}:`, error.shortMessage || error.message);
    }
  });

  process.on("SIGINT", () => {
    console.log("\nKeeper stopped.");
    process.exit(0);
  });

  // Keep the process alive.
  setInterval(() => {}, 60_000);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
