// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimpleSwap
 * @dev A constant-product AMM pool (x * y = k) for MYC and mock USDC.
 * It inherits ERC20 to represent LP shares.
 */
contract SimpleSwap is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenA; // MYC (18 decimals)
    IERC20 public immutable tokenB; // Mock USDC (6 decimals)

    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public immutable scaleFactor;
    uint256 public constant MINIMUM_LIQUIDITY = 10**3;

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpShares);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpShares);
    event Swapped(address indexed swapper, address indexed tokenIn, uint256 amountIn, uint256 amountOut);

    // Custom errors
    error InvalidAddress();
    error ZeroAmount();
    error InsufficientLiquidityMinted();
    error OptimalAmountExceedsDesired();
    error ZeroLPAmount();
    error NoLPTokensExist();
    error InsufficientReservesReturned();
    error InvalidToken();
    error SlippageLimitExceeded();
    error InsufficientReservesInPool();

    constructor(address _tokenA, address _tokenB) ERC20("SimpleSwap LP", "SS-LP") {
        if (_tokenA == address(0) || _tokenB == address(0)) {
            revert InvalidAddress();
        }
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);

        uint8 decimalsA = ERC20(_tokenA).decimals();
        uint8 decimalsB = ERC20(_tokenB).decimals();
        if (decimalsA + decimalsB > 36) {
            revert InvalidToken();
        }
        scaleFactor = 10**(36 - uint256(decimalsA) - uint256(decimalsB));
    }

    /**
     * @dev Simple integer square root using Babylonian method.
     */
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    /**
     * @dev Provides liquidity to the pool. Calculates optimal ratio amounts to transfer.
     * @param amountADesired The desired amount of token A to add.
     * @param amountBDesired The desired amount of token B to add.
     */
    function addLiquidity(uint256 amountADesired, uint256 amountBDesired)
        external
        nonReentrant
        returns (uint256 amountA, uint256 amountB, uint256 liquidity)
    {
        if (amountADesired == 0 || amountBDesired == 0) {
            revert ZeroAmount();
        }

        uint256 totalLP = totalSupply();

        if (reserveA == 0 && reserveB == 0) {
            amountA = amountADesired;
            amountB = amountBDesired;
            uint256 rawLiquidity = sqrt(amountA * amountB * scaleFactor);
            if (rawLiquidity <= MINIMUM_LIQUIDITY) {
                revert InsufficientLiquidityMinted();
            }
            liquidity = rawLiquidity - MINIMUM_LIQUIDITY;
            // Permanent lock of MINIMUM_LIQUIDITY to protect against inflation attacks
            _mint(address(0x000000000000000000000000000000000000dEaD), MINIMUM_LIQUIDITY);
        } else {
            uint256 amountBOptimal = (amountADesired * reserveB) / reserveA;
            if (amountBOptimal <= amountBDesired) {
                amountA = amountADesired;
                amountB = amountBOptimal;
            } else {
                uint256 amountAOptimal = (amountBDesired * reserveA) / reserveB;
                if (amountAOptimal > amountADesired) {
                    revert OptimalAmountExceedsDesired();
                }
                amountA = amountAOptimal;
                amountB = amountBDesired;
            }
            
            uint256 liquidityA = (amountA * totalLP) / reserveA;
            uint256 liquidityB = (amountB * totalLP) / reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
        }

        if (liquidity == 0) {
            revert InsufficientLiquidityMinted();
        }

        // Pull tokens from user safely and measure actual transfer amounts
        uint256 balanceABefore = tokenA.balanceOf(address(this));
        uint256 balanceBBefore = tokenB.balanceOf(address(this));

        tokenA.safeTransferFrom(msg.sender, address(this), amountA);
        tokenB.safeTransferFrom(msg.sender, address(this), amountB);

        uint256 actualAmountA = tokenA.balanceOf(address(this)) - balanceABefore;
        uint256 actualAmountB = tokenB.balanceOf(address(this)) - balanceBBefore;

        // Mint LP shares to user
        _mint(msg.sender, liquidity);

        // Update reserves based on actual received tokens
        reserveA += actualAmountA;
        reserveB += actualAmountB;

        emit LiquidityAdded(msg.sender, actualAmountA, actualAmountB, liquidity);
    }

    /**
     * @dev Removes liquidity and returns underlying assets to the user.
     * @param lpAmount The number of LP shares to burn.
     */
    function removeLiquidity(uint256 lpAmount)
        external
        nonReentrant
        returns (uint256 amountA, uint256 amountB)
    {
        if (lpAmount == 0) {
            revert ZeroLPAmount();
        }
        uint256 totalLP = totalSupply();
        if (totalLP == 0) {
            revert NoLPTokensExist();
        }

        amountA = (lpAmount * reserveA) / totalLP;
        amountB = (lpAmount * reserveB) / totalLP;

        if (amountA == 0 || amountB == 0) {
            revert InsufficientReservesReturned();
        }

        // Burn LP tokens
        _burn(msg.sender, lpAmount);

        // Transfer underlying assets to provider
        tokenA.safeTransfer(msg.sender, amountA);
        tokenB.safeTransfer(msg.sender, amountB);

        // Update reserves
        reserveA = tokenA.balanceOf(address(this));
        reserveB = tokenB.balanceOf(address(this));

        emit LiquidityRemoved(msg.sender, amountA, amountB, lpAmount);
    }

    /**
     * @dev Swaps tokenIn for the other token in the pool, enforcing constant product with 0.3% fee.
     * @param tokenIn The token being sold.
     * @param amountIn The amount of tokenIn being sold.
     * @param minAmountOut The minimum acceptable amount of tokenOut.
     */
    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        if (tokenIn != address(tokenA) && tokenIn != address(tokenB)) {
            revert InvalidToken();
        }
        if (amountIn == 0) {
            revert ZeroAmount();
        }

        bool isTokenA = tokenIn == address(tokenA);
        IERC20 inputToken = isTokenA ? tokenA : tokenB;
        IERC20 outputToken = isTokenA ? tokenB : tokenA;
        uint256 reserveIn = isTokenA ? reserveA : reserveB;
        uint256 reserveOut = isTokenA ? reserveB : reserveA;

        // Constant product formula with 0.3% fee: dy = (dx * 997 * y) / (x * 1000 + dx * 997)
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;

        if (amountOut < minAmountOut) {
            revert SlippageLimitExceeded();
        }
        if (amountOut > reserveOut) {
            revert InsufficientReservesInPool();
        }

        // Pull tokens from user safely and measure actual transfer amounts
        uint256 balanceInBefore = inputToken.balanceOf(address(this));
        inputToken.safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 actualAmountIn = inputToken.balanceOf(address(this)) - balanceInBefore;

        // Transfer output tokens from pool to caller
        outputToken.safeTransfer(msg.sender, amountOut);

        // Update reserves using balance checks
        reserveA = tokenA.balanceOf(address(this));
        reserveB = tokenB.balanceOf(address(this));

        emit Swapped(msg.sender, tokenIn, actualAmountIn, amountOut);
    }

    /**
     * @dev View function to query the expected output amount for a swap.
     * @param tokenIn The token being sold.
     * @param amountIn The amount of tokenIn.
     */
    function getAmountOut(address tokenIn, uint256 amountIn) external view returns (uint256 amountOut) {
        if (tokenIn != address(tokenA) && tokenIn != address(tokenB)) {
            revert InvalidToken();
        }
        if (amountIn == 0) return 0;
        
        bool isTokenA = tokenIn == address(tokenA);
        uint256 reserveIn = isTokenA ? reserveA : reserveB;
        uint256 reserveOut = isTokenA ? reserveB : reserveA;
        if (reserveIn == 0 || reserveOut == 0) return 0;

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return numerator / denominator;
    }
}
