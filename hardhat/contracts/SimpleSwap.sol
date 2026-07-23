// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimpleSwap
 * @dev A constant-product AMM pool (x * y = k) for MYC and mock USDC.
 * It inherits ERC20 to represent LP shares.
 */
contract SimpleSwap is ERC20, ReentrancyGuard {
    IERC20 public immutable tokenA; // MYC (18 decimals)
    IERC20 public immutable tokenB; // Mock USDC (6 decimals)

    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public immutable scaleFactor;

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpShares);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpShares);
    event Swapped(address indexed swapper, address indexed tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(address _tokenA, address _tokenB) ERC20("SimpleSwap LP", "SS-LP") {
        require(_tokenA != address(0) && _tokenB != address(0), "SimpleSwap: Invalid token addresses");
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);

        uint8 decimalsA = ERC20(_tokenA).decimals();
        uint8 decimalsB = ERC20(_tokenB).decimals();
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
        require(amountADesired > 0 && amountBDesired > 0, "SimpleSwap: Zero amount");

        if (reserveA == 0 && reserveB == 0) {
            amountA = amountADesired;
            amountB = amountBDesired;
            liquidity = sqrt(amountA * amountB * scaleFactor);
        } else {
            uint256 amountBOptimal = (amountADesired * reserveB) / reserveA;
            if (amountBOptimal <= amountBDesired) {
                amountA = amountADesired;
                amountB = amountBOptimal;
            } else {
                uint256 amountAOptimal = (amountBDesired * reserveA) / reserveB;
                require(amountAOptimal <= amountADesired, "SimpleSwap: Optimal A exceeds desired");
                amountA = amountAOptimal;
                amountB = amountBDesired;
            }
            
            uint256 liquidityA = (amountA * totalSupply()) / reserveA;
            uint256 liquidityB = (amountB * totalSupply()) / reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
        }

        require(liquidity > 0, "SimpleSwap: Insufficient liquidity minted");

        // Pull tokens from user
        require(tokenA.transferFrom(msg.sender, address(this), amountA), "SimpleSwap: Token A transfer failed");
        require(tokenB.transferFrom(msg.sender, address(this), amountB), "SimpleSwap: Token B transfer failed");

        // Mint LP shares to user
        _mint(msg.sender, liquidity);

        // Update reserves
        reserveA = tokenA.balanceOf(address(this));
        reserveB = tokenB.balanceOf(address(this));

        emit LiquidityAdded(msg.sender, amountA, amountB, liquidity);
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
        require(lpAmount > 0, "SimpleSwap: Zero LP amount");
        uint256 totalLP = totalSupply();
        require(totalLP > 0, "SimpleSwap: No LP tokens exist");

        amountA = (lpAmount * reserveA) / totalLP;
        amountB = (lpAmount * reserveB) / totalLP;

        require(amountA > 0 && amountB > 0, "SimpleSwap: Insufficient reserves returned");

        // Burn LP tokens
        _burn(msg.sender, lpAmount);

        // Transfer underlying assets to provider
        require(tokenA.transfer(msg.sender, amountA), "SimpleSwap: Token A transfer failed");
        require(tokenB.transfer(msg.sender, amountB), "SimpleSwap: Token B transfer failed");

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
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "SimpleSwap: Invalid token");
        require(amountIn > 0, "SimpleSwap: Zero input amount");

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

        require(amountOut >= minAmountOut, "SimpleSwap: Slippage limit exceeded");
        require(amountOut <= reserveOut, "SimpleSwap: Insufficient reserves in pool");

        // Transfer input tokens from caller to pool
        require(inputToken.transferFrom(msg.sender, address(this), amountIn), "SimpleSwap: Input transfer failed");

        // Transfer output tokens from pool to caller
        require(outputToken.transfer(msg.sender, amountOut), "SimpleSwap: Output transfer failed");

        // Update reserves
        reserveA = tokenA.balanceOf(address(this));
        reserveB = tokenB.balanceOf(address(this));

        emit Swapped(msg.sender, tokenIn, amountIn, amountOut);
    }

    /**
     * @dev View function to query the expected output amount for a swap.
     * @param tokenIn The token being sold.
     * @param amountIn The amount of tokenIn.
     */
    function getAmountOut(address tokenIn, uint256 amountIn) external view returns (uint256 amountOut) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "SimpleSwap: Invalid token");
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
