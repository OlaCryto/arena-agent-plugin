// ── Avalanche C-Chain ──
export const CHAIN_ID = 43114;

// ── Token Addresses ──
export const ARENA_TOKEN = "0xB8d7710f7d8349A506b75dD184F05777c82dAd0C";
export const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";

// ── Arena Staking ──
export const ARENA_STAKING = "0xeffb809d99142ce3b51c1796c096f5b01b4aaec4";

// ── LFJ (Trader Joe) V2.2 ──
export const LB_ROUTER = "0x18556DA13313f3532c54711497A8FedAC273220E";
export const LB_QUOTER = "0x9A550a522BBaDFB69019b0432800Ed17855A51C3";

// ── Arena Launchpad Contracts ──
export const LAUNCH_CONTRACT = "0x8315f1eb449Dd4B779495C3A0b05e5d194446c6e";
export const TOKEN_MANAGER = "0x2196e106af476f57618373ec028924767c758464";
export const AVAX_HELPER = "0x03f1a18519abedbef210fa44e13b71fec01b8dfa";
export const ARENA_PAIRED_THRESHOLD = 100_000_000_000n;
export const GRANULARITY_SCALER = 10n ** 18n;

// ── Arena Tickets (Shares) ──
export const ARENA_SHARES_CONTRACT = "0xc605c2cf66ee98ea925b1bb4fea584b71c00cc4c";
export const FRACTION_SCALER = 100;

// ── External APIs ──
export const ARENA_SOCIAL_API = "https://api.starsarena.com";
export const LIFI_API = "https://li.quest/v1";
export const HL_INFO = "https://api.hyperliquid.xyz/info";

// ── Hyperliquid Deposit (Arbitrum) ──
export const HL_DEPOSIT_ADDRESS = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
export const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
export const ARBITRUM_CHAIN_ID = 42161;
export const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";

// ── Default Settings ──
export const DEFAULT_SLIPPAGE_BPS = 500;

// ── ABIs ──

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
];

export const ARENA_STAKING_ABI = [
  "function deposit(uint256 _amount)",
  "function withdraw(uint256 _amount)",
  "function emergencyWithdraw()",
  "function pendingReward(address _user, address _token) view returns (uint256)",
  "function getUserInfo(address _user, address _rewardToken) view returns (uint256, uint256)",
  "function rewardTokensLength() view returns (uint256)",
];

export const LB_ROUTER_ABI = [
  "function swapExactNATIVEForTokens(uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) payable returns (uint256 amountOut)",
  "function swapExactTokensForNATIVE(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address payable to, uint256 deadline) returns (uint256 amountOut)",
];

export const LB_QUOTER_ABI = [
  "function findBestPathFromAmountIn(address[] calldata route, uint128 amountIn) view returns (tuple(address[] route, address[] pairs, uint256[] binSteps, uint256[] versions, uint128[] amounts, uint128[] virtualAmountsWithoutSlippage, uint128[] fees) quote)",
];

export const LAUNCH_CONTRACT_ABI = [
  "function createToken(uint16 a, uint8 b, uint128 curveScaler, uint8 creatorFeeBasisPoints, address tokenCreatorAddress, uint256 tokenSplit, string name, string symbol, uint256 amount) payable",
  "function buyAndCreateLpIfPossible(uint256 amount, uint256 tokenId) payable",
  "function sell(uint256 amount, uint256 tokenId)",
  "function calculateCostWithFees(uint256 amountInToken, uint256 tokenId) view returns (uint256)",
  "function calculateRewardWithFees(uint256 amount, uint256 tokenId) view returns (uint256)",
  "function getMaxTokensForSale(uint256 tokenId) view returns (uint256)",
  "function tokenSupply(uint256 tokenId) view returns (uint256)",
  "function getTokenParameters(uint256 tokenId) view returns (uint128 curveScaler, uint16 a, uint8 b, bool lpDeployed, uint8 lpPercentage, uint8 salePercentage, uint8 creatorFeeBasisPoints, address creatorAddress, address pairAddress, address tokenContractAddress)",
  "function tokenIdentifier() view returns (uint256)",
  "function protocolFeeBasisPoint() view returns (uint256)",
  "event Buy(address indexed user, uint256 indexed tokenId, uint256 tokenAmount, uint256 cost, uint256 tokenSupply, address referrerAddress, uint256 referralFee, uint256 creatorFee, uint256 protocolFee)",
  "event Sell(address indexed user, uint256 indexed tokenId, uint256 tokenAmount, uint256 reward, uint256 tokenSupply, address referrerAddress, uint256 referralFee, uint256 creatorFee, uint256 protocolFee)",
];

export const TOKEN_MANAGER_ABI = [
  "function createToken(uint32 a, uint8 b, uint128 curveScaler, uint8 creatorFeeBasisPoints, address tokenCreatorAddress, uint256 tokenSplit, string name, string symbol, uint256 amount)",
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

export const AVAX_HELPER_ABI = [
  "function buyAndCreateLpIfPossibleWithAvax(uint256 tokenId, uint256 amountOutMin) payable returns (uint256)",
  "function sellToAvax(uint256 tokenId, uint256 amount, uint256 amountOutAvaxMin) returns (uint256)",
];

export const SHARES_ABI = [
  "function buyFractionalShares(address sharesSubject, address user, uint256 amount) payable",
  "function sellFractionalShares(address sharesSubject, address user, uint256 amount) payable",
  "function getBuyPriceForFractionalSharesAfterFee(address sharesSubject, uint256 amount) view returns (uint256)",
  "function getSellPriceForFractionalSharesAfterFee(address sharesSubject, uint256 amount) view returns (uint256)",
  "function getBuyPriceForFractionalShares(address sharesSubject, uint256 amount) view returns (uint256)",
  "function getSellPriceForFractionalShares(address sharesSubject, uint256 amount) view returns (uint256)",
  "function getMyFractionalShares(address sharesSubject, address user) view returns (uint256)",
  "function getSharesSupply(address sharesSubject) view returns (uint256)",
  "function getTotalFractionalSupply(address sharesSubject) view returns (uint256)",
  "function fractionalSharesBalance(address, address) view returns (uint256)",
  "function protocolFeePercent() view returns (uint256)",
  "function subjectFeePercent() view returns (uint256)",
  "function referralFeePercent() view returns (uint256)",
];
