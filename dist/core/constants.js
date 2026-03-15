"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVAX_HELPER_ABI = exports.TOKEN_MANAGER_ABI = exports.LAUNCH_CONTRACT_ABI = exports.GRANULARITY_SCALER = exports.ARENA_PAIRED_THRESHOLD = exports.AVAX_HELPER = exports.TOKEN_MANAGER = exports.LAUNCH_CONTRACT = exports.LB_QUOTER_ABI = exports.LB_ROUTER_ABI = exports.ARENA_STAKING_ABI = exports.ERC20_ABI = exports.DEFAULT_SLIPPAGE_BPS = exports.LB_QUOTER = exports.LB_ROUTER = exports.ARENA_STAKING = exports.WAVAX = exports.ARENA_TOKEN = exports.RPC_URL = exports.CHAIN_ID = void 0;
// Avalanche C-Chain
exports.CHAIN_ID = 43114;
exports.RPC_URL = process.env.RPC_URL || "https://hardworking-dawn-sailboat.avalanche-mainnet.quiknode.pro/022a54c6e74f3463167816f37d1f2ad5ae91af21/ext/bc/C/rpc/";
// Token addresses
exports.ARENA_TOKEN = "0xB8d7710f7d8349A506b75dD184F05777c82dAd0C";
exports.WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
// Arena staking (UUPS proxy → ArenaStaking implementation)
exports.ARENA_STAKING = "0xeffb809d99142ce3b51c1796c096f5b01b4aaec4";
// LFJ (Trader Joe) V2.2 on Avalanche C-Chain
exports.LB_ROUTER = "0x18556DA13313f3532c54711497A8FedAC273220E";
exports.LB_QUOTER = "0x9A550a522BBaDFB69019b0432800Ed17855A51C3";
// Default slippage: 5% (agents may have delay between quote and broadcast)
exports.DEFAULT_SLIPPAGE_BPS = 500;
// ABIs — minimal interfaces for the functions we need
exports.ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function totalSupply() view returns (uint256)",
];
exports.ARENA_STAKING_ABI = [
    "function deposit(uint256 _amount)",
    "function withdraw(uint256 _amount)",
    "function emergencyWithdraw()",
    "function pendingReward(address _user, address _token) view returns (uint256)",
    "function getUserInfo(address _user, address _rewardToken) view returns (uint256, uint256)",
    "function rewardTokensLength() view returns (uint256)",
    "event Deposit(address indexed user, uint256 amount, uint256 fee)",
    "event Withdraw(address indexed user, uint256 amount)",
    "event ClaimReward(address indexed user, address indexed rewardToken, uint256 amount)",
    "event EmergencyWithdraw(address indexed user, uint256 amount)",
];
// LFJ LBRouter V2.2 — swapExactNATIVEForTokens
exports.LB_ROUTER_ABI = [
    "function swapExactNATIVEForTokens(uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) payable returns (uint256 amountOut)",
    "function swapExactTokensForNATIVE(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address payable to, uint256 deadline) returns (uint256 amountOut)",
    "function getSwapOut(address lbPair, uint128 amountIn, bool swapForY) view returns (uint128 amountInLeft, uint128 amountOut, uint128 fee)",
];
exports.LB_QUOTER_ABI = [
    "function findBestPathFromAmountIn(address[] calldata route, uint128 amountIn) view returns (tuple(address[] route, address[] pairs, uint256[] binSteps, uint256[] versions, uint128[] amounts, uint128[] virtualAmountsWithoutSlippage, uint128[] fees) quote)",
];
// ─── Arena Launchpad Contracts ───
// AVAX-paired token launches (tokenId < 100B)
exports.LAUNCH_CONTRACT = "0x8315f1eb449Dd4B779495C3A0b05e5d194446c6e";
// ARENA-paired token launches (tokenId >= 100B)
exports.TOKEN_MANAGER = "0x2196e106af476f57618373ec028924767c758464";
// Routes AVAX↔ARENA for Token Manager buys/sells
exports.AVAX_HELPER = "0x03f1a18519abedbef210fa44e13b71fec01b8dfa";
// Token ID threshold: IDs below this are AVAX-paired (Launch Contract), above are ARENA-paired (Token Manager)
exports.ARENA_PAIRED_THRESHOLD = 100000000000n;
// All token amounts on the bonding curve must be multiples of this
exports.GRANULARITY_SCALER = 10n ** 18n;
exports.LAUNCH_CONTRACT_ABI = [
    "function buyAndCreateLpIfPossible(uint256 amount, uint256 tokenId) payable",
    "function sell(uint256 amount, uint256 tokenId)",
    "function calculateCostWithFees(uint256 amountInToken, uint256 tokenId) view returns (uint256)",
    "function calculateRewardWithFees(uint256 amount, uint256 tokenId) view returns (uint256)",
    "function getMaxTokensForSale(uint256 tokenId) view returns (uint256)",
    "function tokenSupply(uint256 tokenId) view returns (uint256)",
    "function getTokenParameters(uint256 tokenId) view returns (uint128 curveScaler, uint16 a, uint8 b, bool lpDeployed, uint8 lpPercentage, uint8 salePercentage, uint8 creatorFeeBasisPoints, address creatorAddress, address pairAddress, address tokenContractAddress)",
    "function tokenIdentifier() view returns (uint256)",
    "function protocolFeeBasisPoint() view returns (uint256)",
    "event TokenCreated(uint256 indexed tokenId, tuple(uint128 curveScaler, uint16 a, uint8 b, bool lpDeployed, uint8 lpPercentage, uint8 salePercentage, uint8 creatorFeeBasisPoints, address creatorAddress, address pairAddress, address tokenContractAddress) params, uint256 tokenSupply)",
    "event Buy(address indexed user, uint256 indexed tokenId, uint256 tokenAmount, uint256 cost, uint256 tokenSupply, address referrerAddress, uint256 referralFee, uint256 creatorFee, uint256 protocolFee)",
    "event Sell(address indexed user, uint256 indexed tokenId, uint256 tokenAmount, uint256 reward, uint256 tokenSupply, address referrerAddress, uint256 referralFee, uint256 creatorFee, uint256 protocolFee)",
    "event TokenLPCreated(uint256 indexed tokenId, uint256 amountToken, uint256 amountAVAX, uint256 liquidity)",
];
exports.TOKEN_MANAGER_ABI = [
    "function calculateCostWithFees(uint256 amountInToken, uint256 tokenId) view returns (uint256)",
    "function calculateRewardWithFees(uint256 amount, uint256 tokenId) view returns (uint256)",
    "function getMaxTokensForSale(uint256 tokenId) view returns (uint256)",
    "function tokenSupply(uint256 tokenId) view returns (uint256)",
    "function getTokenParameters(uint256 tokenId) view returns (uint128 curveScaler, uint32 a, uint8 b, bool lpDeployed, uint8 lpPercentage, uint8 salePercentage, uint8 creatorFeeBasisPoints, address creatorAddress, address pairAddress, address tokenContractAddress)",
    "function tokenIdentifier() view returns (uint256)",
    "function protocolFeeBasisPoint() view returns (uint256)",
    "event Buy(address indexed user, uint256 indexed tokenId, uint256 tokenAmount, uint256 cost, uint256 tokenSupply, address referrerAddress, uint256 referralFee, uint256 creatorFee, uint256 protocolFee)",
    "event Sell(address indexed user, uint256 indexed tokenId, uint256 tokenAmount, uint256 reward, uint256 tokenSupply, address referrerAddress, uint256 referralFee, uint256 creatorFee, uint256 protocolFee)",
];
exports.AVAX_HELPER_ABI = [
    "function buyAndCreateLpIfPossibleWithAvax(uint256 tokenId, uint256 amountOutMin) payable returns (uint256)",
    "function sellToAvax(uint256 tokenId, uint256 amount, uint256 amountOutAvaxMin) returns (uint256)",
];
//# sourceMappingURL=constants.js.map