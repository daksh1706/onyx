// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Faucet
 * @dev Dispenses MYC and Mock USDC to users once per 24 hours.
 */
contract Faucet is ReentrancyGuard, Ownable {
    IERC20 public immutable myCoin;
    IERC20 public immutable mockUsdc;
    IERC20 public immutable customToken;

    uint256 public constant FAUCET_AMOUNT_MYC = 100 * 10**18;  // 100 MYC (18 decimals)
    uint256 public constant FAUCET_AMOUNT_USDC = 100 * 10**6;  // 100 USDC (6 decimals)
    uint256 public constant FAUCET_AMOUNT_CUSTOM = 100 * 10**18; // 100 ONYX (18 decimals)
    uint256 public constant COOLDOWN_TIME = 24 hours;

    // Track the next time an address can request tokens
    mapping(address => uint256) public nextAccessTime;

    event TokensDispensed(address indexed receiver, uint256 amountMyc, uint256 amountUsdc, uint256 amountCustom);

    constructor(address _myCoin, address _mockUsdc, address _customToken, address _initialOwner) Ownable(_initialOwner) {
        require(_myCoin != address(0), "Faucet: Invalid MYC address");
        require(_mockUsdc != address(0), "Faucet: Invalid USDC address");
        require(_customToken != address(0), "Faucet: Invalid CustomToken address");
        myCoin = IERC20(_myCoin);
        mockUsdc = IERC20(_mockUsdc);
        customToken = IERC20(_customToken);
    }

    /**
     * @dev Dispenses tokens to the sender. Enforces a 24-hour cooldown.
     */
     function requestTokens() external nonReentrant {
        require(block.timestamp >= nextAccessTime[msg.sender], "Faucet: Cooldown active");
        
        nextAccessTime[msg.sender] = block.timestamp + COOLDOWN_TIME;

        require(myCoin.balanceOf(address(this)) >= FAUCET_AMOUNT_MYC, "Faucet: Insufficient MYC balance");
        require(mockUsdc.balanceOf(address(this)) >= FAUCET_AMOUNT_USDC, "Faucet: Insufficient USDC balance");
        require(customToken.balanceOf(address(this)) >= FAUCET_AMOUNT_CUSTOM, "Faucet: Insufficient ONYX balance");

        require(myCoin.transfer(msg.sender, FAUCET_AMOUNT_MYC), "Faucet: MYC transfer failed");
        require(mockUsdc.transfer(msg.sender, FAUCET_AMOUNT_USDC), "Faucet: USDC transfer failed");
        require(customToken.transfer(msg.sender, FAUCET_AMOUNT_CUSTOM), "Faucet: ONYX transfer failed");

        emit TokensDispensed(msg.sender, FAUCET_AMOUNT_MYC, FAUCET_AMOUNT_USDC, FAUCET_AMOUNT_CUSTOM);
    }

    /**
     * @dev Allows the owner to withdraw tokens from the faucet (e.g. for upgrading/decommissioning).
     * @param token Address of the token to withdraw.
     * @param amount Amount of tokens to withdraw.
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Faucet: Invalid token address");
        require(IERC20(token).transfer(msg.sender, amount), "Faucet: Withdraw transfer failed");
    }
}
