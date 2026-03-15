// @ts-nocheck
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createProvider, broadcast } from "./core/provider";
import { SwapModule } from "./swap";
import { StakingModule } from "./staking";
import { LaunchpadModule } from "./launchpad";
import dotenv from "dotenv";

dotenv.config();

const provider = createProvider();
const swap = new SwapModule(provider);
const staking = new StakingModule(provider, swap);
const launchpad = new LaunchpadModule(provider);

const server = new McpServer({
  name: "arena-plugin",
  version: "1.0.0",
});

// ─── Swap Tools ───

server.tool("get_balances", "Get a wallet's AVAX and ARENA token balances on Avalanche", {
  wallet: z.string().describe("Wallet address (0x...)"),
}, async ({ wallet }) => {
  const result = await swap.getBalances(wallet);
  return { content: [{ type: "text", text: JSON.stringify({ ...result, wallet }) }] };
});

server.tool("get_quote", "Get a price quote for buying ARENA with AVAX. Shows fee breakdown. Does not execute a trade.", {
  avaxAmount: z.string().describe("Amount of AVAX to quote, e.g. '0.1'"),
}, async ({ avaxAmount }) => {
  const result = await swap.getQuote(avaxAmount);
  return { content: [{ type: "text", text: JSON.stringify({ avaxIn: avaxAmount, ...result }) }] };
});

server.tool("get_sell_quote", "Get a price quote for selling ARENA for AVAX.", {
  arenaAmount: z.string().describe("Amount of ARENA to sell, e.g. '1000'"),
}, async ({ arenaAmount }) => {
  const result = await swap.getSellQuote(arenaAmount);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("build_buy_tx", "Build an unsigned transaction to buy ARENA with AVAX via ArenaRouter (0.3% fee). Returns tx data for the agent to sign locally.", {
  wallet: z.string().describe("Buyer's wallet address"),
  avaxAmount: z.string().describe("Amount of AVAX to spend, e.g. '0.1'"),
  slippageBps: z.number().optional().describe("Slippage in basis points. Default 500 (5%)"),
}, async ({ wallet, avaxAmount, slippageBps }) => {
  const tx = await swap.buildBuyTx(wallet, avaxAmount, slippageBps);
  return { content: [{ type: "text", text: JSON.stringify(tx) }] };
});

server.tool("build_sell_arena_tx", "Build unsigned transactions to sell ARENA for AVAX via LFJ DEX (approve + swap). Returns 2 txs.", {
  wallet: z.string().describe("Wallet address"),
  amount: z.string().describe("Amount of ARENA to sell, or 'max' for entire balance"),
  slippageBps: z.number().optional().describe("Slippage in basis points. Default 500 (5%)"),
}, async ({ wallet, amount, slippageBps }) => {
  const txs = await swap.buildSellArenaTx(wallet, amount, slippageBps);
  return { content: [{ type: "text", text: JSON.stringify({ transactions: txs }) }] };
});

// ─── Staking Tools ───

server.tool("get_stake_info", "Get staking position: amount staked and pending rewards for a wallet", {
  wallet: z.string().describe("Wallet address (0x...)"),
}, async ({ wallet }) => {
  const result = await staking.getStakeInfo(wallet);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("build_stake_txs", "Build unsigned transactions to stake ARENA (approve + deposit). Returns 2 txs for the agent to sign locally.", {
  wallet: z.string().describe("Wallet address"),
  amount: z.string().describe("Amount of ARENA to stake, or 'max' for entire balance"),
}, async ({ wallet, amount }) => {
  const approveTx = await staking.buildApproveStakingTx(wallet, amount);
  const stakeTx = await staking.buildStakeTx(wallet, amount);
  return { content: [{ type: "text", text: JSON.stringify({ transactions: [approveTx, stakeTx] }) }] };
});

server.tool("build_buy_and_stake_txs", "Build unsigned transactions to buy ARENA and stake in one flow (3 txs: buy → approve → stake). Returns tx data for local signing.", {
  wallet: z.string().describe("Wallet address"),
  avaxAmount: z.string().describe("Amount of AVAX to spend, e.g. '0.1'"),
  slippageBps: z.number().optional().describe("Slippage in basis points. Default 500 (5%)"),
}, async ({ wallet, avaxAmount, slippageBps }) => {
  const txs = await staking.buildBuyAndStakeTxs(wallet, avaxAmount, slippageBps);
  return { content: [{ type: "text", text: JSON.stringify({ transactions: txs }) }] };
});

server.tool("build_unstake_tx", "Build an unsigned transaction to withdraw staked ARENA. Also claims pending rewards.", {
  wallet: z.string().describe("Wallet address"),
  amount: z.string().describe("Amount of ARENA to unstake, or 'max' for all"),
}, async ({ wallet, amount }) => {
  const tx = await staking.buildUnstakeTx(wallet, amount);
  return { content: [{ type: "text", text: JSON.stringify(tx) }] };
});

// ─── Launchpad Tools ───

server.tool("launchpad_overview", "Get platform overview: total tokens launched, fees, contract addresses", {}, async () => {
  const result = await launchpad.getOverview();
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("launchpad_recent", "Get recently launched tokens on Arena launchpad", {
  count: z.number().optional().describe("Number of tokens to return (default 10, max 50)"),
  type: z.enum(["all", "avax", "arena"]).optional().describe("Filter by pair type"),
}, async ({ count, type }) => {
  const result = await launchpad.getRecentLaunches(count, type);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("launchpad_graduating", "Get tokens closest to graduating (deploying LP to DEX)", {
  count: z.number().optional().describe("Number of tokens to return (default 5)"),
}, async ({ count }) => {
  const result = await launchpad.getGraduating(count);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("launchpad_token_info", "Get comprehensive info for a launchpad token by ID", {
  tokenId: z.string().describe("Token ID on the launchpad"),
}, async ({ tokenId }) => {
  const result = await launchpad.getTokenInfo(tokenId);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("launchpad_quote", "Get a buy or sell quote for a launchpad token", {
  tokenId: z.string().describe("Token ID"),
  amount: z.string().describe("AVAX amount for buy, token amount for sell"),
  side: z.enum(["buy", "sell"]).describe("Trade side"),
}, async ({ tokenId, amount, side }) => {
  const result = await launchpad.getTokenQuote(tokenId, amount, side);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("launchpad_market_cap", "Get market cap breakdown for a launchpad token", {
  tokenId: z.string().describe("Token ID"),
}, async ({ tokenId }) => {
  const result = await launchpad.getMarketCap(tokenId);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("launchpad_activity", "Get recent buy/sell activity for a launchpad token", {
  tokenId: z.string().describe("Token ID"),
  count: z.number().optional().describe("Number of events (default 20)"),
}, async ({ tokenId, count }) => {
  const result = await launchpad.getActivity(tokenId, count);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("launchpad_build_buy", "Build unsigned tx to buy a launchpad token with AVAX", {
  wallet: z.string().describe("Buyer's wallet address"),
  tokenId: z.string().describe("Token ID to buy"),
  avaxAmount: z.string().describe("Amount of AVAX to spend"),
  slippageBps: z.number().optional().describe("Slippage in basis points"),
}, async ({ wallet, tokenId, avaxAmount, slippageBps }) => {
  const tx = await launchpad.buildLaunchpadBuyTx(wallet, tokenId, avaxAmount, slippageBps);
  return { content: [{ type: "text", text: JSON.stringify(tx) }] };
});

server.tool("launchpad_build_sell", "Build unsigned txs to sell a launchpad token (approve + sell). Returns 2 txs.", {
  wallet: z.string().describe("Seller's wallet address"),
  tokenId: z.string().describe("Token ID to sell"),
  amount: z.string().describe("Amount of tokens to sell, or 'max' for all"),
  slippageBps: z.number().optional().describe("Slippage in basis points"),
}, async ({ wallet, tokenId, amount, slippageBps }) => {
  const txs = await launchpad.buildLaunchpadSellTx(wallet, tokenId, amount, slippageBps);
  return { content: [{ type: "text", text: JSON.stringify({ transactions: txs }) }] };
});

// ─── Broadcast ───

server.tool("broadcast_tx", "Broadcast a signed transaction to Avalanche C-Chain", {
  signedTx: z.string().describe("The signed transaction hex string"),
}, async ({ signedTx }) => {
  const txHash = await broadcast(provider, signedTx);
  return { content: [{ type: "text", text: JSON.stringify({ txHash }) }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Arena MCP Server running on stdio");
}

main().catch(console.error);
