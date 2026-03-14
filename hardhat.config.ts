import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const SNOWSCAN_API_KEY = process.env.SNOWSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
    },
  },
  networks: {
    avalanche: {
      url: process.env.RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`] : [],
    },
  },
  etherscan: {
    apiKey: SNOWSCAN_API_KEY || "abc",
  },
  sourcify: {
    enabled: true,
  },
};

export default config;
