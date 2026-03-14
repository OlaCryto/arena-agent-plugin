import hre from "hardhat";
import { ethers } from "ethers";

async function main() {
  // Use ethers.getAddress() to compute correct EIP-55 checksums
  const LB_ROUTER = ethers.getAddress("0x18556da13313f3532c54711497a8fedac273220e");
  const ARENA_TOKEN = ethers.getAddress("0xb8d7710f7d8349a506b75dd184f05777c82dad0c");
  const ARENA_STAKING = ethers.getAddress("0xeffb809d99142ce3b51c1796c096f5b01b4aaec4");
  const WAVAX = ethers.getAddress("0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7");

  console.log("Deploying ArenaRouter...");

  const ArenaRouter = await hre.ethers.getContractFactory("ArenaRouter");
  const router = await ArenaRouter.deploy(LB_ROUTER, ARENA_TOKEN, ARENA_STAKING, WAVAX);
  await router.waitForDeployment();

  const address = await router.getAddress();
  console.log(`ArenaRouter deployed to: ${address}`);
  console.log(`\nAdd this to your .env:`);
  console.log(`ARENA_ROUTER=${address}`);

  console.log(`\nWaiting 30s for block confirmations before verification...`);
  await new Promise((r) => setTimeout(r, 30000));

  console.log("Verifying on Snowtrace...");
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: [LB_ROUTER, ARENA_TOKEN, ARENA_STAKING, WAVAX],
    });
    console.log("Contract verified!");
  } catch (err: any) {
    console.log("Verification failed (you can retry manually):", err.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
