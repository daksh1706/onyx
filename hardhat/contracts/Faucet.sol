// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Faucet
 * @dev Dispenses MYC and Mock INR to users once per 24 hours.
 */
contract Faucet is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable myCoin;
    IERC20 public immutable mockInr;
    IERC20 public immutable customToken;

    uint256 public constant FAUCET_AMOUNT_MYC = 100 * 10**18;  // 100 MYC (18 decimals)
    uint256 public constant FAUCET_AMOUNT_INR = 100 * 10**6;   // 100 INR (6 decimals)
    uint256 public constant FAUCET_AMOUNT_CUSTOM = 100 * 10**18; // 100 ONYX (18 decimals)
    uint256 public constant COOLDOWN_TIME = 24 hours;

    // Track the next time an address can request tokens
    mapping(address => uint256) public nextAccessTime;

    event TokensDispensed(address indexed receiver, uint256 amountMyc, uint256 amountInr, uint256 amountCustom);

    // Custom errors
    error InvalidAddress();
    error CooldownActive();
    error InsufficientFaucetBalance(address token, uint256 available, uint256 required);

    constructor(
        address _myCoin,
        address _mockInr,
        address _customToken,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_myCoin == address(0) || _mockInr == address(0) || _customToken == address(0)) {
            revert InvalidAddress();
        }
        myCoin = IERC20(_myCoin);
        mockInr = IERC20(_mockInr);
        customToken = IERC20(_customToken);
    }

    /**
     * @dev Dispenses tokens to the sender. Enforces a 24-hour cooldown.
     */
     function requestTokens() external nonReentrant {
        if (block.timestamp < nextAccessTime[msg.sender]) {
            revert CooldownActive();
        }
        
        nextAccessTime[msg.sender] = block.timestamp + COOLDOWN_TIME;

        uint256 balMyc = myCoin.balanceOf(address(this));
        if (balMyc < FAUCET_AMOUNT_MYC) {
            revert InsufficientFaucetBalance(address(myCoin), balMyc, FAUCET_AMOUNT_MYC);
        }

        uint256 balInr = mockInr.balanceOf(address(this));
        if (balInr < FAUCET_AMOUNT_INR) {
            revert InsufficientFaucetBalance(address(mockInr), balInr, FAUCET_AMOUNT_INR);
        }

        uint256 balCustom = customToken.balanceOf(address(this));
        if (balCustom < FAUCET_AMOUNT_CUSTOM) {
            revert InsufficientFaucetBalance(address(customToken), balCustom, FAUCET_AMOUNT_CUSTOM);
        }

        myCoin.safeTransfer(msg.sender, FAUCET_AMOUNT_MYC);
        mockInr.safeTransfer(msg.sender, FAUCET_AMOUNT_INR);
        customToken.safeTransfer(msg.sender, FAUCET_AMOUNT_CUSTOM);

        emit TokensDispensed(msg.sender, FAUCET_AMOUNT_MYC, FAUCET_AMOUNT_INR, FAUCET_AMOUNT_CUSTOM);
    }

    /**
     * @dev Allows the owner to withdraw tokens from the faucet (e.g. for upgrading/decommissioning).
     * @param token Address of the token to withdraw.
     * @param amount Amount of tokens to withdraw.
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            revert InvalidAddress();
        }
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
