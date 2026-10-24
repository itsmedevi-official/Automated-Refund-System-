const fs = require("fs");
const path = require("path");

/**
 * Copies the compiled SmartEscrow ABI into the frontend so Vite never has to read
 * files outside of its own root (the old prototype did that with an fs.allow hack).
 */
function exportAbi() {
  const artifactPath = path.join(
    __dirname,
    "..",
    "..",
    "artifacts",
    "contracts",
    "SmartEscrow.sol",
    "SmartEscrow.json"
  );
  const targetPath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "frontend",
    "src",
    "contracts",
    "SmartEscrow.json"
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error("SmartEscrow artifact not found. Run `npx hardhat compile` first.");
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(
    targetPath,
    JSON.stringify({ contractName: "SmartEscrow", abi: artifact.abi }, null, 2) + "\n",
    "utf8"
  );
  return targetPath;
}

module.exports = { exportAbi };
