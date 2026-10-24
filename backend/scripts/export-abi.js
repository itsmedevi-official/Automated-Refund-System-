const { exportAbi } = require("./lib/exportAbi");

async function main() {
  const target = exportAbi();
  console.log(`ABI exported to ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
