require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { RPC_URL, PRIVATE_KEY } = process.env;

/**
 * Networks used by the project:
 *  - hardhat   : in-process chain used by `npx hardhat test` and the demo script
 *  - localhost : the `npx hardhat node` chain used with MetaMask (free, no real ETH)
 *  - sepolia   : optional, only configured when RPC_URL + PRIVATE_KEY exist
 */
const networks = {
  hardhat: {
    chainId: 31337,
  },
  localhost: {
    url: "http://127.0.0.1:8545",
    chainId: 31337,
  },
};

if (RPC_URL && PRIVATE_KEY) {
  networks.sepolia = {
    url: RPC_URL,
    accounts: [PRIVATE_KEY],
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks,
  mocha: {
    timeout: 120000,
  },
};

