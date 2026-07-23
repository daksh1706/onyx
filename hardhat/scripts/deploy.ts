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

  // 2. Deploy MockUSDC (USDC)
  const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDCFactory.deploy();
  await mockUsdc.waitForDeployment();
  const mockUsdcAddress = await mockUsdc.getAddress();
  console.log("MockUSDC (USDC) deployed to:", mockUsdcAddress);

  // 2b. Deploy CustomToken (Onyx / ONYX)
  const CustomTokenFactory = await ethers.getContractFactory("CustomToken");
  const customToken = await CustomTokenFactory.deploy("Onyx", "ONYX", ethers.parseEther("10000000"));
  await customToken.waitForDeployment();
  const customTokenAddress = await customToken.getAddress();
  console.log("Onyx (ONYX) deployed to:", customTokenAddress);

  // 3. Deploy Faucet (Updated constructor accepts MYC, USDC, ONYX, and Owner)
  const FaucetFactory = await ethers.getContractFactory("Faucet");
  const faucet = await FaucetFactory.deploy(myCoinAddress, mockUsdcAddress, customTokenAddress, deployer.address);
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  console.log("Faucet deployed to:", faucetAddress);

  // 4. Deploy SimpleSwap AMM
  const SimpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
  const simpleSwap = await SimpleSwapFactory.deploy(myCoinAddress, mockUsdcAddress);
  await simpleSwap.waitForDeployment();
  const simpleSwapAddress = await simpleSwap.getAddress();
  console.log("SimpleSwap AMM deployed to:", simpleSwapAddress);

  // 5. Setup initial funds for Faucet & Pool
  console.log("\nFunding Faucet contract...");
  const FAUCET_FUND_MYC = ethers.parseEther("500000");   // 500,000 MYC
  const FAUCET_FUND_USDC = ethers.parseUnits("500000", 6); // 500,000 USDC
  const FAUCET_FUND_CUSTOM = ethers.parseEther("500000"); // 500,000 ONYX

  await (await myCoin.mint(faucetAddress, FAUCET_FUND_MYC)).wait();
  await (await mockUsdc.mint(faucetAddress, FAUCET_FUND_USDC)).wait();
  // ONYX supply is already minted to the deployer; transfer it to the Faucet
  await (await customToken.transfer(faucetAddress, FAUCET_FUND_CUSTOM)).wait();
  console.log("Faucet funded successfully.");

  console.log("\nAdding initial liquidity to SimpleSwap...");
  const LP_FUND_MYC = ethers.parseEther("100000");   // 100,000 MYC
  const LP_FUND_USDC = ethers.parseUnits("50000", 6); // 50,000 USDC (Initial Price Ratio: 2 MYC = 1 USDC)

  // Mint MYC to deployer first
  await (await myCoin.mint(deployer.address, LP_FUND_MYC)).wait();
  // MockUSDC constructor already mints 1,000,000 USDC to the deployer

  // Approve AMM to transfer tokens
  await (await myCoin.approve(simpleSwapAddress, LP_FUND_MYC)).wait();
  await (await mockUsdc.approve(simpleSwapAddress, LP_FUND_USDC)).wait();

  // Add liquidity
  const addLiqTx = await simpleSwap.addLiquidity(LP_FUND_MYC, LP_FUND_USDC);
  await addLiqTx.wait();
  console.log("AMM Pool Liquidity added successfully!");

  // 6. Verify on Etherscan (only on live networks)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for Etherscan indexing (6 blocks)...");
    
    // We wait for some block confirmations
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

    console.log("Verifying MockUSDC...");
    try {
      await run("verify:verify", {
        address: mockUsdcAddress,
        constructorArguments: [],
      });
    } catch (err) {
      console.log("MockUSDC verification error:", err);
    }

    console.log("Verifying Faucet...");
    try {
      await run("verify:verify", {
        address: faucetAddress,
        constructorArguments: [myCoinAddress, mockUsdcAddress, deployer.address],
      });
    } catch (err) {
      console.log("Faucet verification error:", err);
    }

    console.log("Verifying SimpleSwap...");
    try {
      await run("verify:verify", {
        address: simpleSwapAddress,
        constructorArguments: [myCoinAddress, mockUsdcAddress],
      });
    } catch (err) {
      console.log("SimpleSwap verification error:", err);
    }
  }

  console.log("\nDeployment and setup finalized!");
  console.log("-----------------------------------------");
  console.log("MyCoin (MYC):   ", myCoinAddress);
  console.log("MockUSDC (USDC):", mockUsdcAddress);
  console.log("Onyx (ONYX):    ", customTokenAddress);
  console.log("Faucet:         ", faucetAddress);
  console.log("SimpleSwap LP:  ", simpleSwapAddress);
  console.log("-----------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
