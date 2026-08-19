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

// 24 hours cooldown in milliseconds
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const claimCooldowns = new Map<string, number>();

// GET /api/faucet/cooldown/:address - Checks remaining cooldown
router.get("/cooldown/:address", (req: Request, res: Response) => {
  const { address } = req.params;
  if (!address || !isAddress(address)) {
    return res.status(400).json({ error: "Invalid address" });
  }
  const recipient = getAddress(address.toLowerCase());
  const lastClaim = claimCooldowns.get(recipient) || 0;
  const now = Date.now();
  const elapsed = now - lastClaim;

  if (lastClaim > 0 && elapsed < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return res.status(200).json({ cooldownLeft: remainingSeconds, canClaim: false });
  }

  return res.status(200).json({ cooldownLeft: 0, canClaim: true });
});

// POST /api/faucet/claim - Dispenses 100 MYC, 100 INR, 100 ONYX test tokens with 24hr cooldown
router.post("/claim", async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address || !isAddress(address)) {
      return res.status(400).json({ error: "A valid Ethereum recipient address is required." });
    }

    const recipient = getAddress(address.toLowerCase());
    const now = Date.now();
    const lastClaim = claimCooldowns.get(recipient) || 0;
    const elapsed = now - lastClaim;

    if (lastClaim > 0 && elapsed < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      const waitHours = Math.floor(remainingSeconds / 3600);
      const waitMins = Math.floor((remainingSeconds % 3600) / 60);
      return res.status(429).json({
        error: `24-hour cooldown active. Please wait ${waitHours}h ${waitMins}m before claiming again.`,
        cooldownRemainingSeconds: remainingSeconds,
      });
    }

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const relayer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

    let currentNonce = await provider.getTransactionCount(relayer.address, "latest");

    // Contracts
    const mycContract = new Contract(CONTRACT_ADDRESSES.MyCoin, ERC20_ABI, relayer);
    const inrContract = new Contract(CONTRACT_ADDRESSES.MockINR, ERC20_ABI, relayer);
    const onyxContract = new Contract(CONTRACT_ADDRESSES.CustomToken, ERC20_ABI, relayer);
    const faucetContract = new Contract(CONTRACT_ADDRESSES.Faucet, FAUCET_ABI, relayer);

    // Ensure relayer has sufficient balances; replenish from faucet if needed
    try {
      const mycBal = await mycContract.balanceOf(relayer.address);
      if (mycBal < parseEther("300")) {
        const refillTx = await faucetContract.withdraw(CONTRACT_ADDRESSES.MyCoin, parseEther("5000"), { nonce: currentNonce++ });
        await refillTx.wait(1);
      }
    } catch (refillErr) {
      console.warn("Faucet refill warning:", refillErr);
    }

    // Send 100 MYC, 100 INR, 100 ONYX
    const txMyc = await mycContract.transfer(recipient, parseEther("100"), { nonce: currentNonce++ });
    const txInr = await inrContract.transfer(recipient, parseUnits("100", 6), { nonce: currentNonce++ });
    const txOnyx = await onyxContract.transfer(recipient, parseEther("100"), { nonce: currentNonce++ });

    const [, , recOnyx] = await Promise.all([
      txMyc.wait(1),
      txInr.wait(1),
      txOnyx.wait(1),
    ]);

    claimCooldowns.set(recipient, Date.now());
    const blockNumber = recOnyx?.blockNumber || (await provider.getBlockNumber());

    return res.status(200).json({
      message: "100 MYC, 100 INR, and 100 ONYX test tokens dispensed successfully!",
      txHash: txOnyx.hash,
      mycTxHash: txMyc.hash,
      inrTxHash: txInr.hash,
      blockNumber,
      amount: "100+100+100",
      cooldownSeconds: 86400,
    });
  } catch (error: any) {
    console.error("Faucet claim error:", error);
    return res.status(500).json({
      error: error.reason || error.message || "Failed to dispense test tokens from faucet",
    });
  }
});

export default router;
