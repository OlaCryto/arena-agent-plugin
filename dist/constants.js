"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LB_QUOTER_ABI = exports.LB_ROUTER_ABI = exports.ARENA_STAKING_ABI = exports.ERC20_ABI = exports.DEFAULT_SLIPPAGE_BPS = exports.LB_QUOTER = exports.LB_ROUTER = exports.ARENA_STAKING = exports.WAVAX = exports.ARENA_TOKEN = exports.RPC_URL = exports.CHAIN_ID = void 0;
// Avalanche C-Chain
exports.CHAIN_ID = 43114;
exports.RPC_URL = process.env.RPC_URL || "https://api.avax.network/ext/bc/C/rpc";
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
//# sourceMappingURL=constants.js.map