const { ethers, network } = require("hardhat");

const ROLE_HINTS = [
  "Owner / Escrow Agent (platform, deploys the contract)",
  "Buyer (creates and funds escrow deals)",
  "Seller (receives the escrowed payment)",
  "Delivery Agent (generates and verifies the OTP)",
  "Spare account for tests",
  "Spare account for tests",
  "Spare account for tests",
  "Spare account for tests",
  "Spare account for tests",
  "Spare account for tests",
];

async function main() {
  const signers = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();

  console.log(`\nNetwork: ${network.name} (chainId ${networkInfo.chainId})`);
  console.log("Import the private keys below into MetaMask (Hardhat test accounts, no real funds):\n");

  for (let index = 0; index < signers.length; index++) {
    const signer = signers[index];
    const balance = await ethers.provider.getBalance(signer.address);
    const hint = ROLE_HINTS[index] || "Spare account for tests";
    console.log(`#${index}  ${hint}`);
    console.log(`     address : ${signer.address}`);
    console.log(`     balance : ${ethers.formatEther(balance)} ETH`);
    if (process.env.SHOW_PRIVATE_KEYS === "true") {
      console.log(`     key     : ${signer.privateKey}`);
    }
  }

  console.log(
    "\nTip: set SHOW_PRIVATE_KEYS=true to print the private keys of the default Hardhat accounts."
  );
  console.log(
    "The default Hardhat mnemonic (publicly known, test only): " +
      '"test test test test test test test test test test test junk"\n'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
