"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveToken = exports.POPULAR_TOKENS = exports.DexModule = void 0;
const ethers_1 = require("ethers");
const constants_1 = require("../core/constants");
const tokens_1 = require("./tokens");
// Additional LBRouter ABI for token→token swaps
const LB_ROUTER_EXTRA_ABI = [
    ...constants_1.LB_ROUTER_ABI,
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) returns (uint256 amountOut)",
];
class DexModule {
    constructor(provider) {
        this.provider = provider;
        this.lbQuoter = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.LB_QUOTER), constants_1.LB_QUOTER_ABI, provider);
    }
    /** List all known tokens */
    getTokenList() {
        return Object.values(tokens_1.POPULAR_TOKENS);
    }
    /** Fetch on-chain token info for any address */
    async getTokenInfo(address) {
        const addr = this.checksumAddr(address);
        const token = new ethers_1.ethers.Contract(addr, constants_1.ERC20_ABI, this.provider);
        const [symbol, name, decimals] = await Promise.all([
            token.symbol(),
            token.name(),
            token.decimals(),
        ]);
        return { address: addr, symbol, name, decimals: Number(decimals) };
    }
    /** Normalize any address to proper EIP-55 checksum */
    checksumAddr(addr) {
        return ethers_1.ethers.getAddress(addr.toLowerCase());
    }
    /** Resolve a symbol or address to full token info, fetching on-chain if needed */
    async resolveTokenFull(input) {
        const known = (0, tokens_1.resolveToken)(input);
        if (known)
            return { ...known, address: this.checksumAddr(known.address) };
        if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
            return this.getTokenInfo(input);
        }
        throw new Error(`Unknown token "${input}". Use a symbol (AVAX, USDC, JOE, etc.) or a contract address (0x...).`);
    }
    /** Get a quote for any token pair */
    async getQuote(fromInput, toInput, amount) {
        const fromToken = await this.resolveTokenFull(fromInput);
        const toToken = await this.resolveTokenFull(toInput);
        const amountIn = ethers_1.ethers.parseUnits(amount, fromToken.decimals);
        // Build route — if neither token is WAVAX, route through WAVAX
        const fromAddr = fromToken.symbol === "AVAX" ? constants_1.WAVAX : fromToken.address;
        const toAddr = toToken.symbol === "AVAX" ? constants_1.WAVAX : toToken.address;
        let route;
        if (fromAddr.toLowerCase() === constants_1.WAVAX.toLowerCase() || toAddr.toLowerCase() === constants_1.WAVAX.toLowerCase()) {
            route = [fromAddr, toAddr];
        }
        else {
            route = [fromAddr, constants_1.WAVAX, toAddr];
        }
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
        const amountsArr = [...quote.amounts];
        const amountOut = amountsArr[amountsArr.length - 1];
        // Price impact: compare virtual (no-slippage) vs actual
        const virtualArr = [...quote.virtualAmountsWithoutSlippage];
        const virtualOut = virtualArr[virtualArr.length - 1];
        let impact = "0";
        if (virtualOut > 0n) {
            const impactBps = ((virtualOut - amountOut) * 10000n) / virtualOut;
            impact = (Number(impactBps) / 100).toFixed(2);
        }
        return {
            fromToken,
            toToken,
            amountIn: amount,
            amountOut: ethers_1.ethers.formatUnits(amountOut, toToken.decimals),
            route: route.map(a => {
                // Label the route with symbols
                for (const t of Object.values(tokens_1.POPULAR_TOKENS)) {
                    if (t.address.toLowerCase() === a.toLowerCase())
                        return t.symbol;
                }
                return a;
            }),
            priceImpact: impact + "%",
        };
    }
    /** Get balance of any token for a wallet */
    async getBalance(wallet, tokenInput) {
        const token = await this.resolveTokenFull(tokenInput);
        let balance;
        if (token.symbol === "AVAX" || token.symbol === "WAVAX") {
            if (tokenInput.toUpperCase() === "AVAX") {
                balance = await this.provider.getBalance(wallet);
                return { token, balance: ethers_1.ethers.formatEther(balance) };
            }
        }
        const contract = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(token.address), constants_1.ERC20_ABI, this.provider);
        balance = await contract.balanceOf(wallet);
        return { token, balance: ethers_1.ethers.formatUnits(balance, token.decimals) };
    }
    /** Build unsigned swap transaction(s) for any pair */
    async buildSwapTx(wallet, fromInput, toInput, amount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        const fromToken = await this.resolveTokenFull(fromInput);
        const toToken = await this.resolveTokenFull(toInput);
        const isFromNative = fromInput.toUpperCase() === "AVAX";
        const isToNative = toInput.toUpperCase() === "AVAX";
        const fromAddr = fromToken.symbol === "AVAX" ? constants_1.WAVAX : fromToken.address;
        const toAddr = toToken.symbol === "AVAX" ? constants_1.WAVAX : toToken.address;
        // Parse amount
        let amountIn;
        if (amount === "max") {
            if (isFromNative) {
                const bal = await this.provider.getBalance(wallet);
                // Reserve 0.05 AVAX for gas
                const reserve = ethers_1.ethers.parseEther("0.05");
                if (bal <= reserve)
                    throw new Error("AVAX balance too low (need to reserve gas)");
                amountIn = bal - reserve;
            }
            else {
                const contract = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(fromToken.address), constants_1.ERC20_ABI, this.provider);
                amountIn = await contract.balanceOf(wallet);
                if (amountIn === 0n)
                    throw new Error(`No ${fromToken.symbol} balance to sell`);
            }
        }
        else {
            amountIn = ethers_1.ethers.parseUnits(amount, fromToken.decimals);
        }
        // Build route
        let route;
        if (fromAddr.toLowerCase() === constants_1.WAVAX.toLowerCase() || toAddr.toLowerCase() === constants_1.WAVAX.toLowerCase()) {
            route = [fromAddr, toAddr];
        }
        else {
            route = [fromAddr, constants_1.WAVAX, toAddr];
        }
        // Get quote
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
        const amountsArr = [...quote.amounts];
        const expectedOut = amountsArr[amountsArr.length - 1];
        const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const path = {
            pairBinSteps: [...quote.binSteps].map((b) => b.toString()),
            versions: [...quote.versions].map((v) => Number(v)),
            tokenPath: [...route],
        };
        const txs = [];
        const iface = new ethers_1.ethers.Interface(LB_ROUTER_EXTRA_ABI);
        const displayAmountIn = amount === "max"
            ? ethers_1.ethers.formatUnits(amountIn, fromToken.decimals)
            : amount;
        const displayAmountOut = ethers_1.ethers.formatUnits(expectedOut, toToken.decimals);
        if (isFromNative) {
            // AVAX → Token: single tx, no approve needed
            const data = iface.encodeFunctionData("swapExactNATIVEForTokens", [
                amountOutMin, path, wallet, deadline,
            ]);
            txs.push({
                to: ethers_1.ethers.getAddress(constants_1.LB_ROUTER),
                data,
                value: ethers_1.ethers.toBeHex(amountIn),
                chainId: 43114,
                gas: "500000",
                gasLimit: "500000",
                description: `Swap ${displayAmountIn} AVAX for ~${displayAmountOut} ${toToken.symbol}`,
            });
        }
        else if (isToNative) {
            // Token → AVAX: approve + swap
            const approveIface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
            const approveData = approveIface.encodeFunctionData("approve", [
                ethers_1.ethers.getAddress(constants_1.LB_ROUTER), amountIn,
            ]);
            txs.push({
                to: ethers_1.ethers.getAddress(fromToken.address),
                data: approveData,
                value: "0x0",
                chainId: 43114,
                gas: "60000",
                gasLimit: "60000",
                description: `Approve ${displayAmountIn} ${fromToken.symbol} for swap`,
            });
            const data = iface.encodeFunctionData("swapExactTokensForNATIVE", [
                amountIn, amountOutMin, path, wallet, deadline,
            ]);
            txs.push({
                to: ethers_1.ethers.getAddress(constants_1.LB_ROUTER),
                data,
                value: "0x0",
                chainId: 43114,
                gas: "500000",
                gasLimit: "500000",
                description: `Swap ${displayAmountIn} ${fromToken.symbol} for ~${displayAmountOut} AVAX`,
            });
        }
        else {
            // Token → Token: approve + swap
            const approveIface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
            const approveData = approveIface.encodeFunctionData("approve", [
                ethers_1.ethers.getAddress(constants_1.LB_ROUTER), amountIn,
            ]);
            txs.push({
                to: ethers_1.ethers.getAddress(fromToken.address),
                data: approveData,
                value: "0x0",
                chainId: 43114,
                gas: "60000",
                gasLimit: "60000",
                description: `Approve ${displayAmountIn} ${fromToken.symbol} for swap`,
            });
            const data = iface.encodeFunctionData("swapExactTokensForTokens", [
                amountIn, amountOutMin, path, wallet, deadline,
            ]);
            txs.push({
                to: ethers_1.ethers.getAddress(constants_1.LB_ROUTER),
                data,
                value: "0x0",
                chainId: 43114,
                gas: "500000",
                gasLimit: "500000",
                description: `Swap ${displayAmountIn} ${fromToken.symbol} for ~${displayAmountOut} ${toToken.symbol}`,
            });
        }
        return {
            transactions: txs,
            summary: `${displayAmountIn} ${fromToken.symbol} → ~${displayAmountOut} ${toToken.symbol} (slippage: ${slippageBps / 100}%)`,
        };
    }
}
exports.DexModule = DexModule;
var tokens_2 = require("./tokens");
Object.defineProperty(exports, "POPULAR_TOKENS", { enumerable: true, get: function () { return tokens_2.POPULAR_TOKENS; } });
Object.defineProperty(exports, "resolveToken", { enumerable: true, get: function () { return tokens_2.resolveToken; } });
//# sourceMappingURL=index.js.map