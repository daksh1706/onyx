import { ethers, network, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account ETH balance:", ethers.formatEther(balance));

  // 1. Deploy MyCoin (MYC)
  const MYC_CAP = ethers.parseEther("10000000"); // 10,000,000 MYC Cap
  const MyCoinFactory = await ethers.getContractFactory("MyCoin");
  const myCoin = await MyCoinFactory.deploy(MYC_CAP, deployer.address);
  await myCoin.waitForDeployment();
  const myCoinAddress = await myCoin.getAddress();
  console.log("MyCoin (MYC) deployed to:", myCoinAddress);

  // 2. Deploy MockINR (INR)
  const MockINRFactory = await ethers.getContractFactory("MockINR");
  const mockInr = await MockINRFactory.deploy();
  await mockInr.waitForDeployment();
  const mockInrAddress = await mockInr.getAddress();
  console.log("MockINR (INR) deployed to:", mockInrAddress);

  // 2b. Deploy CustomToken (Onyx / ONYX)
  const CustomTokenFactory = await ethers.getContractFactory("CustomToken");
  const customToken = await CustomTokenFactory.deploy("Onyx", "ONYX", ethers.parseEther("10000000"));
  await customToken.waitForDeployment();
  const customTokenAddress = await customToken.getAddress();
  console.log("Onyx (ONYX) deployed to:", customTokenAddress);

  // 3. Deploy Faucet
  const FaucetFactory = await ethers.getContractFactory("Faucet");
  const faucet = await FaucetFactory.deploy(myCoinAddress, mockInrAddress, customTokenAddress, deployer.address);
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  console.log("Faucet deployed to:", faucetAddress);

  // 4. Deploy SimpleSwap AMM (MYC/INR)
  const SimpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
  const simpleSwap = await SimpleSwapFactory.deploy(myCoinAddress, mockInrAddress);
  await simpleSwap.waitForDeployment();
  const simpleSwapAddress = await simpleSwap.getAddress();
  console.log("SimpleSwap AMM (MYC/INR) deployed to:", simpleSwapAddress);

  // 4b. Deploy OnyxSwap AMM (ONYX/INR)
  console.log("\nDeploying OnyxSwap AMM Pool...");
  const onyxSwap = await SimpleSwapFactory.deploy(customTokenAddress, mockInrAddress);
  await onyxSwap.waitForDeployment();
  const onyxSwapAddress = await onyxSwap.getAddress();
  console.log("OnyxSwap AMM (ONYX/INR) deployed to:", onyxSwapAddress);

  // 4c. Deploy MycOnyxSwap AMM (MYC/ONYX)
  console.log("\nDeploying MycOnyxSwap AMM Pool...");
  const mycOnyxSwap = await SimpleSwapFactory.deploy(myCoinAddress, customTokenAddress);
  await mycOnyxSwap.waitForDeployment();
  const mycOnyxSwapAddress = await mycOnyxSwap.getAddress();
  console.log("MycOnyxSwap AMM (MYC/ONYX) deployed to:", mycOnyxSwapAddress);

  // 5. Setup initial funds for Faucet & Pool
  console.log("\nFunding Faucet contract...");
  const FAUCET_FUND_MYC = ethers.parseEther("500000");   // 500,000 MYC
  const FAUCET_FUND_INR = ethers.parseUnits("500000", 6); // 500,000 INR
  const FAUCET_FUND_CUSTOM = ethers.parseEther("500000"); // 500,000 ONYX

  await (await myCoin.mint(faucetAddress, FAUCET_FUND_MYC)).wait();
  await (await mockInr.mint(faucetAddress, FAUCET_FUND_INR)).wait();
  // ONYX supply is already minted to the deployer; transfer it to the Faucet
  await (await customToken.transfer(faucetAddress, FAUCET_FUND_CUSTOM)).wait();
  console.log("Faucet funded successfully.");

  console.log("\nAdding initial liquidity to SimpleSwap (MYC/INR)...");
  const LP_FUND_MYC = ethers.parseEther("100000");   // 100,000 MYC
  const LP_FUND_INR = ethers.parseUnits("50000", 6); // 50,000 INR (Initial Price Ratio: 2 MYC = 1 INR)

  // Mint MYC to deployer first
  await (await myCoin.mint(deployer.address, LP_FUND_MYC)).wait();

  // Approve AMM to transfer tokens
  await (await myCoin.approve(simpleSwapAddress, LP_FUND_MYC)).wait();
  await (await mockInr.approve(simpleSwapAddress, LP_FUND_INR)).wait();

  // Add liquidity
  const addLiqTx = await simpleSwap.addLiquidity(LP_FUND_MYC, LP_FUND_INR);
  await addLiqTx.wait();
  console.log("SimpleSwap Pool Liquidity added successfully!");

  console.log("\nAdding initial liquidity to OnyxSwap (ONYX/INR)...");
  const LP_FUND_ONYX = ethers.parseEther("100000");   // 100,000 ONYX
  const LP_FUND_INR_ONYX = ethers.parseUnits("50000", 6); // 50,000 INR (Initial Price Ratio: 2 ONYX = 1 INR)

  // Approve OnyxSwap to transfer tokens
  await (await customToken.approve(onyxSwapAddress, LP_FUND_ONYX)).wait();
  await (await mockInr.approve(onyxSwapAddress, LP_FUND_INR_ONYX)).wait();

  // Add liquidity
  const addOnyxLiqTx = await onyxSwap.addLiquidity(LP_FUND_ONYX, LP_FUND_INR_ONYX);
  await addOnyxLiqTx.wait();
  console.log("OnyxSwap Pool Liquidity added successfully!");

  console.log("\nAdding initial liquidity to MycOnyxSwap (MYC/ONYX)...");
  const LP_FUND_MYC_DIRECT = ethers.parseEther("50000"); // 50,000 MYC
  const LP_FUND_ONYX_DIRECT = ethers.parseEther("50000"); // 50,000 ONYX (Initial Ratio 1:1)

  // Mint MYC to deployer first
  await (await myCoin.mint(deployer.address, LP_FUND_MYC_DIRECT)).wait();

  // Approve MycOnyxSwap to transfer tokens
  await (await myCoin.approve(mycOnyxSwapAddress, LP_FUND_MYC_DIRECT)).wait();
  await (await customToken.approve(mycOnyxSwapAddress, LP_FUND_ONYX_DIRECT)).wait();

  // Add liquidity
  const addMycOnyxLiqTx = await mycOnyxSwap.addLiquidity(LP_FUND_MYC_DIRECT, LP_FUND_ONYX_DIRECT);
  await addMycOnyxLiqTx.wait();
  console.log("MycOnyxSwap Pool Liquidity added successfully!");

  // 6. Verify on Etherscan (only on live networks)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for Etherscan indexing (6 blocks)...");
    
    await myCoin.deploymentTransaction()?.wait(6);

    console.log("Verifying MyCoin...");
    try {
      await run("verify:verify", {
        address: myCoinAddress,
        constructorArguments: [MYC_CAP, deployer.address],
      });
    } catch (err) {
      console.log("MyCoin verification error:", err);
    }

    console.log("Verifying MockINR...");
    try {
      await run("verify:verify", {
        address: mockInrAddress,
        constructorArguments: [],
      });
    } catch (err) {
      console.log("MockINR verification error:", err);
    }

    console.log("Verifying Faucet...");
    try {
      await run("verify:verify", {
        address: faucetAddress,
        constructorArguments: [myCoinAddress, mockInrAddress, customTokenAddress, deployer.address],
      });
    } catch (err) {
      console.log("Faucet verification error:", err);
    }

    console.log("Verifying SimpleSwap...");
    try {
      await run("verify:verify", {
        address: simpleSwapAddress,
        constructorArguments: [myCoinAddress, mockInrAddress],
      });
    } catch (err) {
      console.log("SimpleSwap verification error:", err);
    }

    console.log("Verifying OnyxSwap...");
    try {
      await run("verify:verify", {
        address: onyxSwapAddress,
        constructorArguments: [customTokenAddress, mockInrAddress],
      });
    } catch (err) {
      console.log("OnyxSwap verification error:", err);
    }

    console.log("Verifying MycOnyxSwap...");
    try {
      await run("verify:verify", {
        address: mycOnyxSwapAddress,
        constructorArguments: [myCoinAddress, customTokenAddress],
      });
    } catch (err) {
      console.log("MycOnyxSwap verification error:", err);
    }
  }

  console.log("\nDeployment and setup finalized!");
  console.log("-----------------------------------------");
  console.log("MyCoin (MYC):      ", myCoinAddress);
  console.log("MockINR (INR):     ", mockInrAddress);
  console.log("Onyx (ONYX):       ", customTokenAddress);
  console.log("Faucet:            ", faucetAddress);
  console.log("SimpleSwap LP:     ", simpleSwapAddress);
  console.log("OnyxSwap LP:       ", onyxSwapAddress);
  console.log("MycOnyxSwap LP:    ", mycOnyxSwapAddress);
  console.log("-----------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
