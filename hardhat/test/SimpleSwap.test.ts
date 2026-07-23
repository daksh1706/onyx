import { expect } from "chai";
import { ethers } from "hardhat";
import { MyCoin, MockUSDC, SimpleSwap } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SimpleSwap AMM", function () {
  let myCoin: MyCoin;
  let mockUsdc: MockUSDC;
  let swapPool: SimpleSwap;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MyCoinFactory = await ethers.getContractFactory("MyCoin");
    myCoin = (await MyCoinFactory.deploy(ethers.parseEther("10000000"), owner.address)) as MyCoin;

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUsdc = (await MockUSDCFactory.deploy()) as MockUSDC;

    const SimpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
    swapPool = (await SimpleSwapFactory.deploy(
      await myCoin.getAddress(),
      await mockUsdc.getAddress()
    )) as SimpleSwap;

    // Distribute tokens to user and owner for testing
    await myCoin.connect(owner).mint(owner.address, ethers.parseEther("100000"));
    await myCoin.connect(owner).mint(user.address, ethers.parseEther("100000"));
    await mockUsdc.connect(owner).mint(user.address, ethers.parseUnits("100000", 6));

    // Allow swapPool to transfer owner and user tokens
    await myCoin.connect(owner).approve(await swapPool.getAddress(), ethers.MaxUint256);
    await mockUsdc.connect(owner).approve(await swapPool.getAddress(), ethers.MaxUint256);

    await myCoin.connect(user).approve(await swapPool.getAddress(), ethers.MaxUint256);
    await mockUsdc.connect(user).approve(await swapPool.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("Should configure correct token addresses", async function () {
      expect(await swapPool.tokenA()).to.equal(await myCoin.getAddress());
      expect(await swapPool.tokenB()).to.equal(await mockUsdc.getAddress());
    });
  });

  describe("Adding Liquidity", function () {
    it("Should add initial liquidity and mint LP tokens", async function () {
      const amountA = ethers.parseEther("1000"); // 1000 MYC
      const amountB = ethers.parseUnits("500", 6); // 500 USDC

      // Initial LP = sqrt(1000 * 10^18 * 500 * 10^6 * 10^12) = 707106781186547524400
      const expectedLP = 707106781186547524400n;

      await expect(swapPool.connect(user).addLiquidity(amountA, amountB))
        .to.emit(swapPool, "LiquidityAdded")
        .withArgs(user.address, amountA, amountB, expectedLP);

      expect(await swapPool.balanceOf(user.address)).to.equal(expectedLP);
      expect(await swapPool.reserveA()).to.equal(amountA);
      expect(await swapPool.reserveB()).to.equal(amountB);
    });

    it("Should adjust inputs to maintain constant pool ratio on subsequent deposits", async function () {
      // 1. Initial Deposit (Ratio: 2 MYC = 1 USDC)
      await swapPool.connect(owner).addLiquidity(ethers.parseEther("1000"), ethers.parseUnits("500", 6));

      // 2. Subsequent deposit of asymmetric amounts
      // Desired: 200 MYC and 200 USDC
      // Since reserve ratio is 2:1, 200 MYC only requires 100 USDC.
      const amountADesired = ethers.parseEther("200");
      const amountBDesired = ethers.parseUnits("200", 6);

      const expectedAUsed = ethers.parseEther("200");
      const expectedBUsed = ethers.parseUnits("100", 6);
      const expectedSubsequentLP = 141421356237309504880n; // 1/5 of initial LP

      await expect(swapPool.connect(user).addLiquidity(amountADesired, amountBDesired))
        .to.emit(swapPool, "LiquidityAdded")
        .withArgs(user.address, expectedAUsed, expectedBUsed, expectedSubsequentLP);

      expect(await swapPool.reserveA()).to.equal(ethers.parseEther("1200"));
      expect(await swapPool.reserveB()).to.equal(ethers.parseUnits("600", 6));
    });
  });

  describe("Removing Liquidity", function () {
    it("Should burn LP tokens and return assets to provider", async function () {
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseUnits("500", 6);

      await swapPool.connect(user).addLiquidity(amountA, amountB);
      const lpBalance = await swapPool.balanceOf(user.address);

      const balanceMycBefore = await myCoin.balanceOf(user.address);
      const balanceUsdcBefore = await mockUsdc.balanceOf(user.address);

      // Burn half of LP shares
      const lpToRemove = lpBalance / 2n;
      await swapPool.connect(user).removeLiquidity(lpToRemove);

      const balanceMycAfter = await myCoin.balanceOf(user.address);
      const balanceUsdcAfter = await mockUsdc.balanceOf(user.address);

      expect(balanceMycAfter - balanceMycBefore).to.equal(amountA / 2n);
      expect(balanceUsdcAfter - balanceUsdcBefore).to.equal(amountB / 2n);
      expect(await swapPool.reserveA()).to.equal(amountA / 2n);
      expect(await swapPool.reserveB()).to.equal(amountB / 2n);
    });
  });

  describe("Swapping", function () {
    beforeEach(async function () {
      // Setup pool: 10,000 MYC and 5,000 USDC
      await swapPool.connect(owner).addLiquidity(ethers.parseEther("10000"), ethers.parseUnits("5000", 6));
    });

    it("Should swap tokenA for tokenB (MYC -> USDC)", async function () {
      const amountIn = ethers.parseEther("100"); // 100 MYC
      // dy = (dx * 997 * y) / (x * 1000 + dx * 997)
      // dy = (100 * 10^18 * 997 * 5000 * 10^6) / (10000 * 10^18 * 1000 + 100 * 10^18 * 997)
      // dy = ~49.35 USDC (49357901 raw units)
      const expectedOut = 49357901n;

      const balanceBefore = await mockUsdc.balanceOf(user.address);
      await swapPool.connect(user).swap(await myCoin.getAddress(), amountIn, expectedOut);
      const balanceAfter = await mockUsdc.balanceOf(user.address);

      expect(balanceAfter - balanceBefore).to.equal(expectedOut);
    });

    it("Should swap tokenB for tokenA (USDC -> MYC)", async function () {
      const amountIn = ethers.parseUnits("50", 6); // 50 USDC
      // dy = (dx * 997 * y) / (x * 1000 + dx * 997)
      // dy = (50 * 10^6 * 997 * 10000 * 10^18) / (5000 * 10^6 * 1000 + 50 * 10^6 * 997)
      // dy = ~98.71 MYC (98715803439706129885 raw units)
      const expectedOut = 98715803439706129885n;

      const balanceBefore = await myCoin.balanceOf(user.address);
      await swapPool.connect(user).swap(await mockUsdc.getAddress(), amountIn, expectedOut);
      const balanceAfter = await myCoin.balanceOf(user.address);

      expect(balanceAfter - balanceBefore).to.equal(expectedOut);
    });

    it("Should enforce the slippage limit", async function () {
      const amountIn = ethers.parseEther("100");
      const highMinAmountOut = ethers.parseUnits("50", 6); // Slippage limit set too high

      await expect(
        swapPool.connect(user).swap(await myCoin.getAddress(), amountIn, highMinAmountOut)
      ).to.be.revertedWith("SimpleSwap: Slippage limit exceeded");
    });

    it("Should return correct amountOut via getAmountOut", async function () {
      const amountIn = ethers.parseEther("100");
      const expectedOut = 49357901n;
      expect(await swapPool.getAmountOut(await myCoin.getAddress(), amountIn)).to.equal(expectedOut);
    });
  });
});
