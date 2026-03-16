"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxBuilder = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ethers_1 = require("ethers");
const constants_1 = require("./constants");
// ArenaRouter wrapper contract (deployed by you, collects 0.3% fee)
const ARENA_ROUTER = process.env.ARENA_ROUTER || "";
// Minimal ABI for the ArenaRouter wrapper contract
const ARENA_ROUTER_ABI = [
    "function buyArena(tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, uint256 amountOutMin, uint256 deadline) payable returns (uint256 arenaOut)",
    "function feeBps() view returns (uint256)",
];
class TxBuilder {
    constructor(rpcUrl) {
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl || constants_1.RPC_URL, undefined, { staticNetwork: true, batchMaxCount: 1 });
        this.arenaToken = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN), constants_1.ERC20_ABI, this.provider);
        this.lbQuoter = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.LB_QUOTER), constants_1.LB_QUOTER_ABI, this.provider);
        this.launchContract = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.LAUNCH_CONTRACT), constants_1.LAUNCH_CONTRACT_ABI, this.provider);
        this.tokenManager = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.TOKEN_MANAGER), constants_1.TOKEN_MANAGER_ABI, this.provider);
        this.avaxHelper = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.AVAX_HELPER), constants_1.AVAX_HELPER_ABI, this.provider);
        if (ARENA_ROUTER) {
            this.routerContract = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(ARENA_ROUTER), ARENA_ROUTER_ABI, this.provider);
        }
        else {
            this.routerContract = null;
        }
    }
    get routerAddress() {
        return ARENA_ROUTER;
    }
    /** Get a quote: how much ARENA for a given AVAX amount (buy) */
    async getQuote(avaxAmount) {
        const amountIn = ethers_1.ethers.parseEther(avaxAmount);
        const fee = (amountIn * 30n) / 10000n; // 0.3%
        const netAmount = amountIn - fee;
        const route = [constants_1.WAVAX, constants_1.ARENA_TOKEN];
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
        const arenaOut = quote.amounts[quote.amounts.length - 1];
        const decimals = await this.arenaToken.decimals();
        return {
            arenaOut: ethers_1.ethers.formatUnits(arenaOut, decimals),
            fee: ethers_1.ethers.formatEther(fee),
            netAvax: ethers_1.ethers.formatEther(netAmount),
        };
    }
    /** Get a sell quote: how much AVAX for a given ARENA amount */
    async getSellQuote(arenaAmount) {
        const decimals = await this.arenaToken.decimals();
        const amountIn = ethers_1.ethers.parseUnits(arenaAmount, decimals);
        const route = [constants_1.ARENA_TOKEN, constants_1.WAVAX];
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
        const avaxOut = quote.amounts[quote.amounts.length - 1];
        return {
            avaxOut: ethers_1.ethers.formatEther(avaxOut),
            arenaIn: arenaAmount,
        };
    }
    /** Get wallet balances */
    async getBalances(wallet) {
        const [avax, arena] = await Promise.all([
            this.provider.getBalance(wallet),
            this.arenaToken.balanceOf(wallet),
        ]);
        const decimals = await this.arenaToken.decimals();
        return {
            avax: ethers_1.ethers.formatEther(avax),
            arena: ethers_1.ethers.formatUnits(arena, decimals),
        };
    }
    /** Get staking info for a wallet */
    async getStakeInfo(wallet) {
        const staking = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_STAKING), constants_1.ARENA_STAKING_ABI, this.provider);
        const decimals = await this.arenaToken.decimals();
        const [stakedRaw] = await staking.getUserInfo(wallet, ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN));
        const pendingRaw = await staking.pendingReward(wallet, ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN));
        return {
            stakedAmount: ethers_1.ethers.formatUnits(stakedRaw, decimals),
            pendingRewards: ethers_1.ethers.formatUnits(pendingRaw, decimals),
        };
    }
    /**
     * Build unsigned tx to buy ARENA through the ArenaRouter (0.3% fee).
     */
    async buildBuyTx(wallet, avaxAmount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        if (!ARENA_ROUTER)
            throw new Error("ARENA_ROUTER contract not configured");
        const amountIn = ethers_1.ethers.parseEther(avaxAmount);
        const fee = (amountIn * 30n) / 10000n;
        const netAmount = amountIn - fee;
        const route = [constants_1.WAVAX, constants_1.ARENA_TOKEN];
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
        const expectedOut = quote.amounts[quote.amounts.length - 1];
        const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour for agents
        const path = {
            pairBinSteps: [...quote.binSteps].map((b) => b.toString()),
            versions: [...quote.versions].map((v) => Number(v)),
            tokenPath: [...route],
        };
        const iface = new ethers_1.ethers.Interface(ARENA_ROUTER_ABI);
        const data = iface.encodeFunctionData("buyArena", [path, amountOutMin, deadline]);
        return {
            to: ethers_1.ethers.getAddress(ARENA_ROUTER),
            data,
            value: ethers_1.ethers.toBeHex(amountIn, 32),
            chainId: 43114,
            gas: "500000",
            gasLimit: "500000",
            description: `Buy ARENA with ${avaxAmount} AVAX (0.3% fee: ${ethers_1.ethers.formatEther(fee)} AVAX). IMPORTANT: Use gasLimit 500000 — default gas estimates are too low for DEX swaps.`,
        };
    }
    /**
     * Build unsigned txs to sell ARENA for AVAX via LFJ DEX: [approve, swap]
     */
    async buildSellArenaTx(wallet, arenaAmount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        const decimals = await this.arenaToken.decimals();
        let sellAmount;
        if (arenaAmount === "max") {
            sellAmount = await this.arenaToken.balanceOf(wallet);
            if (sellAmount === 0n)
                throw new Error("No ARENA balance to sell");
        }
        else {
            sellAmount = ethers_1.ethers.parseUnits(arenaAmount, decimals);
        }
        // Get quote for ARENA → AVAX
        const route = [constants_1.ARENA_TOKEN, constants_1.WAVAX];
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, sellAmount);
        const expectedOut = quote.amounts[quote.amounts.length - 1];
        const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const path = {
            pairBinSteps: [...quote.binSteps].map((b) => b.toString()),
            versions: [...quote.versions].map((v) => Number(v)),
            tokenPath: [...route],
        };
        // Tx 1: Approve ARENA to LB Router
        const approveIface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
        const approveData = approveIface.encodeFunctionData("approve", [
            ethers_1.ethers.getAddress(constants_1.LB_ROUTER), sellAmount,
        ]);
        const approveTx = {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN),
            data: approveData,
            value: "0",
            chainId: 43114,
            gas: "60000",
            gasLimit: "60000",
            description: `Approve ${ethers_1.ethers.formatUnits(sellAmount, decimals)} ARENA for swap`,
        };
        // Tx 2: Swap ARENA → AVAX via LFJ
        const swapIface = new ethers_1.ethers.Interface(constants_1.LB_ROUTER_ABI);
        const swapData = swapIface.encodeFunctionData("swapExactTokensForNATIVE", [
            sellAmount, amountOutMin, path, wallet, deadline,
        ]);
        const swapTx = {
            to: ethers_1.ethers.getAddress(constants_1.LB_ROUTER),
            data: swapData,
            value: "0",
            chainId: 43114,
            gas: "500000",
            gasLimit: "500000",
            description: `Sell ${ethers_1.ethers.formatUnits(sellAmount, decimals)} ARENA for ~${ethers_1.ethers.formatEther(expectedOut)} AVAX`,
        };
        return [approveTx, swapTx];
    }
    /**
     * Build unsigned tx to approve ARENA for staking.
     */
    async buildApproveStakingTx(wallet, amount) {
        const decimals = await this.arenaToken.decimals();
        let approveAmount;
        if (amount === "max") {
            approveAmount = await this.arenaToken.balanceOf(wallet);
        }
        else {
            approveAmount = ethers_1.ethers.parseUnits(amount, decimals);
        }
        const iface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
        const data = iface.encodeFunctionData("approve", [ethers_1.ethers.getAddress(constants_1.ARENA_STAKING), approveAmount]);
        return {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN),
            data,
            value: "0",
            chainId: 43114,
            gas: "60000",
            gasLimit: "60000",
            description: `Approve ${ethers_1.ethers.formatUnits(approveAmount, decimals)} ARENA for staking`,
        };
    }
    /**
     * Build unsigned tx to stake ARENA.
     */
    async buildStakeTx(wallet, amount) {
        const decimals = await this.arenaToken.decimals();
        let stakeAmount;
        if (amount === "max") {
            stakeAmount = await this.arenaToken.balanceOf(wallet);
        }
        else {
            stakeAmount = ethers_1.ethers.parseUnits(amount, decimals);
        }
        const iface = new ethers_1.ethers.Interface(constants_1.ARENA_STAKING_ABI);
        const data = iface.encodeFunctionData("deposit", [stakeAmount]);
        return {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_STAKING),
            data,
            value: "0",
            chainId: 43114,
            gas: "300000",
            gasLimit: "300000",
            description: `Stake ${ethers_1.ethers.formatUnits(stakeAmount, decimals)} ARENA`,
        };
    }
    /**
     * Build unsigned tx to unstake ARENA.
     */
    async buildUnstakeTx(wallet, amount) {
        const decimals = await this.arenaToken.decimals();
        const staking = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_STAKING), constants_1.ARENA_STAKING_ABI, this.provider);
        let withdrawAmount;
        if (amount === "max") {
            const [stakedRaw] = await staking.getUserInfo(wallet, ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN));
            withdrawAmount = stakedRaw;
        }
        else {
            withdrawAmount = ethers_1.ethers.parseUnits(amount, decimals);
        }
        const iface = new ethers_1.ethers.Interface(constants_1.ARENA_STAKING_ABI);
        const data = iface.encodeFunctionData("withdraw", [withdrawAmount]);
        return {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_STAKING),
            data,
            value: "0",
            chainId: 43114,
            gas: "300000",
            gasLimit: "300000",
            description: `Unstake ${ethers_1.ethers.formatUnits(withdrawAmount, decimals)} ARENA`,
        };
    }
    /**
     * Build full buy-and-stake flow (3 transactions).
     */
    async buildBuyAndStakeTxs(wallet, avaxAmount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        const buyTx = await this.buildBuyTx(wallet, avaxAmount, slippageBps);
        // Approve max uint256 so any amount received from buy can be staked
        const iface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
        const approveData = iface.encodeFunctionData("approve", [
            ethers_1.ethers.getAddress(constants_1.ARENA_STAKING),
            ethers_1.ethers.MaxUint256,
        ]);
        const approveTx = {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN),
            data: approveData,
            value: "0",
            chainId: 43114,
            description: "Approve ARENA for staking (unlimited)",
        };
        // Estimate ARENA output for the stake tx description
        const amountIn = ethers_1.ethers.parseEther(avaxAmount);
        const fee = (amountIn * 30n) / 10000n;
        const netAmount = amountIn - fee;
        const route = [constants_1.WAVAX, constants_1.ARENA_TOKEN];
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
        const expectedOut = quote.amounts[quote.amounts.length - 1];
        const decimals = await this.arenaToken.decimals();
        // Stake tx: use "max" to stake entire ARENA balance (agent must execute AFTER buy confirms)
        const stakingIface = new ethers_1.ethers.Interface(constants_1.ARENA_STAKING_ABI);
        // We can't use "max" at build time since the buy hasn't happened yet,
        // so we use the estimated amount from the quote
        const stakeData = stakingIface.encodeFunctionData("deposit", [expectedOut]);
        const stakeTx = {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_STAKING),
            data: stakeData,
            value: "0",
            chainId: 43114,
            description: `Stake ~${ethers_1.ethers.formatUnits(expectedOut, decimals)} ARENA`,
        };
        return [
            { ...buyTx, description: `Step 1/3: ${buyTx.description}` },
            { ...approveTx, description: `Step 2/3: ${approveTx.description}` },
            { ...stakeTx, description: `Step 3/3: ${stakeTx.description}` },
        ];
    }
    /** Broadcast a signed transaction */
    async broadcast(signedTx) {
        const txResponse = await this.provider.broadcastTransaction(signedTx);
        const receipt = await txResponse.wait();
        if (receipt && receipt.status === 0) {
            throw new Error(`Transaction reverted on-chain: ${txResponse.hash}`);
        }
        return txResponse.hash;
    }
    // ─── Launchpad Helpers ───
    isArenaPaired(tokenId) {
        return BigInt(tokenId) >= constants_1.ARENA_PAIRED_THRESHOLD;
    }
    getContract(tokenId) {
        return this.isArenaPaired(tokenId) ? this.tokenManager : this.launchContract;
    }
    /** Binary search: find max tokens purchasable with given AVAX budget (AVAX-paired only) */
    async binarySearchTokenAmount(avaxBudgetWei, tokenId) {
        let maxForSale;
        try {
            maxForSale = await this.launchContract.getMaxTokensForSale(tokenId);
        }
        catch {
            maxForSale = 100000000n * constants_1.GRANULARITY_SCALER;
        }
        const maxWhole = maxForSale / constants_1.GRANULARITY_SCALER;
        if (maxWhole <= 0n)
            return 0n;
        let lo = 1n;
        let hi = maxWhole;
        let best = 0n;
        for (let i = 0; i < 30 && lo <= hi; i++) {
            const mid = (lo + hi) / 2n;
            try {
                const cost = await this.launchContract.calculateCostWithFees(mid, tokenId);
                if (cost <= avaxBudgetWei) {
                    best = mid;
                    lo = mid + 1n;
                }
                else {
                    hi = mid - 1n;
                }
            }
            catch {
                hi = mid - 1n;
            }
        }
        return best > 0n ? best * constants_1.GRANULARITY_SCALER : 0n;
    }
    // ─── Launchpad Read-Only Methods ───
    /** Get comprehensive token info by ID */
    async getTokenInfo(tokenId) {
        const contract = this.getContract(tokenId);
        const id = BigInt(tokenId);
        const arenaPaired = this.isArenaPaired(tokenId);
        const [params, supply, maxForSale] = await Promise.all([
            contract.getTokenParameters(id),
            contract.tokenSupply(id),
            contract.getMaxTokensForSale(id),
        ]);
        const tokenAddress = params.tokenContractAddress;
        if (tokenAddress === ethers_1.ethers.ZeroAddress)
            throw new Error(`Token ID ${tokenId} not found`);
        const token = new ethers_1.ethers.Contract(tokenAddress, constants_1.ERC20_ABI, this.provider);
        let name = "Unknown", symbol = "UNKNOWN";
        try {
            [name, symbol] = await Promise.all([token.name(), token.symbol()]);
        }
        catch { }
        // Price per token: calculateCostWithFees takes amount in WHOLE tokens (not wei)
        let priceAvax = "0";
        const graduated = params.lpDeployed;
        if (!graduated) {
            try {
                const costOf1 = await contract.calculateCostWithFees(1n, id);
                priceAvax = ethers_1.ethers.formatEther(costOf1);
            }
            catch { }
        }
        // Amount sold on bonding curve:
        // tokenSupply = total minted (always 10B), NOT amount sold
        // saleAllocation = totalSupply * salePercentage / 100 (tokens available for curve sale)
        // amountSold = saleAllocation - maxForSale (remaining)
        const salePerc = BigInt(params.salePercentage);
        const saleAllocation = (supply * salePerc) / 100n;
        const amountSold = saleAllocation > maxForSale ? saleAllocation - maxForSale : 0n;
        // Market cap = amountSold * pricePerToken
        const soldWhole = Number(amountSold / constants_1.GRANULARITY_SCALER);
        const priceNum = parseFloat(priceAvax);
        const marketCap = soldWhole * priceNum;
        // Graduation progress = amountSold / saleAllocation * 100
        const graduationProgress = saleAllocation > 0n
            ? Number((amountSold * 10000n) / saleAllocation) / 100
            : 0;
        return {
            tokenId,
            type: arenaPaired ? "ARENA-paired" : "AVAX-paired",
            name,
            symbol,
            tokenAddress,
            creator: params.creatorAddress,
            priceAvax,
            marketCapAvax: marketCap.toFixed(4),
            graduationProgress: `${graduationProgress.toFixed(2)}%`,
            graduated,
            amountSold: ethers_1.ethers.formatUnits(amountSold, 18),
            totalSupply: ethers_1.ethers.formatUnits(supply, 18),
            saleAllocation: ethers_1.ethers.formatUnits(saleAllocation, 18),
            remainingForSale: ethers_1.ethers.formatUnits(maxForSale, 18),
            curveParams: {
                a: params.a.toString(),
                b: params.b.toString(),
                curveScaler: params.curveScaler.toString(),
            },
            creatorFeeBps: params.creatorFeeBasisPoints.toString(),
            lpPercentage: params.lpPercentage.toString(),
            salePercentage: params.salePercentage.toString(),
        };
    }
    /** Get smart quote for buying or selling a launchpad token */
    async getTokenQuote(tokenId, amount, side) {
        const contract = this.getContract(tokenId);
        const id = BigInt(tokenId);
        const arenaPaired = this.isArenaPaired(tokenId);
        if (side === "buy") {
            const avaxWei = ethers_1.ethers.parseEther(amount);
            if (!arenaPaired) {
                // AVAX-paired: binary search for exact token amount
                const tokenAmountWei = await this.binarySearchTokenAmount(avaxWei, id);
                if (tokenAmountWei === 0n)
                    return { tokenId, side, avaxIn: amount, tokensOut: "0", note: "Insufficient liquidity or token sold out" };
                const exactCost = await this.launchContract.calculateCostWithFees(tokenAmountWei / constants_1.GRANULARITY_SCALER, id);
                return {
                    tokenId, side,
                    avaxIn: ethers_1.ethers.formatEther(exactCost),
                    tokensOut: ethers_1.ethers.formatUnits(tokenAmountWei, 18),
                };
            }
            else {
                // ARENA-paired: helper auto-converts AVAX→ARENA→tokens, exact output at execution
                return {
                    tokenId, side,
                    avaxIn: amount,
                    tokensOut: "determined at execution (ARENA-paired, helper converts automatically)",
                };
            }
        }
        else {
            // Sell: calculate AVAX/ARENA reward
            const tokenAmountWei = ethers_1.ethers.parseUnits(amount, 18);
            const reward = await contract.calculateRewardWithFees(tokenAmountWei, id);
            return {
                tokenId, side,
                tokenAmount: amount,
                rewardAvax: arenaPaired ? undefined : ethers_1.ethers.formatEther(reward),
                rewardArena: arenaPaired ? ethers_1.ethers.formatUnits(reward, 18) : undefined,
                note: arenaPaired ? "Reward is in ARENA. Use AVAX Helper to convert to AVAX." : undefined,
            };
        }
    }
    /** Get launchpad token balance for a wallet */
    async getTokenBalance(wallet, tokenId) {
        const contract = this.getContract(tokenId);
        const params = await contract.getTokenParameters(BigInt(tokenId));
        const tokenAddress = params.tokenContractAddress;
        if (tokenAddress === ethers_1.ethers.ZeroAddress)
            throw new Error(`Token ID ${tokenId} not found`);
        const token = new ethers_1.ethers.Contract(tokenAddress, constants_1.ERC20_ABI, this.provider);
        const balance = await token.balanceOf(wallet);
        return {
            wallet,
            tokenId,
            tokenAddress,
            balance: ethers_1.ethers.formatUnits(balance, 18),
        };
    }
    /** Get recent token launches */
    async getRecentLaunches(count = 10, type = "all") {
        const results = [];
        const fetchToken = async (id, contract, pairType) => {
            try {
                const params = await contract.getTokenParameters(id);
                if (params.tokenContractAddress === ethers_1.ethers.ZeroAddress)
                    return null;
                const token = new ethers_1.ethers.Contract(params.tokenContractAddress, constants_1.ERC20_ABI, this.provider);
                let name = "Unknown", symbol = "UNKNOWN";
                try {
                    [name, symbol] = await Promise.all([token.name(), token.symbol()]);
                }
                catch { }
                const supply = await contract.tokenSupply(id);
                const maxForSale = await contract.getMaxTokensForSale(id);
                const saleAlloc = (supply * BigInt(params.salePercentage)) / 100n;
                const sold = saleAlloc > maxForSale ? saleAlloc - maxForSale : 0n;
                const gradProgress = saleAlloc > 0n ? Number((sold * 10000n) / saleAlloc) / 100 : 0;
                return {
                    tokenId: id.toString(),
                    type: pairType,
                    name, symbol,
                    tokenAddress: params.tokenContractAddress,
                    creator: params.creatorAddress,
                    graduated: params.lpDeployed,
                    graduationProgress: `${gradProgress.toFixed(2)}%`,
                    amountSold: ethers_1.ethers.formatUnits(sold, 18),
                };
            }
            catch {
                return null;
            }
        };
        if (type === "all" || type === "avax") {
            const latestAvax = await this.launchContract.tokenIdentifier();
            const avaxCount = type === "all" ? Math.ceil(count / 2) : count;
            const avaxPromises = [];
            for (let i = 0; i < avaxCount && latestAvax - BigInt(i) > 0n; i++) {
                avaxPromises.push(fetchToken(latestAvax - BigInt(i) - 1n, this.launchContract, "AVAX-paired"));
            }
            results.push(...(await Promise.all(avaxPromises)).filter(Boolean));
        }
        if (type === "all" || type === "arena") {
            const latestArena = await this.tokenManager.tokenIdentifier();
            const arenaCount = type === "all" ? Math.ceil(count / 2) : count;
            const arenaPromises = [];
            for (let i = 0; i < arenaCount && latestArena - BigInt(i) >= constants_1.ARENA_PAIRED_THRESHOLD; i++) {
                arenaPromises.push(fetchToken(latestArena - BigInt(i) - 1n, this.tokenManager, "ARENA-paired"));
            }
            results.push(...(await Promise.all(arenaPromises)).filter(Boolean));
        }
        return results.slice(0, count);
    }
    /** Search for a token by contract address */
    async searchToken(query) {
        // Search by contract address across both contracts
        const searchContract = async (contract, label) => {
            const latest = await contract.tokenIdentifier();
            const start = label === "ARENA-paired" ? constants_1.ARENA_PAIRED_THRESHOLD : 1n;
            // Search last 200 tokens
            for (let id = latest - 1n; id >= start && id >= latest - 200n; id--) {
                try {
                    const params = await contract.getTokenParameters(id);
                    if (params.tokenContractAddress.toLowerCase() === query.toLowerCase()) {
                        return id.toString();
                    }
                }
                catch {
                    continue;
                }
            }
            return null;
        };
        const [avaxResult, arenaResult] = await Promise.all([
            searchContract(this.launchContract, "AVAX-paired"),
            searchContract(this.tokenManager, "ARENA-paired"),
        ]);
        const foundId = avaxResult || arenaResult;
        if (!foundId)
            throw new Error(`Token not found for address ${query} in recent launches`);
        return this.getTokenInfo(foundId);
    }
    /** Get tokens closest to graduating (deploying LP) */
    async getGraduating(count = 5) {
        const candidates = [];
        const checkBatch = async (contract, label) => {
            const latest = await contract.tokenIdentifier();
            const start = label === "ARENA-paired" ? constants_1.ARENA_PAIRED_THRESHOLD : 1n;
            const promises = [];
            for (let i = 0; i < 100 && latest - BigInt(i) - 1n >= start; i++) {
                const id = latest - BigInt(i) - 1n;
                promises.push((async () => {
                    try {
                        const params = await contract.getTokenParameters(id);
                        if (params.lpDeployed)
                            return null;
                        const supply = await contract.tokenSupply(id);
                        const maxForSale = await contract.getMaxTokensForSale(id);
                        const saleAlloc = (supply * BigInt(params.salePercentage)) / 100n;
                        if (saleAlloc === 0n)
                            return null;
                        const sold = saleAlloc > maxForSale ? saleAlloc - maxForSale : 0n;
                        const progress = Number((sold * 10000n) / saleAlloc) / 100;
                        if (progress < 0.5)
                            return null; // skip near-empty tokens
                        const token = new ethers_1.ethers.Contract(params.tokenContractAddress, constants_1.ERC20_ABI, this.provider);
                        let name = "Unknown", symbol = "UNKNOWN";
                        try {
                            [name, symbol] = await Promise.all([token.name(), token.symbol()]);
                        }
                        catch { }
                        return { tokenId: id.toString(), progress, info: { name, symbol, type: label, tokenAddress: params.tokenContractAddress, graduationProgress: `${progress.toFixed(2)}%`, amountSold: ethers_1.ethers.formatUnits(sold, 18) } };
                    }
                    catch {
                        return null;
                    }
                })());
            }
            return (await Promise.all(promises)).filter(Boolean);
        };
        const [avax, arena] = await Promise.all([
            checkBatch(this.launchContract, "AVAX-paired"),
            checkBatch(this.tokenManager, "ARENA-paired"),
        ]);
        candidates.push(...avax, ...arena);
        candidates.sort((a, b) => b.progress - a.progress);
        return candidates.slice(0, count).map(c => ({ ...c.info, tokenId: c.tokenId }));
    }
    /** Get agent's portfolio (tracked positions) */
    async getPortfolio(wallet, tokenIds) {
        if (tokenIds.length === 0)
            return { wallet, positions: [], totalValueAvax: "0" };
        const positions = [];
        let totalValue = 0;
        const checks = tokenIds.map(async (tid) => {
            try {
                const tokenId = tid.toString();
                const contract = this.getContract(tokenId);
                const params = await contract.getTokenParameters(BigInt(tokenId));
                if (params.tokenContractAddress === ethers_1.ethers.ZeroAddress)
                    return null;
                const token = new ethers_1.ethers.Contract(params.tokenContractAddress, constants_1.ERC20_ABI, this.provider);
                const balance = await token.balanceOf(wallet);
                if (balance === 0n)
                    return null;
                let name = "Unknown", symbol = "UNKNOWN";
                try {
                    [name, symbol] = await Promise.all([token.name(), token.symbol()]);
                }
                catch { }
                let valueAvax = "0";
                if (!params.lpDeployed) {
                    try {
                        const reward = await contract.calculateRewardWithFees(balance, BigInt(tokenId));
                        valueAvax = ethers_1.ethers.formatEther(reward);
                    }
                    catch { }
                }
                return {
                    tokenId, name, symbol,
                    tokenAddress: params.tokenContractAddress,
                    balance: ethers_1.ethers.formatUnits(balance, 18),
                    valueAvax,
                    graduated: params.lpDeployed,
                };
            }
            catch {
                return null;
            }
        });
        const results = (await Promise.all(checks)).filter(Boolean);
        for (const pos of results) {
            positions.push(pos);
            totalValue += parseFloat(pos.valueAvax);
        }
        return { wallet, positions, totalValueAvax: totalValue.toFixed(6) };
    }
    /** Get recent Buy/Sell activity for a token */
    async getActivity(tokenId, count = 20) {
        const contract = this.getContract(tokenId);
        const id = BigInt(tokenId);
        const currentBlock = await this.provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 5000);
        const [buyEvents, sellEvents] = await Promise.all([
            contract.queryFilter(contract.filters.Buy(null, id), fromBlock, currentBlock),
            contract.queryFilter(contract.filters.Sell(null, id), fromBlock, currentBlock),
        ]);
        const arenaPaired = this.isArenaPaired(tokenId);
        const formatAmount = (v) => arenaPaired ? ethers_1.ethers.formatUnits(v, 18) : ethers_1.ethers.formatEther(v);
        const events = [
            ...buyEvents.map((e) => ({
                type: "buy",
                user: e.args.user,
                tokenAmount: ethers_1.ethers.formatUnits(e.args.tokenAmount, 18),
                cost: formatAmount(e.args.cost),
                block: e.blockNumber,
            })),
            ...sellEvents.map((e) => ({
                type: "sell",
                user: e.args.user,
                tokenAmount: ethers_1.ethers.formatUnits(e.args.tokenAmount, 18),
                reward: formatAmount(e.args.reward),
                block: e.blockNumber,
            })),
        ];
        events.sort((a, b) => b.block - a.block);
        return { tokenId, events: events.slice(0, count) };
    }
    /** Get platform overview */
    async getOverview() {
        const [avaxLatest, arenaLatest, protocolFeeAvax, protocolFeeArena] = await Promise.all([
            this.launchContract.tokenIdentifier(),
            this.tokenManager.tokenIdentifier(),
            this.launchContract.protocolFeeBasisPoint(),
            this.tokenManager.protocolFeeBasisPoint(),
        ]);
        return {
            totalAvaxPairedTokens: (avaxLatest - 1n).toString(),
            totalArenaPairedTokens: (arenaLatest - constants_1.ARENA_PAIRED_THRESHOLD).toString(),
            totalTokens: ((avaxLatest - 1n) + (arenaLatest - constants_1.ARENA_PAIRED_THRESHOLD)).toString(),
            protocolFeeBps: {
                avaxPaired: protocolFeeAvax.toString(),
                arenaPaired: protocolFeeArena.toString(),
            },
            contracts: {
                launchContract: constants_1.LAUNCH_CONTRACT,
                tokenManager: constants_1.TOKEN_MANAGER,
                avaxHelper: constants_1.AVAX_HELPER,
            },
        };
    }
    /** Get market cap for a token */
    async getMarketCap(tokenId) {
        const info = await this.getTokenInfo(tokenId);
        return {
            tokenId,
            name: info.name,
            symbol: info.symbol,
            priceAvax: info.priceAvax,
            marketCapAvax: info.marketCapAvax,
            amountSold: info.amountSold,
            graduated: info.graduated,
            graduationProgress: info.graduationProgress,
        };
    }
    // ─── Launchpad Transaction Builders ───
    /** Build unsigned tx to buy a launchpad token */
    async buildLaunchpadBuyTx(wallet, tokenId, avaxAmount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        const id = BigInt(tokenId);
        const avaxWei = ethers_1.ethers.parseEther(avaxAmount);
        const arenaPaired = this.isArenaPaired(tokenId);
        const contract = this.getContract(tokenId);
        // Guard: check if graduated
        const params = await contract.getTokenParameters(id);
        if (params.lpDeployed)
            throw new Error("Token has graduated to DEX — trade on a DEX instead");
        if (!arenaPaired) {
            // AVAX-paired: binary search for token amount, then buyAndCreateLpIfPossible
            const tokenAmountWei = await this.binarySearchTokenAmount(avaxWei, id);
            if (tokenAmountWei === 0n)
                throw new Error("Cannot calculate buy amount — token may be sold out");
            const iface = new ethers_1.ethers.Interface(constants_1.LAUNCH_CONTRACT_ABI);
            const data = iface.encodeFunctionData("buyAndCreateLpIfPossible", [tokenAmountWei, id]);
            return {
                to: ethers_1.ethers.getAddress(constants_1.LAUNCH_CONTRACT),
                data,
                value: ethers_1.ethers.toBeHex(avaxWei, 32),
                chainId: 43114,
                gas: "500000",
                gasLimit: "500000",
                description: `Buy ~${ethers_1.ethers.formatUnits(tokenAmountWei, 18)} tokens (ID ${tokenId}) with ${avaxAmount} AVAX`,
            };
        }
        else {
            // ARENA-paired: use AVAX Helper (auto-converts AVAX→ARENA→tokens)
            const iface = new ethers_1.ethers.Interface(constants_1.AVAX_HELPER_ABI);
            const data = iface.encodeFunctionData("buyAndCreateLpIfPossibleWithAvax", [id, 0n]);
            return {
                to: ethers_1.ethers.getAddress(constants_1.AVAX_HELPER),
                data,
                value: ethers_1.ethers.toBeHex(avaxWei, 32),
                chainId: 43114,
                gas: "500000",
                gasLimit: "500000",
                description: `Buy tokens (ID ${tokenId}) with ${avaxAmount} AVAX via ARENA Helper`,
            };
        }
    }
    /** Build unsigned txs to sell a launchpad token: [approve, sell] */
    async buildLaunchpadSellTx(wallet, tokenId, amount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        const id = BigInt(tokenId);
        const arenaPaired = this.isArenaPaired(tokenId);
        const contract = this.getContract(tokenId);
        const params = await contract.getTokenParameters(id);
        if (params.lpDeployed)
            throw new Error("Token has graduated to DEX — trade on a DEX instead");
        const tokenAddress = params.tokenContractAddress;
        if (tokenAddress === ethers_1.ethers.ZeroAddress)
            throw new Error(`Token ID ${tokenId} not found`);
        // Determine sell amount
        const token = new ethers_1.ethers.Contract(tokenAddress, constants_1.ERC20_ABI, this.provider);
        let sellAmount;
        if (amount === "max") {
            sellAmount = await token.balanceOf(wallet);
        }
        else {
            sellAmount = ethers_1.ethers.parseUnits(amount, 18);
        }
        if (sellAmount === 0n)
            throw new Error("Zero balance — nothing to sell");
        // Align to granularity for AVAX-paired
        if (!arenaPaired) {
            sellAmount = (sellAmount / constants_1.GRANULARITY_SCALER) * constants_1.GRANULARITY_SCALER;
            if (sellAmount === 0n)
                throw new Error("Balance too small to sell (must be at least 1 whole token unit)");
        }
        // Determine spender
        const spender = arenaPaired ? ethers_1.ethers.getAddress(constants_1.AVAX_HELPER) : ethers_1.ethers.getAddress(constants_1.LAUNCH_CONTRACT);
        // Approve tx
        const erc20Iface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
        const approveData = erc20Iface.encodeFunctionData("approve", [spender, ethers_1.ethers.MaxUint256]);
        const approveTx = {
            to: tokenAddress,
            data: approveData,
            value: "0",
            chainId: 43114,
            gas: "60000",
            gasLimit: "60000",
            description: `Step 1/2: Approve token for selling`,
        };
        // Sell tx
        let sellData;
        let sellTo;
        if (!arenaPaired) {
            const iface = new ethers_1.ethers.Interface(constants_1.LAUNCH_CONTRACT_ABI);
            sellData = iface.encodeFunctionData("sell", [sellAmount, id]);
            sellTo = ethers_1.ethers.getAddress(constants_1.LAUNCH_CONTRACT);
        }
        else {
            // Calculate minAvaxOut with slippage
            let minOut = 0n;
            try {
                const reward = await contract.calculateRewardWithFees(sellAmount, id);
                minOut = reward - (reward * BigInt(slippageBps)) / 10000n;
            }
            catch { }
            const iface = new ethers_1.ethers.Interface(constants_1.AVAX_HELPER_ABI);
            sellData = iface.encodeFunctionData("sellToAvax", [id, sellAmount, minOut]);
            sellTo = ethers_1.ethers.getAddress(constants_1.AVAX_HELPER);
        }
        const sellTx = {
            to: sellTo,
            data: sellData,
            value: "0",
            chainId: 43114,
            gas: "500000",
            gasLimit: "500000",
            description: `Step 2/2: Sell ${ethers_1.ethers.formatUnits(sellAmount, 18)} tokens (ID ${tokenId})`,
        };
        return [approveTx, sellTx];
    }
}
exports.TxBuilder = TxBuilder;
//# sourceMappingURL=txbuilder.js.map