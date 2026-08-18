import { expect } from "chai";
import { ethers } from "hardhat";
import { MyCoin, MockINR, SimpleSwap } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SimpleSwap AMM", function () {
  let myCoin: MyCoin;
  let mockInr: MockINR;
  let swapPool: SimpleSwap;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MyCoinFactory = await ethers.getContractFactory("MyCoin");
    myCoin = (await MyCoinFactory.deploy(ethers.parseEther("10000000"), owner.address)) as MyCoin;

    const MockINRFactory = await ethers.getContractFactory("MockINR");
    mockInr = (await MockINRFactory.deploy()) as MockINR;

    const SimpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
    swapPool = (await SimpleSwapFactory.deploy(
      await myCoin.getAddress(),
      await mockInr.getAddress()
    )) as SimpleSwap;

    // Distribute tokens to user and owner for testing
    await myCoin.connect(owner).mint(owner.address, ethers.parseEther("100000"));
    await myCoin.connect(owner).mint(user.address, ethers.parseEther("100000"));
    await mockInr.connect(owner).mint(user.address, ethers.parseUnits("100000", 6));

    // Allow swapPool to transfer owner and user tokens
    await myCoin.connect(owner).approve(await swapPool.getAddress(), ethers.MaxUint256);
    await mockInr.connect(owner).approve(await swapPool.getAddress(), ethers.MaxUint256);

    await myCoin.connect(user).approve(await swapPool.getAddress(), ethers.MaxUint256);
    await mockInr.connect(user).approve(await swapPool.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("Should configure correct token addresses", async function () {
      expect(await swapPool.tokenA()).to.equal(await myCoin.getAddress());
      expect(await swapPool.tokenB()).to.equal(await mockInr.getAddress());
    });
  });

  describe("Adding Liquidity", function () {
    it("Should add initial liquidity and mint LP tokens", async function () {
      const amountA = ethers.parseEther("1000"); // 1000 MYC
      const amountB = ethers.parseUnits("500", 6); // 500 INR

      // Initial LP = sqrt(1000 * 10^18 * 500 * 10^6 * 10^12) = 707106781186547524400
      // Less MINIMUM_LIQUIDITY (1000) locked to address(0)
      const expectedLP = 707106781186547523400n;

      await expect(swapPool.connect(user).addLiquidity(amountA, amountB))
        .to.emit(swapPool, "LiquidityAdded")
        .withArgs(user.address, amountA, amountB, expectedLP);

      expect(await swapPool.balanceOf(user.address)).to.equal(expectedLP);
      expect(await swapPool.reserveA()).to.equal(amountA);
      expect(await swapPool.reserveB()).to.equal(amountB);
    });

    it("Should adjust inputs to maintain constant pool ratio on subsequent deposits", async function () {
      // 1. Initial Deposit (Ratio: 2 MYC = 1 INR)
      await swapPool.connect(owner).addLiquidity(ethers.parseEther("1000"), ethers.parseUnits("500", 6));

      // 2. Subsequent deposit of asymmetric amounts
      // Desired: 200 MYC and 200 INR
      // Since reserve ratio is 2:1, 200 MYC only requires 100 INR.
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
      const balanceInrBefore = await mockInr.balanceOf(user.address);

      const totalLPBefore = await swapPool.totalSupply();
      // Burn half of LP shares
      const lpToRemove = lpBalance / 2n;
      await swapPool.connect(user).removeLiquidity(lpToRemove);

      const balanceMycAfter = await myCoin.balanceOf(user.address);
      const balanceInrAfter = await mockInr.balanceOf(user.address);

      const expectedAWithdrawn = (lpToRemove * amountA) / totalLPBefore;
      const expectedBWithdrawn = (lpToRemove * amountB) / totalLPBefore;

      expect(balanceMycAfter - balanceMycBefore).to.equal(expectedAWithdrawn);
      expect(balanceInrAfter - balanceInrBefore).to.equal(expectedBWithdrawn);
      expect(await swapPool.reserveA()).to.equal(amountA - expectedAWithdrawn);
      expect(await swapPool.reserveB()).to.equal(amountB - expectedBWithdrawn);
    });
  });

  describe("Swapping", function () {
    beforeEach(async function () {
      // Setup pool: 10,000 MYC and 5,000 INR
      await swapPool.connect(owner).addLiquidity(ethers.parseEther("10000"), ethers.parseUnits("5000", 6));
    });

    it("Should swap tokenA for tokenB (MYC -> INR)", async function () {
      const amountIn = ethers.parseEther("100"); // 100 MYC
      // dy = (dx * 997 * y) / (x * 1000 + dx * 997)
      // dy = ~49.35 INR (49357901 raw units)
      const expectedOut = 49357901n;

      const balanceBefore = await mockInr.balanceOf(user.address);
      await swapPool.connect(user).swap(await myCoin.getAddress(), amountIn, expectedOut);
      const balanceAfter = await mockInr.balanceOf(user.address);

      expect(balanceAfter - balanceBefore).to.equal(expectedOut);
    });

    it("Should swap tokenB for tokenA (INR -> MYC)", async function () {
      const amountIn = ethers.parseUnits("50", 6); // 50 INR
      // dy = (dx * 997 * y) / (x * 1000 + dx * 997)
      // dy = ~98.71 MYC (98715803439706129885 raw units)
      const expectedOut = 98715803439706129885n;

      const balanceBefore = await myCoin.balanceOf(user.address);
      await swapPool.connect(user).swap(await mockInr.getAddress(), amountIn, expectedOut);
      const balanceAfter = await myCoin.balanceOf(user.address);

      expect(balanceAfter - balanceBefore).to.equal(expectedOut);
    });

    it("Should enforce the slippage limit", async function () {
      const amountIn = ethers.parseEther("100");
      const highMinAmountOut = ethers.parseUnits("50", 6); // Slippage limit set too high

      await expect(
        swapPool.connect(user).swap(await myCoin.getAddress(), amountIn, highMinAmountOut)
      ).to.be.revertedWithCustomError(swapPool, "SlippageLimitExceeded");
    });

    it("Should return correct amountOut via getAmountOut", async function () {
      const amountIn = ethers.parseEther("100");
      const expectedOut = 49357901n;
      expect(await swapPool.getAmountOut(await myCoin.getAddress(), amountIn)).to.equal(expectedOut);
    });
  });
});
