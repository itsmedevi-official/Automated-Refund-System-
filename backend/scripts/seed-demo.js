const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const CONFIG_PATH = path.join(__dirname, "..", "..", "frontend", "src", "config.json");

const BUYER_LOCATION = [12971600, 77594600]; // 12.9716, 77.5946
const NEAR_AGENT_LOCATION = [12972000, 77595000]; // ~62 m away

/**
 * Creates three demo deals so every dashboard has data right after deployment:
 *   deal 1: funded, waiting for the delivery agent to generate the OTP
 *   deal 2: OTP generated, waiting for the delivery agent to verify it
 *   deal 3: delivered, dispute window running -> auto release by the keeper / UI
 */
async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error("frontend/src/config.json not found. Run scripts/deploy.js first.");
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

  const signers = await ethers.getSigners();
  const [platform, buyer, seller, deliveryAgent] = signers;
  const escrow = await ethers.getContractAt("SmartEscrow", config.contractAddress, platform);

  console.log(`\nSeeding demo deals on ${config.contractAddress}`);
  console.log(`  buyer          : ${buyer.address}`);
  console.log(`  seller         : ${seller.address}`);
  console.log(`  delivery agent : ${deliveryAgent.address}`);

  const amount = ethers.parseEther("0.5");

  async function createDeal() {
    await (
      await escrow.connect(buyer).createDeal(seller.address, deliveryAgent.address, { value: amount })
    ).wait();
    const dealId = await escrow.dealCount();
    await (await escrow.connect(buyer).setBuyerLocation(dealId, BUYER_LOCATION[0], BUYER_LOCATION[1])).wait();
    return dealId;
  }

  async function generateOtp(dealId) {
    await (await escrow.connect(deliveryAgent).generateOTP(dealId)).wait();
    const events = await escrow.queryFilter(escrow.filters.OTPGenerated(dealId), 0, "latest");
    return events[events.length - 1].args.otp;
  }

  const deal1 = await createDeal();
  console.log(`  deal #${deal1}: funded, OTP not generated yet`);

  const deal2 = await createDeal();
  await generateOtp(deal2);
  console.log(`  deal #${deal2}: OTP generated, waiting for verification`);

  const deal3 = await createDeal();
  const otp3 = await generateOtp(deal3);
  await (
    await escrow
      .connect(deliveryAgent)
      .verifyOTP(deal3, otp3, NEAR_AGENT_LOCATION[0], NEAR_AGENT_LOCATION[1])
  ).wait();
  const delivered = await escrow.getDeal(deal3);
  console.log(
    `  deal #${deal3}: delivered, dispute window ends at ${new Date(
      Number(delivered.disputeDeadline) * 1000
    ).toLocaleTimeString()}`
  );

  console.log("\nOpen the app, connect MetaMask and switch between the buyer, seller,");
  console.log("delivery-agent and escrow-agent accounts to walk through the flows.\n");
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});
