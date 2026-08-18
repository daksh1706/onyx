import { Router, Request, Response } from "express";
import { ethers, Contract, parseEther, parseUnits, isAddress } from "ethers";
import Transaction from "../models/Transaction";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || "ab98a96082657e1d1ba334b25885c2d692e6ba9061caa35ef97a984150399a85";

const CONTRACT_ADDRESSES = {
  MyCoin: process.env.MYCOIN_ADDRESS || "0x1d8686F4915beD4b621e568199f2E37A2653b031",
  MockINR: process.env.USDC_ADDRESS || "0x8a1468102B2ED21eD1f91C38F87009519703967d",
  CustomToken: process.env.ONYX_ADDRESS || "0xAC5139b73cE32D3D24a4Dad10bAF9a1D3d11FDe2",
};

const ERC20_MINT_ABI = [
  "function mint(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

// POST /api/faucet/claim - Dispenses test crypto (MYC, INR, ONYX) + gas ETH to user
router.post("/claim", async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address || !isAddress(address)) {
      return res.status(400).json({ error: "A valid Ethereum recipient address is required." });
    }

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const relayer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

    const userEthBal = await provider.getBalance(address);

    // 1. If user has less than 0.002 ETH, send 0.003 ETH for gas
    let gasTxHash = "";
    if (userEthBal < parseEther("0.002")) {
      try {
        const gasTx = await relayer.sendTransaction({
          to: address,
          value: parseEther("0.003"),
        });
        gasTxHash = gasTx.hash;
        await gasTx.wait();
      } catch (gasErr) {
        console.warn("Gas fund warning:", gasErr);
      }
    }

    // 2. Mint test tokens to user
    const mycContract = new Contract(CONTRACT_ADDRESSES.MyCoin, ERC20_MINT_ABI, relayer);
    const inrContract = new Contract(CONTRACT_ADDRESSES.MockINR, ERC20_MINT_ABI, relayer);
    const onyxContract = new Contract(CONTRACT_ADDRESSES.CustomToken, ERC20_MINT_ABI, relayer);

    const [txMyc, txInr, txOnyx] = await Promise.all([
      mycContract.mint(address, parseEther("100")),
      inrContract.mint(address, parseUnits("100", 6)),
      onyxContract.mint(address, parseEther("100")),
    ]);

    const receipt = await txOnyx.wait();
    const blockNumber = receipt?.blockNumber || (await provider.getBlockNumber());

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
