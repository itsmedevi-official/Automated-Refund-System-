const { ethers } = require("ethers");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
const escrowContractAddress = process.env.ESCROW_CONTRACT;

const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

const escrowAbi = [
  "event OTPVerified(address indexed buyer)", 
  "function releaseFunds() external",
  "function fundsDeposited() public view returns (bool)",
  "function disputeRaised() public view returns (bool)",
  "function depositTimeStamp() public view returns (uint256)",
];

const escrowContract = new ethers.Contract(escrowContractAddress, escrowAbi, adminWallet);

escrowContract.on("OTPVerified", async (buyer) => {
  console.log(`OTP verified for buyer: ${buyer}`);
  
  console.log("⏳ Waiting for auto-release timer...");
  await new Promise(resolve => setTimeout(resolve, 60 * 1000)); 
  
  try {
    const depositTimeStamp = await escrowContract.depositTimeStamp();
    const fundsDeposited = await escrowContract.fundsDeposited();
    const disputeRaised = await escrowContract.disputeRaised();
    const currentTime = Math.floor(Date.now() / 1000);

    // Check conditions before releasing funds
    if (fundsDeposited && !disputeRaised && currentTime >= Number(depositTimeStamp) + 60) {
      console.log("Timer expired! Initiating fund release...");

      const tx = await escrowContract.releaseFunds();
      await tx.wait();

      console.log("Funds released successfully!");
    } else {
      console.log("Conditions not met for fund release.");
    }
  } catch (error) {
    console.error("❌ Error in fund release:", error);
  }
});

// Keep script running
console.log("Listening for OTP verification events...");
