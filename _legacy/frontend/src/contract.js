import { ethers } from "ethers";
import escrowAbi from "../../backend/artifacts/contracts/Escrow.sol/Escrow.json";
import  config  from "./config.json";

const contractAddress = config.contractAddress;

let provider = new ethers.BrowserProvider(window.ethereum);
let signer = await provider.getSigner();
let contract = new ethers.Contract(contractAddress, escrowAbi.abi, signer);
export default contract;

let disputeRaised = false;
let otpGenerated = false;
let otpVerified = false;



window.ethereum.on("accountsChanged", async (accounts) => {
  console.log("Account changed to:", accounts[0]);

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  contract = new ethers.Contract(contractAddress, escrowAbi.abi, signer);

  console.log("Signer updated to:", await signer.getAddress());
});

// Deposit funds function
export async function depositFunds(valueInEther) {
  try {
    const valueInWei = ethers.parseEther(valueInEther.toString());
    const tx = await contract.depositFunds({ value: valueInWei });
    await tx.wait();
    console.log(`✅ Deposit Successful: ${valueInEther} ETH`);

    // checkAndReleaseFunds();

  } catch (error) {
    console.error("Deposit failed:", error);
  }
}


export async function generateOTP() {
  try {
    const tx = await contract.generateOTP();
    await tx.wait();
    otpGenerated = true;
    console.log("✅ OTP Generated");
  } catch (error) {
    console.error("OTP Generation failed:", error);
  }
}

export async function verifyOTP(userOTP) {
  try {
    const tx = await contract.verifyOTP(userOTP);
    await tx.wait();
    otpVerified = true;
    console.log("OTP Verified! Auto transfer activated.");
    // checkAndReleaseFunds();
  } catch (error) {
    console.error("OTP Verification failed:", error);
  }
}
// export async function getUserRole() {
//   const accounts = await window.ethereum.request({ method: "eth_accounts" });
//   if (!accounts.length) return "";

//   const userAddress = accounts[0];
//   const buyer = await contract.buyer();
//   const seller = await contract.seller();
//   const admin = await contract.admin();
//   const deliveryAgent = await contract.deliveryAgent();

//   if (userAddress.toLowerCase() === buyer.toLowerCase()) return "buyer";
//   if (userAddress.toLowerCase() === seller.toLowerCase()) return "seller";
//   if (userAddress.toLowerCase() === admin.toLowerCase()) return "admin";
//   if (userAddress.toLowerCase() === deliveryAgent.toLowerCase()) return "deliveryAgent";
//   return "";
// }
// Release funds function
export async function releaseFunds() {
  try {
    const tx = await contract.releaseFunds();
    await tx.wait();
    console.log("Funds Released to Seller");
  } catch (error) {
    console.error("Release failed:", error);
  }
}

//19-2-2025 adding raise dispute and resolve dispute functions
export const raiseDispute = async (reason) => {
  try {
      const tx = await contract.raiseDispute(reason);
      await tx.wait();
      console.log("Dispute raised successfully! ${reason}");
  } catch (error) {
      console.error("Error raising dispute:", error);
  }
};

export const resolveDispute = async (refundToBuyer) => {
  try {
    const contractBalance = await provider.getBalance(contractAddress);
    console.log("Contract balance:", ethers.formatEther(contractBalance), "ETH");

    if (contractBalance <= 0) {
      console.error("Error: Contract has no funds to distribute.");
      alert("Error: Contract has no funds to distribute.");
      return;
    }
      const signerAddress = await signer.getAddress();
      console.log("Current connected address:", signerAddress);
      const adminAddress = await contract.admin();
      console.log("Admin Address from contract:", adminAddress);

      if (signerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
          throw new Error("Only admin can perform this action");
      }

      const tx = await contract.resolveDispute(refundToBuyer);
      await tx.wait();
      console.log("Dispute resolved successfully!");

      disputeRaised = false;

      console.log("Ready for next transaction...");
  } catch (error) {
      console.error("Error resolving dispute:", error);
  }
};

export async function getOTP() {
  try {
    const otp = await contract.getOTP();
    console.log("OTP Retrieved");
    return otp.toString();
  } catch (error) {
    console.error("Error fetching OTP:", error);
    return null;
  }}

export const getDisputeReason = async () => {
  try {
      const reason = await contract.disputeReason();
      console.log("Dispute reason:", reason);
  } catch (error) {
      console.error("Error getting dispute reason:", error);
  }
}



const checkAndReleaseFunds = async () => {
  await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 60 seconds

  if (!disputeRaised) {
    try {
      console.log("No dispute raised. Releasing funds to seller...");
      const tx = await contract.releaseFunds();
      await tx.wait();
      console.log("Funds released to seller after 60 seconds.");
    } catch (error) {
      console.error("Error releasing funds automatically:", error);
    }
  } else {
    console.log("Dispute raised. Waiting for manual resolution.");
  }
};



contract.on("FundsDeposited", (buyer, amount) => {
  console.log(`Funds Deposited: Buyer: ${buyer}, Amount: ${ethers.utils.formatEther(amount)} ETH`);
  // disputeRaised = false;
  // checkAndReleaseFunds();
});


contract.on("FundsReleased", (seller, amount) => {
  console.log(`Funds Released: Seller: ${seller}, Amount: ${ethers.utils.formatEther(amount)} ETH`);
});


// contract.on("BuyerRefunded", (buyer, amount) => {
//   console.log(`🔹 Refund Processed: Buyer: ${buyer}, Amount: ${ethers.formatEther(amount)} ETH`);
// });

contract.on("DisputeRaised", (buyer) => {
  console.log(`Dispute Raised by Buyer: ${buyer}`);
  disputeRaised = true;
});

contract.on("DisputeResolved", (resolver, refundToBuyer, amount) => {
  console.log(`Dispute Resolved by ${resolver}. Funds sent to ${refundToBuyer ? "Buyer" : "Seller"}: ${ethers.formatEther(amount)} ETH`);
});

contract.on("OTPGenerated", () => {
  console.log("🔹 OTP has been generated!");
  otpGenerated = true;
});

contract.on("OTPVerified", () => {
  console.log("OTP Verified! Auto transfer will proceed.");
  otpVerified = true;
});