const { ethers, network } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const STATE_NAMES = [
  "NONE",
  "FUNDED",
  "OTP_GENERATED",
  "DELIVERED",
  "DISPUTED",
  "ESCALATED",
  "COMPLETED",
  "REFUNDED",
];

const AMOUNT = ethers.parseEther("1");
const BUYER_LOCATION = [12971600, 77594600]; // 12.9716 N, 77.5946 E (Bengaluru)
const NEAR_AGENT_LOCATION = [12972000, 77595000]; // ~62 m from the buyer
const FAR_AGENT_LOCATION = [12980000, 77600000]; // ~10 km from the buyer

/**
 * End-to-end walkthrough of the four scenarios from the thesis (Chapter 4 / Table 4.2).
 * Runs on the in-memory Hardhat network by default, or on localhost with
 * `npx hardhat run scripts/demo-flow.js --network localhost`.
 */
async function main() {
  const [platform, buyer, seller, deliveryAgent] = await ethers.getSigners();
  console.log(`\n=== SmartEscrow demo (${network.name}) ===`);
  console.log(`  platform / escrow agent : ${platform.address}`);
  console.log(`  buyer                   : ${buyer.address}`);
  console.log(`  seller                  : ${seller.address}`);
  console.log(`  delivery agent          : ${deliveryAgent.address}`);

  const Escrow = await ethers.getContractFactory("SmartEscrow");
  const escrow = await Escrow.deploy(platform.address);
  await escrow.waitForDeployment();
  await (await escrow.setDisputeWindow(300)).wait();
  console.log(`\nContract deployed at ${await escrow.getAddress()}`);
  console.log(
    `Threshold: ${await escrow.distanceThresholdMeters()} m, dispute window: ${await escrow.disputeWindowSeconds()} s\n`
  );

  async function createDeal() {
    await (
      await escrow.connect(buyer).createDeal(seller.address, deliveryAgent.address, { value: AMOUNT })
    ).wait();
    const dealId = await escrow.dealCount();
    await (
      await escrow.connect(buyer).setBuyerLocation(dealId, BUYER_LOCATION[0], BUYER_LOCATION[1])
    ).wait();
    return dealId;
  }

  async function deliver(dealId, agentLocation) {
    await (await escrow.connect(deliveryAgent).generateOTP(dealId)).wait();
    const events = await escrow.queryFilter(escrow.filters.OTPGenerated(dealId), 0, "latest");
    const otp = events[events.length - 1].args.otp;
    await (
      await escrow
        .connect(deliveryAgent)
        .verifyOTP(dealId, otp, agentLocation[0], agentLocation[1])
    ).wait();
    return otp;
  }

  const results = [];

  // ------------------------------------------------------------------ scenario 1
  console.log("Scenario 1: delivery accepted, no dispute -> funds released to the seller");
  const deal1 = await createDeal();
  await deliver(deal1, NEAR_AGENT_LOCATION);
  await time.increase(301);
  const sellerBefore = await ethers.provider.getBalance(seller.address);
  await (await escrow.connect(buyer).releaseFunds(deal1)).wait();
  const sellerAfter = await ethers.provider.getBalance(seller.address);
  let deal = await escrow.getDeal(deal1);
  console.log(`  deal #${deal1}: ${STATE_NAMES[deal.state]}, distance ${deal.distanceMeters} m`);
  console.log(`  seller balance delta: ${ethers.formatEther(sellerAfter - sellerBefore)} ETH\n`);
  results.push({
    scenario: "1. No dispute, window elapsed",
    deal: deal1.toString(),
    state: STATE_NAMES[deal.state],
    distance: `${deal.distanceMeters} m`,
    outcome: "+1 ETH to seller",
  });

  // ------------------------------------------------------------------ scenario 2
  console.log("Scenario 2: agent far away at delivery -> buyer refunded automatically");
  const deal2 = await createDeal();
  await deliver(deal2, FAR_AGENT_LOCATION);
  await (
    await escrow.connect(buyer).raiseDispute(deal2, "Parcel delivered to the wrong location")
  ).wait();
  const buyerBefore2 = await ethers.provider.getBalance(buyer.address);
  await (await escrow.connect(platform).autoResolveDispute(deal2)).wait();
  const buyerAfter2 = await ethers.provider.getBalance(buyer.address);
  deal = await escrow.getDeal(deal2);
  console.log(`  deal #${deal2}: ${STATE_NAMES[deal.state]}, distance ${deal.distanceMeters} m`);
  console.log(`  buyer balance delta: ${ethers.formatEther(buyerAfter2 - buyerBefore2)} ETH`);
  console.log(`  note: ${deal.resolutionNote}\n`);
  results.push({
    scenario: "2. Dispute, distance above threshold",
    deal: deal2.toString(),
    state: STATE_NAMES[deal.state],
    distance: `${deal.distanceMeters} m`,
    outcome: "+1 ETH to buyer",
  });

  // ------------------------------------------------------------------ scenario 3
  console.log("Scenario 3: dispute but the agent was next to the buyer -> seller paid");
  const deal3 = await createDeal();
  await deliver(deal3, NEAR_AGENT_LOCATION);
  await (
    await escrow.connect(buyer).raiseDispute(deal3, "I claim I never received the parcel")
  ).wait();
  await (await escrow.connect(platform).autoResolveDispute(deal3)).wait();
  deal = await escrow.getDeal(deal3);
  console.log(`  deal #${deal3}: ${STATE_NAMES[deal.state]}, distance ${deal.distanceMeters} m`);
  console.log(`  note: ${deal.resolutionNote}\n`);
  results.push({
    scenario: "3. Dispute, distance within threshold",
    deal: deal3.toString(),
    state: STATE_NAMES[deal.state],
    distance: `${deal.distanceMeters} m`,
    outcome: "+1 ETH to seller",
  });

  // ------------------------------------------------------------------ scenario 4
  console.log("Scenario 4: dispute without enough evidence -> escalated to the escrow agent");
  const deal4 = await createDeal();
  await (await escrow.connect(buyer).raiseDispute(deal4, "Parcel never arrived")).wait();
  await (await escrow.connect(platform).autoResolveDispute(deal4)).wait();
  deal = await escrow.getDeal(deal4);
  console.log(`  deal #${deal4}: ${STATE_NAMES[deal.state]} (no OTP evidence)`);
  console.log(`  escalated queue: [${(await escrow.getEscalatedDealIds()).join(", ")}]`);
  await (
    await escrow
      .connect(platform)
      .resolveDispute(deal4, true, "Seller could not provide proof of delivery")
  ).wait();
  deal = await escrow.getDeal(deal4);
  console.log(`  agent decision -> ${STATE_NAMES[deal.state]}: ${deal.resolutionNote}\n`);
  results.push({
    scenario: "4. Escalated, agent refunds buyer",
    deal: deal4.toString(),
    state: STATE_NAMES[deal.state],
    distance: `${deal.distanceMeters} m`,
    outcome: "+1 ETH to buyer",
  });

  // ------------------------------------------------------------------ summary
  console.log("=== Summary ===");
  console.table(results);
  const contractBalance = await ethers.provider.getBalance(await escrow.getAddress());
  console.log(`Contract balance after the demo: ${ethers.formatEther(contractBalance)} ETH`);
  console.log(
    `Deals created: ${await escrow.dealCount()}, escalated (still open): ${
      (await escrow.getEscalatedDealIds()).length
    }\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
