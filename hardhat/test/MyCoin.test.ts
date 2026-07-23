import { expect } from "chai";
import { ethers } from "hardhat";
import { MyCoin } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("MyCoin Contract", function () {
  let myCoin: MyCoin;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  const CAP = ethers.parseEther("1000000"); // 1,000,000 MYC cap

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const MyCoinFactory = await ethers.getContractFactory("MyCoin");
    myCoin = (await MyCoinFactory.deploy(CAP, owner.address)) as MyCoin;
  });

  describe("Deployment", function () {
    it("Should set the correct cap", async function () {
      expect(await myCoin.cap()).to.equal(CAP);
    });

    it("Should set the correct owner", async function () {
      expect(await myCoin.owner()).to.equal(owner.address);
    });

    it("Should have 18 decimals", async function () {
      expect(await myCoin.decimals()).to.equal(18);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint", async function () {
      const mintAmount = ethers.parseEther("1000");
      await myCoin.connect(owner).mint(user.address, mintAmount);
      expect(await myCoin.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("Should block non-owner minting", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(
        myCoin.connect(user).mint(user.address, mintAmount)
      ).to.be.revertedWithCustomError(myCoin, "OwnableUnauthorizedAccount");
    });

    it("Should block minting that exceeds the cap", async function () {
      await myCoin.connect(owner).mint(user.address, CAP);
      await expect(
        myCoin.connect(owner).mint(user.address, 1)
      ).to.be.revertedWithCustomError(myCoin, "ERC20ExceededCap");
    });
  });
});
