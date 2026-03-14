// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IWAVAX {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface ILBRouter {
    struct Path {
        uint256[] pairBinSteps;
        uint8[] versions;
        address[] tokenPath;
    }

    function swapExactNATIVEForTokens(
        uint256 amountOutMin,
        Path memory path,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountOut);
}

interface IArenaStaking {
    function deposit(uint256 _amount) external;
}

contract ArenaRouter {
    address public owner;
    uint256 public feeBps = 30; // 0.3%

    ILBRouter public immutable lbRouter;
    IERC20 public immutable arenaToken;
    IArenaStaking public immutable arenaStaking;
    address public immutable wavax;

    event Buy(address indexed user, uint256 avaxIn, uint256 fee, uint256 arenaOut);
    event BuyAndStake(address indexed user, uint256 avaxIn, uint256 fee, uint256 arenaStaked);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event OwnerUpdated(address oldOwner, address newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(
        address _lbRouter,
        address _arenaToken,
        address _arenaStaking,
        address _wavax
    ) {
        owner = msg.sender;
        lbRouter = ILBRouter(_lbRouter);
        arenaToken = IERC20(_arenaToken);
        arenaStaking = IArenaStaking(_arenaStaking);
        wavax = _wavax;
    }

    /// @notice Buy ARENA with AVAX. 0.3% fee is deducted, rest is swapped.
    /// @param path LFJ swap path (pairBinSteps, versions, tokenPath)
    /// @param amountOutMin Minimum ARENA to receive (slippage protection)
    /// @param deadline Transaction deadline timestamp
    function buyArena(
        ILBRouter.Path calldata path,
        uint256 amountOutMin,
        uint256 deadline
    ) external payable returns (uint256 arenaOut) {
        require(msg.value > 0, "no AVAX sent");

        // Take fee
        uint256 fee = (msg.value * feeBps) / 10000;
        uint256 swapAmount = msg.value - fee;

        // Send fee to owner
        (bool sent, ) = owner.call{value: fee}("");
        require(sent, "fee transfer failed");

        // Swap AVAX -> ARENA via LFJ, tokens go directly to user
        arenaOut = lbRouter.swapExactNATIVEForTokens{value: swapAmount}(
            amountOutMin,
            path,
            msg.sender,
            deadline
        );

        emit Buy(msg.sender, msg.value, fee, arenaOut);
    }

    /// @notice Buy ARENA with AVAX and send to user (for staking in a follow-up tx).
    ///         Staking must be done separately from the user's wallet so it's credited to them.
    ///         The API builds a multi-tx flow: buyArena → approve staking → deposit.
    // buyAndStake is handled at the API level as a multi-transaction flow:
    // 1. User calls buyArena() on this contract → gets ARENA
    // 2. User calls approve() on ARENA token → approves staking contract
    // 3. User calls deposit() on staking contract → stakes ARENA under their address

    /// @notice Update fee (max 1%)
    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 100, "fee too high"); // max 1%
        emit FeeUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    /// @notice Transfer ownership
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "zero address");
        emit OwnerUpdated(owner, _newOwner);
        owner = _newOwner;
    }

    /// @notice Withdraw stuck tokens
    function sweep(address _token, address _to) external onlyOwner {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transfer(_to, balance);
    }

    /// @notice Withdraw stuck AVAX
    function sweepAVAX(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    receive() external payable {}
}
