import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Injecting pool liquidity using address:", deployer.address);

  // Deployed contract addresses
  const simpleSwapAddress = "0xCCD633f8237AadBBa54846A73204448A8d6a726b";
  const onyxSwapAddress = "0x9587872bB3dD4993D4C3AD4279a2E218Dcb3C863";
  const mycOnyxSwapAddress = "0xYourMycOnyxSwapAddressPlaceholderIfRunningAgain"; // will update during node run
  const myCoinAddress = "0x1d8686F4915beD4b621e568199f2E37A2653b031";
  const mockInrAddress = "0x8a1468102B2ED21eD1f91C38F87009519703967d";
  const customTokenAddress = "0xAC5139b73cE32D3D24a4Dad10bAF9a1D3d11FDe2";

  // Connect to contracts
  const myCoin = await ethers.getContractAt("MyCoin", myCoinAddress);
  const mockInr = await ethers.getContractAt("MockINR", mockInrAddress);
  const customToken = await ethers.getContractAt("CustomToken", customTokenAddress);
  const simpleSwap = await ethers.getContractAt("SimpleSwap", simpleSwapAddress);
  const onyxSwap = await ethers.getContractAt("SimpleSwap", onyxSwapAddress);

  // Liquidity amounts to add
  const ADD_MYC = ethers.parseEther("500000"); // 500,000 MYC
  const ADD_INR = ethers.parseUnits("250000", 6); // 250,000 INR
  const ADD_ONYX = ethers.parseEther("500000"); // 500,000 ONYX
  const ADD_INR_ONYX = ethers.parseUnits("250000", 6); // 250,000 INR

  console.log("Minting tokens to owner...");
  await (await myCoin.mint(deployer.address, ADD_MYC)).wait();
  await (await mockInr.mint(deployer.address, ADD_INR + ADD_INR_ONYX)).wait();

  console.log("Approving pools to spend tokens...");
  await (await myCoin.approve(simpleSwapAddress, ADD_MYC)).wait();
  await (await mockInr.approve(simpleSwapAddress, ADD_INR)).wait();
  await (await customToken.approve(onyxSwapAddress, ADD_ONYX)).wait();
  await (await mockInr.approve(onyxSwapAddress, ADD_INR_ONYX)).wait();

  console.log("Adding liquidity to pools...");
  const tx1 = await simpleSwap.addLiquidity(ADD_MYC, ADD_INR);
  await tx1.wait();
  console.log("Successfully added MYC/INR liquidity!");

  const tx2 = await onyxSwap.addLiquidity(ADD_ONYX, ADD_INR_ONYX);
  await tx2.wait();
  console.log("Successfully added ONYX/INR liquidity!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
