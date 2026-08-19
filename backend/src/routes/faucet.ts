import { Router, Request, Response } from "express";
import { ethers, Contract, parseEther, parseUnits, isAddress, getAddress } from "ethers";

const router = Router();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || "ab98a96082657e1d1ba334b25885c2d692e6ba9061caa35ef97a984150399a85";

const CONTRACT_ADDRESSES = {
  MyCoin: process.env.MYCOIN_ADDRESS || "0x1d8686F4915beD4b621e568199f2E37A2653b031",
  MockINR: process.env.USDC_ADDRESS || "0x8a1468102B2ED21eD1f91C38F87009519703967d",
  CustomToken: process.env.ONYX_ADDRESS || "0xAC5139b73cE32D3D24a4Dad10bAF9a1D3d11FDe2",
  Faucet: process.env.FAUCET_ADDRESS || "0x903dbDA83a87d6Bb7EAcc9Be88c133e2Ae2Ccbc3",
};

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

const FAUCET_ABI = [
  "function withdraw(address token, uint256 amount) external",
];

// In-memory cooldown tracking per address (1 hour minimum)
const claimCooldowns = new Map<string, number>();

// POST /api/faucet/claim - Dispenses test crypto (MYC, INR, ONYX) + gas ETH to user
router.post("/claim", async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address || !isAddress(address)) {
      return res.status(400).json({ error: "A valid Ethereum recipient address is required." });
    }

    const recipient = getAddress(address.toLowerCase());
    const now = Date.now();
    const lastClaim = claimCooldowns.get(recipient) || 0;
    const cooldownMs = 60 * 1000; // 60s cooldown buffer for rapid clicks

    if (now - lastClaim < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - (now - lastClaim)) / 1000);
      return res.status(429).json({ error: `Please wait ${waitSec}s before claiming again.` });
    }

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const relayer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

    const userEthBal = await provider.getBalance(recipient);
    let currentNonce = await provider.getTransactionCount(relayer.address, "latest");

    // 1. If user has less than 0.002 ETH, send 0.003 ETH for gas
    let gasTxHash = "";
    if (userEthBal < parseEther("0.002")) {
      try {
        const gasTx = await relayer.sendTransaction({
          to: recipient,
          value: parseEther("0.003"),
          nonce: currentNonce++,
        });
        gasTxHash = gasTx.hash;
        await gasTx.wait(1);
      } catch (gasErr) {
        console.warn("Gas fund warning:", gasErr);
      }
    }

    // 2. Contracts
    const mycContract = new Contract(CONTRACT_ADDRESSES.MyCoin, ERC20_ABI, relayer);
    const inrContract = new Contract(CONTRACT_ADDRESSES.MockINR, ERC20_ABI, relayer);
    const onyxContract = new Contract(CONTRACT_ADDRESSES.CustomToken, ERC20_ABI, relayer);
    const faucetContract = new Contract(CONTRACT_ADDRESSES.Faucet, FAUCET_ABI, relayer);

    // 3. Ensure relayer has sufficient balances; replenish from faucet if needed
    try {
      const mycBal = await mycContract.balanceOf(relayer.address);
      if (mycBal < parseEther("300")) {
        const refillTx = await faucetContract.withdraw(CONTRACT_ADDRESSES.MyCoin, parseEther("5000"), { nonce: currentNonce++ });
        await refillTx.wait(1);
      }
    } catch (refillErr) {
      console.warn("Faucet refill warning:", refillErr);
    }

    // 4. Send 100 MYC, 100 INR, 100 ONYX
    const txMyc = await mycContract.transfer(recipient, parseEther("100"), { nonce: currentNonce++ });
    const txInr = await inrContract.transfer(recipient, parseUnits("100", 6), { nonce: currentNonce++ });
    const txOnyx = await onyxContract.transfer(recipient, parseEther("100"), { nonce: currentNonce++ });

    const [recMyc, recInr, recOnyx] = await Promise.all([
      txMyc.wait(1),
      txInr.wait(1),
      txOnyx.wait(1),
    ]);

    claimCooldowns.set(recipient, Date.now());
    const blockNumber = recOnyx?.blockNumber || (await provider.getBlockNumber());

    return res.status(200).json({
      message: "Test crypto and gas dispensed successfully!",
      txHash: txOnyx.hash,
      mycTxHash: txMyc.hash,
      inrTxHash: txInr.hash,
      gasTxHash,
      blockNumber,
      amount: "100+100+100",
    });
  } catch (error: any) {
    console.error("Faucet claim error:", error);
    return res.status(500).json({
      error: error.reason || error.message || "Failed to dispense test crypto from faucet",
    });
  }
});

export default router;
