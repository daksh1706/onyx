import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { MyCoin, MockINR, CustomToken, Faucet } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Faucet Contract", function () {
  let myCoin: MyCoin;
  let mockInr: MockINR;
  let customToken: CustomToken;
  let faucet: Faucet;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  const FAUCET_MYC_AMOUNT = ethers.parseEther("100");
  const FAUCET_INR_AMOUNT = ethers.parseUnits("100", 6);
  const FAUCET_CUSTOM_AMOUNT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MyCoinFactory = await ethers.getContractFactory("MyCoin");
    myCoin = (await MyCoinFactory.deploy(ethers.parseEther("1000000"), owner.address)) as MyCoin;

    const MockINRFactory = await ethers.getContractFactory("MockINR");
    mockInr = (await MockINRFactory.deploy()) as MockINR;

    const CustomTokenFactory = await ethers.getContractFactory("CustomToken");
    customToken = (await CustomTokenFactory.deploy("Onyx", "ONYX", ethers.parseEther("1000000"))) as CustomToken;

    const FaucetFactory = await ethers.getContractFactory("Faucet");
    faucet = (await FaucetFactory.deploy(
      await myCoin.getAddress(),
      await mockInr.getAddress(),
      await customToken.getAddress(),
      owner.address
    )) as Faucet;

    // Fund the faucet with enough tokens
    await myCoin.connect(owner).mint(await faucet.getAddress(), ethers.parseEther("10000"));
    await mockInr.connect(owner).mint(await faucet.getAddress(), ethers.parseUnits("10000", 6));
    await customToken.connect(owner).transfer(await faucet.getAddress(), ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      expect(await faucet.myCoin()).to.equal(await myCoin.getAddress());
      expect(await faucet.mockInr()).to.equal(await mockInr.getAddress());
      expect(await faucet.customToken()).to.equal(await customToken.getAddress());
    });
  });

  describe("Requesting Tokens", function () {
    it("Should dispense correct amounts to the user", async function () {
      const balanceMycBefore = await myCoin.balanceOf(user.address);
      const balanceInrBefore = await mockInr.balanceOf(user.address);
      const balanceCustomBefore = await customToken.balanceOf(user.address);

      await faucet.connect(user).requestTokens();

      const balanceMycAfter = await myCoin.balanceOf(user.address);
      const balanceInrAfter = await mockInr.balanceOf(user.address);
      const balanceCustomAfter = await customToken.balanceOf(user.address);

      expect(balanceMycAfter - balanceMycBefore).to.equal(FAUCET_MYC_AMOUNT);
      expect(balanceInrAfter - balanceInrBefore).to.equal(FAUCET_INR_AMOUNT);
      expect(balanceCustomAfter - balanceCustomBefore).to.equal(FAUCET_CUSTOM_AMOUNT);
    });

    it("Should enforce the 24-hour cooldown", async function () {
      await faucet.connect(user).requestTokens();

      // Second request should revert due to active cooldown
      await expect(faucet.connect(user).requestTokens()).to.be.revertedWithCustomError(
        faucet,
        "CooldownActive"
      );

      // Advance blockchain time by 24 hours
      await time.increase(24 * 60 * 60);

      // Now it should succeed
      await expect(faucet.connect(user).requestTokens()).to.not.be.reverted;
    });

    it("Should fail if the faucet has insufficient MYC", async function () {
      const FaucetFactory = await ethers.getContractFactory("Faucet");
      const emptyFaucet = (await FaucetFactory.deploy(
        await myCoin.getAddress(),
        await mockInr.getAddress(),
        await customToken.getAddress(),
        owner.address
      )) as Faucet;

      // Only fund INR and Custom
      await mockInr.connect(owner).mint(await emptyFaucet.getAddress(), ethers.parseUnits("1000", 6));
      await customToken.connect(owner).transfer(await emptyFaucet.getAddress(), ethers.parseEther("1000"));

      await expect(emptyFaucet.connect(user).requestTokens()).to.be.revertedWithCustomError(
        emptyFaucet,
        "InsufficientFaucetBalance"
      );
    });

    it("Should fail if the faucet has insufficient INR", async function () {
      const FaucetFactory = await ethers.getContractFactory("Faucet");
      const emptyFaucet = (await FaucetFactory.deploy(
        await myCoin.getAddress(),
        await mockInr.getAddress(),
        await customToken.getAddress(),
        owner.address
      )) as Faucet;

      // Only fund MYC and Custom
      await myCoin.connect(owner).mint(await emptyFaucet.getAddress(), ethers.parseEther("1000"));
      await customToken.connect(owner).transfer(await emptyFaucet.getAddress(), ethers.parseEther("1000"));

      await expect(emptyFaucet.connect(user).requestTokens()).to.be.revertedWithCustomError(
        emptyFaucet,
        "InsufficientFaucetBalance"
      );
    });

    it("Should fail if the faucet has insufficient ONYX (CustomToken)", async function () {
      const FaucetFactory = await ethers.getContractFactory("Faucet");
      const emptyFaucet = (await FaucetFactory.deploy(
        await myCoin.getAddress(),
        await mockInr.getAddress(),
        await customToken.getAddress(),
        owner.address
      )) as Faucet;

      // Only fund MYC and INR
      await myCoin.connect(owner).mint(await emptyFaucet.getAddress(), ethers.parseEther("1000"));
      await mockInr.connect(owner).mint(await emptyFaucet.getAddress(), ethers.parseUnits("1000", 6));

      await expect(emptyFaucet.connect(user).requestTokens()).to.be.revertedWithCustomError(
        emptyFaucet,
        "InsufficientFaucetBalance"
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
