const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const ONE_ETH = ethers.parseEther("1");

// Micro-degrees (degrees * 1e6)
const BUYER_LOCATION = [12971600, 77594600]; // 12.9716, 77.5946
const NEAR_AGENT_LOCATION = [12972000, 77595000]; // ~62 m from the buyer
const FAR_AGENT_LOCATION = [12980000, 77600000]; // ~1.1 km from the buyer
const REASON = "Product not received";

const State = {
  NONE: 0n,
  FUNDED: 1n,
  OTP_GENERATED: 2n,
  DELIVERED: 3n,
  DISPUTED: 4n,
  ESCALATED: 5n,
  COMPLETED: 6n,
  REFUNDED: 7n,
};

async function deployFixture() {
  const [owner, buyer, seller, deliveryAgent, stranger] = await ethers.getSigners();
  const Escrow = await ethers.getContractFactory("SmartEscrow");
  // The deployer is the platform owner *and* the escrow agent (thesis "admin"),
  // which keeps the demo to a single platform account.
  const escrow = await Escrow.deploy(owner.address);
  await escrow.waitForDeployment();
  await escrow.connect(owner).setDisputeWindow(300);
  return { escrow, owner, buyer, seller, deliveryAgent, stranger };
}

async function fundedDealFixture() {
  const context = await deployFixture();
  const { escrow, buyer, seller, deliveryAgent } = context;
  await escrow.connect(buyer).createDeal(seller.address, deliveryAgent.address, { value: ONE_ETH });
  await escrow.connect(buyer).setBuyerLocation(1, BUYER_LOCATION[0], BUYER_LOCATION[1]);
  return context;
}

async function otpGeneratedFixture() {
  const context = await fundedDealFixture();
  await context.escrow.connect(context.deliveryAgent).generateOTP(1);
  return context;
}

async function readOtp(escrow, dealId) {
  const events = await escrow.queryFilter(escrow.filters.OTPGenerated(dealId), 0, "latest");
  expect(events.length).to.be.greaterThan(0);
  return events[events.length - 1].args.otp;
}

async function deliveredFixture() {
  const context = await otpGeneratedFixture();
  const otp = await readOtp(context.escrow, 1);
  await context.escrow
    .connect(context.deliveryAgent)
    .verifyOTP(1, otp, NEAR_AGENT_LOCATION[0], NEAR_AGENT_LOCATION[1]);
  return { ...context, otp };
}

describe("SmartEscrow", function () {
  describe("Deployment", function () {
    it("sets the owner, escrow agent and default parameters", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      expect(await escrow.owner()).to.equal(owner.address);
      expect(await escrow.escrowAgent()).to.equal(owner.address);
      expect(await escrow.distanceThresholdMeters()).to.equal(200n);
      expect(await escrow.disputeWindowSeconds()).to.equal(300n);
      expect(await escrow.dealCount()).to.equal(0n);
    });

    it("rejects a zero escrow agent", async function () {
      const Escrow = await ethers.getContractFactory("SmartEscrow");
      await expect(Escrow.deploy(ethers.ZeroAddress)).to.be.revertedWith(
        "Escrow agent cannot be zero address"
      );
    });
  });

  describe("createDeal (deposit funds)", function () {
    it("locks the funds and registers the deal for all parties", async function () {
      const { escrow, buyer, seller, deliveryAgent } = await loadFixture(deployFixture);

      const tx = escrow
        .connect(buyer)
        .createDeal(seller.address, deliveryAgent.address, { value: ONE_ETH });

      await expect(tx)
        .to.emit(escrow, "DealCreated")
        .withArgs(1n, buyer.address, seller.address, deliveryAgent.address, ONE_ETH, anyValue);
      await expect(tx).to.emit(escrow, "FundsDeposited").withArgs(1n, buyer.address, ONE_ETH);
      await expect(tx).to.changeEtherBalance(escrow, ONE_ETH);

      const deal = await escrow.getDeal(1);
      expect(deal.id).to.equal(1n);
      expect(deal.buyer).to.equal(buyer.address);
      expect(deal.seller).to.equal(seller.address);
      expect(deal.deliveryAgent).to.equal(deliveryAgent.address);
      expect(deal.amount).to.equal(ONE_ETH);
      expect(deal.state).to.equal(State.FUNDED);
      expect(deal.otpVerified).to.equal(false);
      expect(deal.disputeRaised).to.equal(false);

      expect(await escrow.getDealsByBuyer(buyer.address)).to.deep.equal([1n]);
      expect(await escrow.getDealsBySeller(seller.address)).to.deep.equal([1n]);
      expect(await escrow.getDealsByDeliveryAgent(deliveryAgent.address)).to.deep.equal([1n]);
      expect(await escrow.dealCount()).to.equal(1n);
    });

    it("rejects an empty deposit", async function () {
      const { escrow, buyer, seller, deliveryAgent } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(buyer).createDeal(seller.address, deliveryAgent.address)
      ).to.be.revertedWith("Deposit amount must be greater than zero");
    });

    it("rejects zero addresses and repeated roles", async function () {
      const { escrow, buyer, seller, deliveryAgent } = await loadFixture(deployFixture);

      await expect(
        escrow.connect(buyer).createDeal(ethers.ZeroAddress, deliveryAgent.address, {
          value: ONE_ETH,
        })
      ).to.be.revertedWith("Seller cannot be zero address");

      await expect(
        escrow.connect(buyer).createDeal(seller.address, ethers.ZeroAddress, { value: ONE_ETH })
      ).to.be.revertedWith("Delivery agent cannot be zero address");

      await expect(
        escrow.connect(buyer).createDeal(buyer.address, deliveryAgent.address, { value: ONE_ETH })
      ).to.be.revertedWith("Buyer and seller must be different");

      await expect(
        escrow.connect(buyer).createDeal(seller.address, buyer.address, { value: ONE_ETH })
      ).to.be.revertedWith("Buyer cannot be the delivery agent");

      await expect(
        escrow.connect(buyer).createDeal(seller.address, seller.address, { value: ONE_ETH })
      ).to.be.revertedWith("Seller cannot be the delivery agent");
    });
  });

  describe("Buyer location and delivery agent management", function () {
    it("stores the buyer location on-chain", async function () {
      const { escrow } = await loadFixture(fundedDealFixture);
      const deal = await escrow.getDeal(1);
      expect(deal.buyerLat).to.equal(BigInt(BUYER_LOCATION[0]));
      expect(deal.buyerLon).to.equal(BigInt(BUYER_LOCATION[1]));
      expect(deal.buyerLocationAt).to.be.greaterThan(0n);
    });

    it("emits an event and rejects out-of-range coordinates", async function () {
      const { escrow, buyer, seller, deliveryAgent } = await loadFixture(deployFixture);
      await escrow
        .connect(buyer)
        .createDeal(seller.address, deliveryAgent.address, { value: ONE_ETH });

      await expect(escrow.connect(buyer).setBuyerLocation(1, 12971600, 77594600))
        .to.emit(escrow, "BuyerLocationSet")
        .withArgs(1n, 12971600n, 77594600n, anyValue);

      await expect(
        escrow.connect(buyer).setBuyerLocation(1, 91000000, 0)
      ).to.be.revertedWith("Latitude out of range");
      await expect(
        escrow.connect(buyer).setBuyerLocation(1, 0, 181000000)
      ).to.be.revertedWith("Longitude out of range");
    });

    it("only the buyer can set the location", async function () {
      const { escrow, stranger } = await loadFixture(fundedDealFixture);
      await expect(escrow.connect(stranger).setBuyerLocation(1, 0, 0)).to.be.revertedWith(
        "Only buyer can set buyer location"
      );
    });

    it("allows the buyer to change the delivery agent before the OTP is generated", async function () {
      const { escrow, buyer, stranger } = await loadFixture(fundedDealFixture);
      await expect(escrow.connect(buyer).updateDeliveryAgent(1, stranger.address))
        .to.emit(escrow, "DeliveryAgentUpdated")
        .withArgs(1n, stranger.address);

      expect((await escrow.getDeal(1)).deliveryAgent).to.equal(stranger.address);
      expect(await escrow.getDealsByDeliveryAgent(stranger.address)).to.deep.equal([1n]);
    });

    it("does not allow changing the agent after the OTP exists", async function () {
      const { escrow, buyer, stranger } = await loadFixture(otpGeneratedFixture);
      await expect(
        escrow.connect(buyer).updateDeliveryAgent(1, stranger.address)
      ).to.be.revertedWith("Delivery agent can only change before OTP generation");
    });
  });

  describe("OTP generation and delivery verification", function () {
    it("generates a 4-digit OTP for the deal", async function () {
      const { escrow, deliveryAgent } = await loadFixture(fundedDealFixture);
      await expect(escrow.connect(deliveryAgent).generateOTP(1)).to.emit(escrow, "OTPGenerated");

      const events = await escrow.queryFilter(escrow.filters.OTPGenerated(1n), 0, "latest");
      const otp = events[0].args.otp;
      expect(otp).to.be.greaterThanOrEqual(1000n);
      expect(otp).to.be.lessThanOrEqual(9999n);

      const deal = await escrow.getDeal(1);
      expect(deal.state).to.equal(State.OTP_GENERATED);
      expect(deal.otpHash).to.not.equal(ethers.ZeroHash);
      expect(deal.otpGeneratedAt).to.be.greaterThan(0n);
    });

    it("rejects OTP generation by any other account", async function () {
      const { escrow, buyer, seller, stranger } = await loadFixture(fundedDealFixture);
      for (const account of [buyer, seller, stranger]) {
        await expect(escrow.connect(account).generateOTP(1)).to.be.revertedWith(
          "Only the assigned delivery agent can generate the OTP"
        );
      }
    });

    it("rejects a second OTP for the same deal", async function () {
      const { escrow, deliveryAgent } = await loadFixture(otpGeneratedFixture);
      await expect(escrow.connect(deliveryAgent).generateOTP(1)).to.be.revertedWith(
        "OTP can only be generated for a funded deal"
      );
    });

    it("rejects operations on unknown deals", async function () {
      const { escrow, deliveryAgent } = await loadFixture(fundedDealFixture);
      await expect(escrow.connect(deliveryAgent).generateOTP(99)).to.be.revertedWith(
        "Deal does not exist"
      );
    });

    it("rejects an incorrect OTP", async function () {
      const { escrow, deliveryAgent } = await loadFixture(otpGeneratedFixture);
      const otp = await readOtp(escrow, 1);
      const wrong = otp === 9999n ? 1111n : otp + 1n;
      await expect(
        escrow
          .connect(deliveryAgent)
          .verifyOTP(1, wrong, NEAR_AGENT_LOCATION[0], NEAR_AGENT_LOCATION[1])
      ).to.be.revertedWith("Invalid OTP");
    });

    it("only the assigned agent can verify the OTP", async function () {
      const { escrow, buyer, stranger } = await loadFixture(otpGeneratedFixture);
      const otp = await readOtp(escrow, 1);
      for (const account of [buyer, stranger]) {
        await expect(
          escrow
            .connect(account)
            .verifyOTP(1, otp, NEAR_AGENT_LOCATION[0], NEAR_AGENT_LOCATION[1])
        ).to.be.revertedWith("Only the assigned delivery agent can verify the OTP");
      }
    });

    it("records the verified delivery, agent location and dispute window", async function () {
      const { escrow, deliveryAgent } = await loadFixture(otpGeneratedFixture);
      const otp = await readOtp(escrow, 1);
      const tx = await escrow
        .connect(deliveryAgent)
        .verifyOTP(1, otp, NEAR_AGENT_LOCATION[0], NEAR_AGENT_LOCATION[1]);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const deal = await escrow.getDeal(1);
      expect(deal.state).to.equal(State.DELIVERED);
      expect(deal.otpVerified).to.equal(true);
      expect(deal.deliveredAt).to.equal(BigInt(block.timestamp));
      expect(deal.disputeDeadline).to.equal(BigInt(block.timestamp) + 300n);
      expect(deal.agentLat).to.equal(BigInt(NEAR_AGENT_LOCATION[0]));
      expect(deal.agentLon).to.equal(BigInt(NEAR_AGENT_LOCATION[1]));
      expect(deal.distanceMeters).to.be.greaterThan(0n);
      expect(deal.distanceMeters).to.be.lessThanOrEqual(200n);
      await expect(tx).to.emit(escrow, "OTPVerified");
    });

    it("recomputes the stored distance when the buyer updates the location", async function () {
      const { escrow, buyer } = await loadFixture(deliveredFixture);
      expect((await escrow.getDeal(1)).distanceMeters).to.be.lessThanOrEqual(200n);

      await escrow
        .connect(buyer)
        .setBuyerLocation(1, FAR_AGENT_LOCATION[0], FAR_AGENT_LOCATION[1]);
      expect((await escrow.getDeal(1)).distanceMeters).to.be.greaterThan(200n);
    });
  });

  describe("Automatic release after the dispute window", function () {
    it("blocks the release before the dispute window expires", async function () {
      const { escrow, stranger } = await loadFixture(deliveredFixture);
      await expect(escrow.connect(stranger).releaseFunds(1)).to.be.revertedWith(
        "Dispute window has not expired yet"
      );
    });

    it("releases the funds to the seller once the window expires", async function () {
      const { escrow, seller, stranger } = await loadFixture(deliveredFixture);
      await time.increase(301);

      await expect(escrow.connect(stranger).releaseFunds(1)).to.changeEtherBalance(
        seller,
        ONE_ETH
      );

      const deal = await escrow.getDeal(1);
      expect(deal.state).to.equal(State.COMPLETED);
      expect(deal.amount).to.equal(0n);
      expect(deal.resolvedBy).to.equal(stranger.address);
      expect(deal.resolutionNote).to.contain("no dispute");
    });

    it("emits FundsReleased and prevents double settlement", async function () {
      const { escrow, seller, stranger } = await loadFixture(deliveredFixture);
      await time.increase(301);
      const distance = (await escrow.getDeal(1)).distanceMeters;

      await expect(escrow.connect(stranger).releaseFunds(1))
        .to.emit(escrow, "FundsReleased")
        .withArgs(1n, seller.address, ONE_ETH, distance, stranger.address);

      await expect(escrow.connect(stranger).releaseFunds(1)).to.be.revertedWith(
        "Delivery is not verified"
      );
    });

    it("cannot release while a dispute is active", async function () {
      const { escrow, buyer, stranger } = await loadFixture(deliveredFixture);
      await escrow.connect(buyer).raiseDispute(1, REASON);
      await time.increase(301);

      await expect(escrow.connect(stranger).releaseFunds(1)).to.be.revertedWith(
        "Delivery is not verified"
      );
    });

    it("requires a verified delivery", async function () {
      const { escrow, stranger } = await loadFixture(fundedDealFixture);
      await expect(escrow.connect(stranger).releaseFunds(1)).to.be.revertedWith(
        "Delivery is not verified"
      );
    });
  });

  describe("Disputes and automatic resolution (thesis Alg. 4)", function () {
    it("lets the buyer raise a dispute with a reason", async function () {
      const { escrow, buyer } = await loadFixture(deliveredFixture);

      await expect(escrow.connect(buyer).raiseDispute(1, REASON))
        .to.emit(escrow, "DisputeRaised")
        .withArgs(1n, buyer.address, REASON, anyValue);

      const deal = await escrow.getDeal(1);
      expect(deal.state).to.equal(State.DISPUTED);
      expect(deal.disputeRaised).to.equal(true);
      expect(deal.disputeReason).to.equal(REASON);
    });

    it("only the buyer can raise a dispute and only once", async function () {
      const { escrow, buyer, seller, stranger } = await loadFixture(deliveredFixture);

      await expect(escrow.connect(seller).raiseDispute(1, REASON)).to.be.revertedWith(
        "Only the buyer can raise a dispute"
      );
      await expect(escrow.connect(stranger).raiseDispute(1, REASON)).to.be.revertedWith(
        "Only the buyer can raise a dispute"
      );

      await escrow.connect(buyer).raiseDispute(1, REASON);
      await expect(escrow.connect(buyer).raiseDispute(1, REASON)).to.be.revertedWith(
        "Dispute already raised"
      );
    });

    it("requires a non-empty reason", async function () {
      const { escrow, buyer } = await loadFixture(deliveredFixture);
      await expect(escrow.connect(buyer).raiseDispute(1, "")).to.be.revertedWith(
        "Dispute reason is required"
      );
    });

    it("pays the seller when the delivery happened within the threshold", async function () {
      const { escrow, buyer, seller, stranger } = await loadFixture(deliveredFixture);
      await escrow.connect(buyer).raiseDispute(1, REASON);

      await expect(escrow.connect(stranger).autoResolveDispute(1)).to.changeEtherBalance(
        seller,
        ONE_ETH
      );

      const deal = await escrow.getDeal(1);
      expect(deal.state).to.equal(State.COMPLETED);
      expect(deal.distanceMeters).to.be.lessThanOrEqual(200n);
      expect(deal.resolutionNote).to.contain("within the distance threshold");
    });

    it("refunds the buyer when the delivery happened outside the threshold", async function () {
      const context = await otpGeneratedFixture();
      const { escrow, buyer, deliveryAgent, stranger } = context;
      const otp = await readOtp(escrow, 1);
      await escrow
        .connect(deliveryAgent)
        .verifyOTP(1, otp, FAR_AGENT_LOCATION[0], FAR_AGENT_LOCATION[1]);
      await escrow.connect(buyer).raiseDispute(1, REASON);

      await expect(escrow.connect(stranger).autoResolveDispute(1)).to.changeEtherBalance(
        buyer,
        ONE_ETH
      );

      const deal = await escrow.getDeal(1);
      expect(deal.state).to.equal(State.REFUNDED);
      expect(deal.distanceMeters).to.be.greaterThan(200n);
      expect(deal.resolutionNote).to.contain("outside the distance threshold");
    });

    it("escalates the dispute when the OTP was never verified", async function () {
      const { escrow, buyer, stranger } = await loadFixture(fundedDealFixture);
      await escrow.connect(buyer).raiseDispute(1, REASON);

      await expect(escrow.connect(stranger).autoResolveDispute(1)).to.emit(
        escrow,
        "DisputeEscalated"
      );

      const deal = await escrow.getDeal(1);
      expect(deal.state).to.equal(State.ESCALATED);
      expect(await escrow.getEscalatedDealIds()).to.deep.equal([1n]);
      expect(deal.disputeReason).to.equal(REASON);
    });

    it("escalates the dispute when the buyer location is unknown", async function () {
      const { escrow, buyer, seller, deliveryAgent, stranger } = await loadFixture(deployFixture);
      await escrow
        .connect(buyer)
        .createDeal(seller.address, deliveryAgent.address, { value: ONE_ETH });
      await escrow.connect(deliveryAgent).generateOTP(1);
      const otp = await readOtp(escrow, 1);
      await escrow
        .connect(deliveryAgent)
        .verifyOTP(1, otp, NEAR_AGENT_LOCATION[0], NEAR_AGENT_LOCATION[1]);
      await escrow.connect(buyer).raiseDispute(1, REASON);

      await escrow.connect(stranger).autoResolveDispute(1);
      expect((await escrow.getDeal(1)).state).to.equal(State.ESCALATED);
    });

    it("requires an active dispute", async function () {
      const { escrow, stranger } = await loadFixture(deliveredFixture);
      await expect(escrow.connect(stranger).autoResolveDispute(1)).to.be.revertedWith(
        "No active dispute for this deal"
      );
    });

    it("can be escalated manually by a party", async function () {
      const { escrow, buyer, stranger } = await loadFixture(deliveredFixture);
      await escrow.connect(buyer).raiseDispute(1, REASON);

      await expect(escrow.connect(stranger).escalateDispute(1)).to.be.revertedWith(
        "Not allowed to escalate this dispute"
      );

      await expect(escrow.connect(buyer).escalateDispute(1)).to.emit(
        escrow,
        "DisputeEscalated"
      );
      expect((await escrow.getDeal(1)).state).to.equal(State.ESCALATED);
    });
  });

  describe("Escrow agent manual resolution", function () {
    async function escalatedFixture() {
      const context = await fundedDealFixture();
      await context.escrow.connect(context.buyer).raiseDispute(1, REASON);
      // No OTP was verified, so the automatic rule escalates the case.
      await context.escrow.connect(context.stranger).autoResolveDispute(1);
      return context;
    }

    it("only the escrow agent can resolve", async function () {
      const { escrow, buyer, seller, stranger } = await loadFixture(escalatedFixture);
      for (const account of [buyer, seller, stranger]) {
        await expect(
          escrow.connect(account).resolveDispute(1, true, "Refund")
        ).to.be.revertedWith("Only the escrow agent can resolve a dispute");
      }
    });

    it("can refund the buyer", async function () {
      const { escrow, owner, buyer } = await loadFixture(escalatedFixture);

      await expect(escrow.connect(owner).resolveDispute(1, true, "Product not delivered"))
        .to.emit(escrow, "BuyerRefunded")
        .withArgs(1n, buyer.address, ONE_ETH, 0n, owner.address);

      const deal = await escrow.getDeal(1);
      expect(deal.state).to.equal(State.REFUNDED);
      expect(deal.resolutionNote).to.equal("Product not delivered");
      expect(deal.resolvedBy).to.equal(owner.address);
      expect(deal.amount).to.equal(0n);
      expect(await escrow.getEscalatedDealIds()).to.deep.equal([]);
    });

    it("can release the funds to the seller", async function () {
      const { escrow, owner, seller } = await loadFixture(escalatedFixture);

      await expect(
        escrow.connect(owner).resolveDispute(1, false, "Delivery confirmed by the logs")
      ).to.changeEtherBalance(seller, ONE_ETH);

      const deal = await escrow.getDeal(1);
      expect(deal.state).to.equal(State.COMPLETED);
      expect(deal.resolutionNote).to.equal("Delivery confirmed by the logs");
    });

    it("can resolve a disputed deal before it is escalated", async function () {
      const { escrow, owner, buyer } = await loadFixture(deliveredFixture);
      await escrow.connect(buyer).raiseDispute(1, "Wrong product received");

      await escrow.connect(owner).resolveDispute(1, false, "Agent reviewed the delivery proof");
      expect((await escrow.getDeal(1)).state).to.equal(State.COMPLETED);
    });

    it("cannot resolve a deal without a dispute", async function () {
      const { escrow, owner } = await loadFixture(deliveredFixture);
      await expect(escrow.connect(owner).resolveDispute(1, true, "Refund")).to.be.revertedWith(
        "No active dispute for this deal"
      );
    });
  });

  describe("Owner configuration", function () {
    it("updates the distance threshold", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await expect(escrow.connect(owner).setDistanceThreshold(500))
        .to.emit(escrow, "DistanceThresholdUpdated")
        .withArgs(500n);
      expect(await escrow.distanceThresholdMeters()).to.equal(500n);
    });

    it("updates the dispute window", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await expect(escrow.connect(owner).setDisputeWindow(86400))
        .to.emit(escrow, "DisputeWindowUpdated")
        .withArgs(86400n);
      expect(await escrow.disputeWindowSeconds()).to.equal(86400n);
    });

    it("updates the escrow agent and the new agent can resolve", async function () {
      const { escrow, owner, buyer, stranger } = await loadFixture(deliveredFixture);
      await escrow.connect(owner).setEscrowAgent(stranger.address);
      expect(await escrow.escrowAgent()).to.equal(stranger.address);

      await escrow.connect(buyer).raiseDispute(1, REASON);
      await escrow.connect(stranger).resolveDispute(1, true, "Refund approved");
      expect((await escrow.getDeal(1)).state).to.equal(State.REFUNDED);
    });

    it("rejects non-owner updates and invalid values", async function () {
      const { escrow, stranger } = await loadFixture(deployFixture);
      await expect(escrow.connect(stranger).setDistanceThreshold(500)).to.be.revertedWith(
        "Only owner can perform this action"
      );
      await expect(escrow.connect(stranger).setDisputeWindow(10)).to.be.revertedWith(
        "Only owner can perform this action"
      );
      await expect(
        escrow.connect(stranger).setEscrowAgent(stranger.address)
      ).to.be.revertedWith("Only owner can perform this action");

      const { escrow: fresh, owner } = await loadFixture(deployFixture);
      await expect(fresh.connect(owner).setDistanceThreshold(0)).to.be.revertedWith(
        "Threshold must be greater than zero"
      );
      await expect(fresh.connect(owner).setDisputeWindow(0)).to.be.revertedWith(
        "Dispute window must be greater than zero"
      );
      await expect(fresh.connect(owner).setEscrowAgent(ethers.ZeroAddress)).to.be.revertedWith(
        "Escrow agent cannot be zero address"
      );
    });

    it("exposes the configuration in one call", async function () {
      const { escrow, owner } = await loadFixture(deliveredFixture);
      const config = await escrow.getEscrowConfig();
      expect(config.ownerAddress).to.equal(owner.address);
      expect(config.escrowAgentAddress).to.equal(owner.address);
      expect(config.distanceThreshold).to.equal(200n);
      expect(config.disputeWindow).to.equal(300n);
      expect(config.totalDeals).to.equal(1n);
    });
  });
});
