import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { MyCoin, MockUSDC, Faucet } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Faucet Contract", function () {
  let myCoin: MyCoin;
  let mockUsdc: MockUSDC;
  let faucet: Faucet;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  const FAUCET_MYC_AMOUNT = ethers.parseEther("100");
  const FAUCET_USDC_AMOUNT = ethers.parseUnits("100", 6);

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MyCoinFactory = await ethers.getContractFactory("MyCoin");
    myCoin = (await MyCoinFactory.deploy(ethers.parseEther("1000000"), owner.address)) as MyCoin;

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUsdc = (await MockUSDCFactory.deploy()) as MockUSDC;

    const FaucetFactory = await ethers.getContractFactory("Faucet");
    faucet = (await FaucetFactory.deploy(
      await myCoin.getAddress(),
      await mockUsdc.getAddress(),
      owner.address
    )) as Faucet;

    // Fund the faucet with enough tokens
    await myCoin.connect(owner).mint(await faucet.getAddress(), ethers.parseEther("10000"));
    await mockUsdc.connect(owner).mint(await faucet.getAddress(), ethers.parseUnits("10000", 6));
  });

  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      expect(await faucet.myCoin()).to.equal(await myCoin.getAddress());
      expect(await faucet.mockUsdc()).to.equal(await mockUsdc.getAddress());
    });
  });

  describe("Requesting Tokens", function () {
    it("Should dispense correct amounts to the user", async function () {
      const balanceMycBefore = await myCoin.balanceOf(user.address);
      const balanceUsdcBefore = await mockUsdc.balanceOf(user.address);

      await faucet.connect(user).requestTokens();

      const balanceMycAfter = await myCoin.balanceOf(user.address);
      const balanceUsdcAfter = await mockUsdc.balanceOf(user.address);

      expect(balanceMycAfter - balanceMycBefore).to.equal(FAUCET_MYC_AMOUNT);
      expect(balanceUsdcAfter - balanceUsdcBefore).to.equal(FAUCET_USDC_AMOUNT);
    });

    it("Should enforce the 24-hour cooldown", async function () {
      await faucet.connect(user).requestTokens();

      // Second request should revert due to active cooldown
      await expect(faucet.connect(user).requestTokens()).to.be.revertedWith("Faucet: Cooldown active");

      // Advance blockchain time by 24 hours
      await time.increase(24 * 60 * 60);

      // Now it should succeed
      await expect(faucet.connect(user).requestTokens()).to.not.be.reverted;
    });

    it("Should fail if the faucet has insufficient MYC", async function () {
      const FaucetFactory = await ethers.getContractFactory("Faucet");
      const emptyFaucet = (await FaucetFactory.deploy(
        await myCoin.getAddress(),
        await mockUsdc.getAddress(),
        owner.address
      )) as Faucet;

      // Only fund USDC
      await mockUsdc.connect(owner).mint(await emptyFaucet.getAddress(), ethers.parseUnits("1000", 6));

      await expect(emptyFaucet.connect(user).requestTokens()).to.be.revertedWith(
        "Faucet: Insufficient MYC balance"
      );
    });

    it("Should fail if the faucet has insufficient USDC", async function () {
      const FaucetFactory = await ethers.getContractFactory("Faucet");
      const emptyFaucet = (await FaucetFactory.deploy(
        await myCoin.getAddress(),
        await mockUsdc.getAddress(),
        owner.address
      )) as Faucet;

      // Only fund MYC
      await myCoin.connect(owner).mint(await emptyFaucet.getAddress(), ethers.parseEther("1000"));

      await expect(emptyFaucet.connect(user).requestTokens()).to.be.revertedWith(
        "Faucet: Insufficient USDC balance"
      );
    });
  });

  describe("Owner Administration", function () {
    it("Should allow the owner to withdraw tokens", async function () {
      const withdrawAmount = ethers.parseEther("50");
      const ownerBalanceBefore = await myCoin.balanceOf(owner.address);

      await faucet.connect(owner).withdraw(await myCoin.getAddress(), withdrawAmount);

      const ownerBalanceAfter = await myCoin.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(withdrawAmount);
    });

    it("Should prevent non-owners from withdrawing tokens", async function () {
      await expect(
        faucet.connect(user).withdraw(await myCoin.getAddress(), ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(faucet, "OwnableUnauthorizedAccount");
    });
  });
});
