"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const txbuilder_1 = require("./txbuilder");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const builder = new txbuilder_1.TxBuilder();
const server = new mcp_js_1.McpServer({
    name: "arena-plugin",
    version: "1.0.0",
});
server.tool("get_balances", "Get a wallet's AVAX and ARENA token balances on Avalanche", {
    wallet: zod_1.z.string().describe("Wallet address (0x...)"),
}, async ({ wallet }) => {
    const result = await builder.getBalances(wallet);
    return { content: [{ type: "text", text: JSON.stringify({ ...result, wallet }) }] };
});
server.tool("get_quote", "Get a price quote for buying ARENA with AVAX. Shows fee breakdown. Does not execute a trade.", {
    avaxAmount: zod_1.z.string().describe("Amount of AVAX to quote, e.g. '0.1'"),
}, async ({ avaxAmount }) => {
    const result = await builder.getQuote(avaxAmount);
    return { content: [{ type: "text", text: JSON.stringify({ avaxIn: avaxAmount, ...result }) }] };
});
server.tool("get_stake_info", "Get staking position: amount staked and pending rewards for a wallet", {
    wallet: zod_1.z.string().describe("Wallet address (0x...)"),
}, async ({ wallet }) => {
    const result = await builder.getStakeInfo(wallet);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
server.tool("build_buy_tx", "Build an unsigned transaction to buy ARENA with AVAX via ArenaRouter (0.3% fee). Returns tx data for the agent to sign locally.", {
    wallet: zod_1.z.string().describe("Buyer's wallet address"),
    avaxAmount: zod_1.z.string().describe("Amount of AVAX to spend, e.g. '0.1'"),
    slippageBps: zod_1.z.number().optional().describe("Slippage in basis points. Default 100 (1%)"),
}, async ({ wallet, avaxAmount, slippageBps }) => {
    const tx = await builder.buildBuyTx(wallet, avaxAmount, slippageBps);
    return { content: [{ type: "text", text: JSON.stringify(tx) }] };
});
server.tool("build_stake_txs", "Build unsigned transactions to stake ARENA (approve + deposit). Returns 2 txs for the agent to sign locally.", {
    wallet: zod_1.z.string().describe("Wallet address"),
    amount: zod_1.z.string().describe("Amount of ARENA to stake, or 'max' for entire balance"),
}, async ({ wallet, amount }) => {
    const approveTx = await builder.buildApproveStakingTx(wallet, amount);
    const stakeTx = await builder.buildStakeTx(wallet, amount);
    return { content: [{ type: "text", text: JSON.stringify({ transactions: [approveTx, stakeTx] }) }] };
});
server.tool("build_buy_and_stake_txs", "Build unsigned transactions to buy ARENA and stake in one flow (3 txs: buy → approve → stake). Returns tx data for local signing.", {
    wallet: zod_1.z.string().describe("Wallet address"),
    avaxAmount: zod_1.z.string().describe("Amount of AVAX to spend, e.g. '0.1'"),
    slippageBps: zod_1.z.number().optional().describe("Slippage in basis points. Default 100 (1%)"),
}, async ({ wallet, avaxAmount, slippageBps }) => {
    const txs = await builder.buildBuyAndStakeTxs(wallet, avaxAmount, slippageBps);
    return { content: [{ type: "text", text: JSON.stringify({ transactions: txs }) }] };
});
server.tool("build_unstake_tx", "Build an unsigned transaction to withdraw staked ARENA. Also claims pending rewards.", {
    wallet: zod_1.z.string().describe("Wallet address"),
    amount: zod_1.z.string().describe("Amount of ARENA to unstake, or 'max' for all"),
}, async ({ wallet, amount }) => {
    const tx = await builder.buildUnstakeTx(wallet, amount);
    return { content: [{ type: "text", text: JSON.stringify(tx) }] };
});
server.tool("broadcast_tx", "Broadcast a signed transaction to Avalanche C-Chain", {
    signedTx: zod_1.z.string().describe("The signed transaction hex string"),
}, async ({ signedTx }) => {
    const txHash = await builder.broadcast(signedTx);
    return { content: [{ type: "text", text: JSON.stringify({ txHash }) }] };
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("Arena MCP Server running on stdio");
}
main().catch(console.error);
//# sourceMappingURL=mcp.js.map