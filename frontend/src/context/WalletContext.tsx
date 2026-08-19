import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers, Wallet, HDNodeWallet, Mnemonic, Contract, formatEther, parseEther, formatUnits, parseUnits } from "ethers";
import {
  CONTRACT_ADDRESSES,
  MYCOIN_ABI,
  MOCKINR_ABI,
  FAUCET_ABI,
  SIMPLESWAP_ABI,
} from "../constants/contracts";
import { encryptData, decryptData } from "../utils/crypto";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";

// Backend API base URL — uses local network IP so physical iOS devices can connect
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

// Secure Storage Native-to-Web Fallback Wrappers
const getSecureItem = async (key: string): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) {
    return localStorage.getItem(key);
  }
  try {
    const result = await SecureStoragePlugin.get({ key });
    return result.value;
  } catch (e) {
    console.warn("SecureStoragePlugin.get failed, falling back to localStorage", e);
    return localStorage.getItem(key);
  }
};

const setSecureItem = async (key: string, value: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    localStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStoragePlugin.set({ key, value });
  } catch (e) {
    console.warn("SecureStoragePlugin.set failed, falling back to localStorage", e);
    localStorage.setItem(key, value);
  }
};

const removeSecureItem = async (key: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    localStorage.removeItem(key);
    return;
  }
  try {
    await SecureStoragePlugin.remove({ key });
  } catch (e) {
    // Ignore error if key doesn't exist
  }
  localStorage.removeItem(key);
};

// Biometric Prompt Gater
export const verifyBiometrics = async (reason: string): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    // Simulated browser prompt
    console.log("[Biometrics Mock] Authenticated on web: " + reason);
    return true;
  }
  try {
    const available = await NativeBiometric.isAvailable();
    if (!available.isAvailable) {
      console.warn("Biometrics not available on this device.");
      return true; // Bypass/proceed if not configured/available
    }
    await NativeBiometric.verifyIdentity({
      reason,
      title: "Biometric Authentication",
      subtitle: "Required for secure transaction",
      description: reason,
    });
    return true;
  } catch (err) {
    console.error("Biometric authentication failed:", err);
    return false;
  }
};

export interface BankAccount {
  _id: string;
  bankName: string;
  accountNumber: string;
  ifscCode?: string;
  accountHolderName?: string;
  isPrimary?: boolean;
  status?: string;
  createdAt?: string;
}

export interface Transaction {
  hash: string;
  type: "Send" | "Receive" | "Swap" | "Faucet" | "Deposit";
  token: string;
  amount: string;
  otherAddress?: string;
  timestamp?: number;
  blockNumber: number;
}

interface WalletContextType {
  provider: ethers.JsonRpcProvider | ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  address: string | null;
  mnemonic: string | null;
  privateKey: string | null;
  walletType: "in-memory" | "metamask" | null;
  ethBalance: string;
  mycBalance: string;
  inrBalance: string;
  onyxBalance: string;
  lpBalance: string;
  reserves: { reserveA: string; reserveB: string } | null;
  onyxReserves: { reserveA: string; reserveB: string } | null;
  mycOnyxReserves: { reserveA: string; reserveB: string } | null;
  transactions: Transaction[];
  loading: boolean;
  rpcUrl: string;
  contractConfigured: boolean;
  isLocked: boolean;
  hasSavedWallet: boolean;
  isAuthenticated: boolean;
  username: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  img: string | null;
  banks: BankAccount[];
  updateProfile: (data: { fullName?: string; email?: string; phone?: string; img?: string }) => Promise<boolean>;
  addBankAccount: (data: { bankName: string; accountNumber: string; ifscCode?: string; accountHolderName?: string }) => Promise<BankAccount | null>;
  removeBankAccount: (bankId: string) => Promise<boolean>;
  updateBankAccount: (bankId: string, data: Partial<BankAccount>) => Promise<boolean>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<boolean>;
  generateNewWallet: (username: string, password: string, phone?: string, email?: string, fullName?: string, img?: string) => Promise<void>;
  importWalletFromMnemonic: (username: string, phrase: string, password: string, phone?: string, email?: string, fullName?: string, img?: string) => Promise<boolean>;
  importWalletFromPrivateKey: (username: string, pk: string, password: string, phone?: string, email?: string, fullName?: string, img?: string) => Promise<boolean>;
  loginUser: (username: string, password: string) => Promise<boolean>;
  connectMetaMask: () => Promise<boolean>;
  disconnectWallet: () => void;
  lockWallet: () => void;
  unlockWallet: (password: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  refreshState: () => Promise<void>;
  sendTokens: (to: string, amount: string, tokenSymbol: "ETH" | "MYC" | "INR" | "ONYX") => Promise<ethers.TransactionResponse>;
  claimFaucet: () => Promise<ethers.TransactionResponse>;
  swapTokens: (tokenInSymbol: "MYC" | "INR" | "ONYX", tokenOutSymbol: "MYC" | "INR" | "ONYX", amountIn: string, minAmountOut: string) => Promise<ethers.TransactionResponse>;
  depositINR: (amountInr: string) => Promise<ethers.TransactionResponse>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const SEPOLIA_RPCS = [
  import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.ankr.com/eth_sepolia",
  "https://cloudflare-eth.com/sepolia",
  "https://1rpc.io/sepolia"
];

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rpcIndex, setRpcIndex] = useState<number>(0);
  const [provider, setProvider] = useState<ethers.JsonRpcProvider | ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<"in-memory" | "metamask" | null>(null);

  // Authentication states
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [hasSavedWallet, setHasSavedWallet] = useState<boolean>(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [token, setToken] = useState<string | null>(null);

  // Balance states
  const [ethBalance, setEthBalance] = useState<string>(() => localStorage.getItem("onyx_cached_eth_bal") || "0");
  const [mycBalance, setMycBalance] = useState<string>(() => localStorage.getItem("onyx_cached_myc_bal") || "0");
  const [inrBalance, setInrBalance] = useState<string>(() => localStorage.getItem("onyx_cached_inr_bal") || "0");
  const [onyxBalance, setOnyxBalance] = useState<string>(() => localStorage.getItem("onyx_cached_onyx_bal") || "0");
  const [lpBalance, setLpBalance] = useState<string>(() => localStorage.getItem("onyx_cached_lp_bal") || "0");
  const [reserves, setReserves] = useState<{ reserveA: string; reserveB: string } | null>(() => {
    const saved = localStorage.getItem("onyx_cached_reserves");
    return saved ? JSON.parse(saved) : null;
  });
  const [onyxReserves, setOnyxReserves] = useState<{ reserveA: string; reserveB: string } | null>(() => {
    const saved = localStorage.getItem("onyx_cached_onyx_reserves");
    return saved ? JSON.parse(saved) : null;
  });
  const [mycOnyxReserves, setMycOnyxReserves] = useState<{ reserveA: string; reserveB: string } | null>(() => {
    const saved = localStorage.getItem("onyx_cached_myconyx_reserves");
    return saved ? JSON.parse(saved) : null;
  });

  // Tx history
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const contractConfigured = Boolean(
    CONTRACT_ADDRESSES.MyCoin &&
    CONTRACT_ADDRESSES.MockINR &&
    CONTRACT_ADDRESSES.CustomToken &&
    CONTRACT_ADDRESSES.Faucet &&
    CONTRACT_ADDRESSES.SimpleSwap &&
    CONTRACT_ADDRESSES.OnyxSwap &&
    CONTRACT_ADDRESSES.MycOnyxSwap
  );

  // Check saved wallet on startup (Secure Storage aware)
  useEffect(() => {
    const loadSavedCredentials = async () => {
      const savedToken = await getSecureItem("onyx_jwt_token");
      const savedUser = await getSecureItem("onyx_username");
      const savedWallet = await getSecureItem("onyx_encrypted_wallet");

      if (savedToken && savedUser && savedWallet) {
        setToken(savedToken);
        setUsername(savedUser);
        setHasSavedWallet(true);
        setIsLocked(true);
        setIsAuthenticated(true);
      }
    };
    loadSavedCredentials();
  }, []);

  // Initialize and rotate provider on RPC index change
  useEffect(() => {
    if (walletType === "metamask") return; // MetaMask uses its own provider
    try {
      const p = new ethers.JsonRpcProvider(SEPOLIA_RPCS[rpcIndex]);
      setProvider(p);
      if (privateKey) {
        setSigner(new Wallet(privateKey, p));
      }
    } catch (e) {
      console.error("Failed to connect to RPC index " + rpcIndex, e);
    }
  }, [rpcIndex, privateKey, walletType]);

  const disconnectWallet = useCallback(() => {
    setSigner(null);
    setAddress(null);
    setMnemonic(null);
    setPrivateKey(null);
    setWalletType(null);
    setEthBalance("0");
    setMycBalance("0");
    setInrBalance("0");
    setOnyxBalance("0");
    setLpBalance("0");
    setTransactions([]);
    setToken(null);
    setUsername(null);
    setFullName(null);
    setEmail(null);
    setPhone(null);
    setImg(null);
    setBanks([]);
    setIsAuthenticated(false);
    setHasSavedWallet(false);
    setIsLocked(false);

    // Clear local storage cache
    localStorage.removeItem("onyx_cached_eth_bal");
    localStorage.removeItem("onyx_cached_myc_bal");
    localStorage.removeItem("onyx_cached_inr_bal");
    localStorage.removeItem("onyx_cached_onyx_bal");
    localStorage.removeItem("onyx_cached_lp_bal");
    localStorage.removeItem("onyx_cached_reserves");
    localStorage.removeItem("onyx_cached_onyx_reserves");
    localStorage.removeItem("onyx_cached_myconyx_reserves");

    // Secure async wipe
    const wipe = async () => {
      await removeSecureItem("onyx_jwt_token");
      await removeSecureItem("onyx_username");
      await removeSecureItem("onyx_encrypted_wallet");
    };
    wipe();
  }, []);

  const lockWallet = useCallback(() => {
    setSigner(null);
    setAddress(null);
    setMnemonic(null);
    setPrivateKey(null);
    setWalletType(null);
    setEthBalance("0");
    setMycBalance("0");
    setInrBalance("0");
    setOnyxBalance("0");
    setLpBalance("0");
    setTransactions([]);
    setIsLocked(true);
  }, []);

  const refreshState = useCallback(async () => {
    if (!provider) return;

    let activeAddress = address;
    let activeSigner = signer;

    if (walletType === "metamask" && (window as any).ethereum) {
      try {
        const web3Provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await web3Provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          activeAddress = accounts[0];
          activeSigner = await web3Provider.getSigner();
          setProvider(web3Provider);
          setSigner(activeSigner);
          setAddress(activeAddress);
        } else {
          disconnectWallet();
          return;
        }
      } catch (err) {
        console.error("Error refreshing MetaMask connection:", err);
      }
    }

    if (!activeAddress) return;

    setLoading(true);
    try {
      // 1. Fetch ETH Balance
      const ethBal = await provider.getBalance(activeAddress);
      const ethBalStr = formatEther(ethBal);
      setEthBalance(ethBalStr);
      localStorage.setItem("onyx_cached_eth_bal", ethBalStr);

      if (contractConfigured) {
        // 2. Fetch MYC Balance
        const mycContract = new Contract(CONTRACT_ADDRESSES.MyCoin, MYCOIN_ABI, provider);
        const mycBal = await mycContract.balanceOf(activeAddress);
        const mycBalStr = formatEther(mycBal);
        setMycBalance(mycBalStr);
        localStorage.setItem("onyx_cached_myc_bal", mycBalStr);

        // 3. Fetch INR Balance (under the hood uses VITE_USDC_ADDRESS contract with decimal 6)
        const inrContract = new Contract(CONTRACT_ADDRESSES.MockINR, MOCKINR_ABI, provider);
        const inrBal = await inrContract.balanceOf(activeAddress);
        setAddress(activeAddress);
        const inrBalStr = formatUnits(inrBal, 6);
        setInrBalance(inrBalStr);
        localStorage.setItem("onyx_cached_inr_bal", inrBalStr);

        // 3b. Fetch CustomToken (Onyx) Balance
        const onyxContract = new Contract(CONTRACT_ADDRESSES.CustomToken, MYCOIN_ABI, provider);
        const onyxBal = await onyxContract.balanceOf(activeAddress);
        const onyxBalStr = formatEther(onyxBal);
        setOnyxBalance(onyxBalStr);
        localStorage.setItem("onyx_cached_onyx_bal", onyxBalStr);

        // 4. Fetch SimpleSwap LP balance
        const swapContract = new Contract(CONTRACT_ADDRESSES.SimpleSwap, SIMPLESWAP_ABI, provider);
        const lpBal = await swapContract.balanceOf(activeAddress);
        const lpBalStr = formatEther(lpBal);
        setLpBalance(lpBalStr);
        localStorage.setItem("onyx_cached_lp_bal", lpBalStr);

        // 5. Fetch reserves
        try {
          const resA = await swapContract.reserveA();
          const resB = await swapContract.reserveB();
          const data = {
            reserveA: formatEther(resA),
            reserveB: formatUnits(resB, 6),
          };
          setReserves(data);
          localStorage.setItem("onyx_cached_reserves", JSON.stringify(data));
        } catch (err) {
          console.warn("Failed to fetch SimpleSwap reserves:", err);
        }

        // 5b. Fetch OnyxSwap reserves
        try {
          if (CONTRACT_ADDRESSES.OnyxSwap) {
            const onyxSwapContract = new Contract(CONTRACT_ADDRESSES.OnyxSwap, SIMPLESWAP_ABI, provider);
            const oResA = await onyxSwapContract.reserveA();
            const oResB = await onyxSwapContract.reserveB();
            const data = {
              reserveA: formatEther(oResA),
              reserveB: formatUnits(oResB, 6),
            };
            setOnyxReserves(data);
            localStorage.setItem("onyx_cached_onyx_reserves", JSON.stringify(data));
          }
        } catch (err) {
          console.warn("Failed to fetch OnyxSwap reserves:", err);
        }

        // 5c. Fetch MycOnyxSwap reserves
        try {
          if (CONTRACT_ADDRESSES.MycOnyxSwap) {
            const mycOnyxSwapContract = new Contract(CONTRACT_ADDRESSES.MycOnyxSwap, SIMPLESWAP_ABI, provider);
            const moResA = await mycOnyxSwapContract.reserveA();
            const moResB = await mycOnyxSwapContract.reserveB();
            const data = {
              reserveA: formatEther(moResA),
              reserveB: formatEther(moResB),
            };
            setMycOnyxReserves(data);
            localStorage.setItem("onyx_cached_myconyx_reserves", JSON.stringify(data));
          }
        } catch (err) {
          console.warn("Failed to fetch MycOnyxSwap reserves:", err);
        }

        // 6. Fetch user profile & linked banks from MongoDB on every refresh
        if (isAuthenticated && token) {
          try {
            const profileRes = await fetch(`${API_URL}/api/auth/me`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              setFullName(profileData.fullName || null);
              setEmail(profileData.email || null);
              setPhone(profileData.phone || null);
              setImg(profileData.img || null);
            }
          } catch (e) {
            console.warn("Failed to refresh profile from MongoDB:", e);
          }

          try {
            const bankRes = await fetch(`${API_URL}/api/banks`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (bankRes.ok) {
              const bankData = await bankRes.json();
              if (Array.isArray(bankData)) {
                setBanks(bankData);
              }
            }
          } catch (e) {
            console.warn("Failed to fetch bank accounts from MongoDB:", e);
          }
        }

        // 7. Fetch Tx History — Blockchain FIRST, then MongoDB fills any missing entries
        const txMap = new Map<string, Transaction>();

        // A) Fetch from Blockchain logs FIRST (primary source of truth)
        try {
          const currentBlock = await provider.getBlockNumber();
          const startBlock = Math.max(0, currentBlock - 100000); // Last 100000 blocks (~14 days)

          // Claim events from Faucet
          const faucetContract = new Contract(CONTRACT_ADDRESSES.Faucet, FAUCET_ABI, provider);
          const faucetClaims = await faucetContract.queryFilter(
            faucetContract.filters.TokensDispensed(activeAddress),
            startBlock,
            currentBlock
          );
          for (const log of faucetClaims) {
            const p = log as any;
            txMap.set(p.transactionHash, {
              hash: p.transactionHash,
              type: "Faucet",
              token: "MYC+INR+ONYX",
              amount: "100+100+100",
              blockNumber: p.blockNumber,
            });
          }

          // Swaps on SimpleSwap
          const swapEvents = await swapContract.queryFilter(
            swapContract.filters.Swapped(activeAddress),
            startBlock,
            currentBlock
          );
          for (const log of swapEvents) {
            const p = log as any;
            const [, tokenIn, amountIn, amountOut] = p.args;
            const isMyc = tokenIn.toLowerCase() === CONTRACT_ADDRESSES.MyCoin.toLowerCase();
            txMap.set(p.transactionHash, {
              hash: p.transactionHash,
              type: "Swap",
              token: isMyc ? "MYC → INR" : "INR → MYC",
              amount: isMyc
                ? `${formatEther(amountIn)} → ${formatUnits(amountOut, 6)}`
                : `${formatUnits(amountIn, 6)} → ${formatEther(amountOut)}`,
              blockNumber: p.blockNumber,
            });
          }

          // Swaps on OnyxSwap
          if (CONTRACT_ADDRESSES.OnyxSwap) {
            const onyxSwapContract = new Contract(CONTRACT_ADDRESSES.OnyxSwap, SIMPLESWAP_ABI, provider);
            const onyxSwapEvents = await onyxSwapContract.queryFilter(
              onyxSwapContract.filters.Swapped(activeAddress),
              startBlock,
              currentBlock
            );
            for (const log of onyxSwapEvents) {
              const p = log as any;
              const [, tokenIn, amountIn, amountOut] = p.args;
              const isOnyx = tokenIn.toLowerCase() === CONTRACT_ADDRESSES.CustomToken.toLowerCase();
              txMap.set(p.transactionHash, {
                hash: p.transactionHash,
                type: "Swap",
                token: isOnyx ? "ONYX → INR" : "INR → ONYX",
                amount: isOnyx
                  ? `${formatEther(amountIn)} → ${formatUnits(amountOut, 6)}`
                  : `${formatUnits(amountIn, 6)} → ${formatEther(amountOut)}`,
                blockNumber: p.blockNumber,
              });
            }
          }

          // MYC Transfers (Send/Receive)
          const mycOutgoing = await mycContract.queryFilter(
            mycContract.filters.Transfer(activeAddress, null), startBlock, currentBlock
          );
          for (const log of mycOutgoing) {
            const p = log as any;
            const [, to, value] = p.args;
            if (to.toLowerCase() !== CONTRACT_ADDRESSES.SimpleSwap.toLowerCase() && to.toLowerCase() !== CONTRACT_ADDRESSES.Faucet.toLowerCase()) {
              txMap.set(p.transactionHash, {
                hash: p.transactionHash, type: "Send", token: "MYC",
                amount: formatEther(value), otherAddress: to, blockNumber: p.blockNumber,
              });
            }
          }

          const mycIncoming = await mycContract.queryFilter(
            mycContract.filters.Transfer(null, activeAddress), startBlock, currentBlock
          );
          for (const log of mycIncoming) {
            const p = log as any;
            const [from,, value] = p.args;
            if (from.toLowerCase() !== CONTRACT_ADDRESSES.SimpleSwap.toLowerCase() && from.toLowerCase() !== CONTRACT_ADDRESSES.Faucet.toLowerCase()) {
              txMap.set(p.transactionHash, {
                hash: p.transactionHash, type: "Receive", token: "MYC",
                amount: formatEther(value), otherAddress: from, blockNumber: p.blockNumber,
              });
            }
          }

          // ONYX Transfers (Send/Receive)
          const onyxOutgoing = await onyxContract.queryFilter(
            onyxContract.filters.Transfer(activeAddress, null), startBlock, currentBlock
          );
          for (const log of onyxOutgoing) {
            const p = log as any;
            const [, to, value] = p.args;
            if (to.toLowerCase() !== CONTRACT_ADDRESSES.SimpleSwap.toLowerCase() && to.toLowerCase() !== CONTRACT_ADDRESSES.Faucet.toLowerCase()) {
              txMap.set(p.transactionHash, {
                hash: p.transactionHash, type: "Send", token: "ONYX",
                amount: formatEther(value), otherAddress: to, blockNumber: p.blockNumber,
              });
            }
          }

          const onyxIncoming = await onyxContract.queryFilter(
            onyxContract.filters.Transfer(null, activeAddress), startBlock, currentBlock
          );
          for (const log of onyxIncoming) {
            const p = log as any;
            const [from,, value] = p.args;
            if (from.toLowerCase() !== CONTRACT_ADDRESSES.SimpleSwap.toLowerCase() && from.toLowerCase() !== CONTRACT_ADDRESSES.Faucet.toLowerCase()) {
              txMap.set(p.transactionHash, {
                hash: p.transactionHash, type: "Receive", token: "ONYX",
                amount: formatEther(value), otherAddress: from, blockNumber: p.blockNumber,
              });
            }
          }
        } catch (chainErr) {
          console.warn("Blockchain log fetch error:", chainErr);
        }

        // B) MongoDB fills any entries NOT found on-chain (e.g. Deposits, older records)
        if (isAuthenticated && token) {
          try {
            const res = await fetch(`${API_URL}/api/transactions`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.length > 0) {
                for (const t of data) {
                  if (!txMap.has(t.hash)) {
                    // Only add entries not already found on-chain
                    txMap.set(t.hash, {
                      hash: t.hash,
                      type: t.type as any,
                      token: t.token === "USDC" ? "INR" : t.token,
                      amount: t.amount,
                      otherAddress: t.otherAddress,
                      blockNumber: t.blockNumber,
                      timestamp: new Date(t.timestamp).getTime()
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.warn("Failed to fetch supplementary transactions from MongoDB:", e);
          }
        }

        // Sort merged results by block number descending
        const txList = Array.from(txMap.values()).sort((a, b) => b.blockNumber - a.blockNumber);
        setTransactions(txList);
      }
    } catch (e) {
      console.error("Error fetching balance/event details, rotating RPC:", e);
      if (walletType !== "metamask" && rpcIndex < SEPOLIA_RPCS.length - 1) {
        setRpcIndex((prev) => prev + 1);
      }
    } finally {
      setLoading(false);
    }
  }, [address, provider, walletType, signer, contractConfigured, disconnectWallet, rpcIndex, isAuthenticated, token]);


  useEffect(() => {
    if (address && provider) {
      refreshState();
    }
  }, [address, provider, refreshState]);

  // Capacitor Active Lifecycle App Listener to prevent stale data
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    let appListener: any = null;

    const setupListener = async () => {
      appListener = await App.addListener("appStateChange", (state) => {
        if (state.isActive && active) {
          console.log("[AppState] App became active, reloading blockchain state...");
          refreshState();
        }
      });
    };

    setupListener();

    return () => {
      active = false;
      if (appListener) {
        appListener.remove();
      }
    };
  }, [refreshState]);

  const cacheTransaction = useCallback(async (txData: Transaction) => {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...txData,
          token: txData.token === "INR" ? "USDC" : txData.token // Store as USDC on backend database
        })
      });
    } catch (e) {
      console.error("Failed to cache transaction to database:", e);
    }
  }, [token]);

  const updateProfile = async (data: { fullName?: string; email?: string; phone?: string; img?: string }): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) return false;
      const updated = await res.json();
      if (updated.fullName !== undefined) setFullName(updated.fullName || null);
      if (updated.email !== undefined) setEmail(updated.email || null);
      if (updated.phone !== undefined) setPhone(updated.phone || null);
      if (updated.img !== undefined) setImg(updated.img || null);
      return true;
    } catch (e) {
      console.error("Failed to update profile:", e);
      return false;
    }
  };

  const addBankAccount = async (bankData: { bankName: string; accountNumber: string; ifscCode?: string; accountHolderName?: string }): Promise<BankAccount | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${API_URL}/api/banks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(bankData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to link bank account");
      }
      const data = await res.json();
      const createdBank: BankAccount = data.bank;
      setBanks((prev) => [createdBank, ...prev]);
      return createdBank;
    } catch (e) {
      console.error("Failed to add bank account:", e);
      throw e;
    }
  };

  const removeBankAccount = async (bankId: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_URL}/api/banks/${bankId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) return false;
      setBanks((prev) => prev.filter((b) => b._id !== bankId));
      return true;
    } catch (e) {
      console.error("Failed to remove bank account:", e);
      return false;
    }
  };

  const updateBankAccount = async (bankId: string, data: Partial<BankAccount>): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_URL}/api/banks/${bankId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) return false;
      const resData = await res.json();
      const updatedBank: BankAccount = resData.bank;
      setBanks((prev) => prev.map((b) => (b._id === bankId ? updatedBank : b)));
      return true;
    } catch (e) {
      console.error("Failed to update bank account:", e);
      return false;
    }
  };

  const changePassword = async (newPassword: string, currentPassword?: string): Promise<boolean> => {
    if (!token) return false;
    try {
      let newEncryptedWallet = undefined;
      if (mnemonic && privateKey) {
        newEncryptedWallet = await encryptData(
          JSON.stringify({ mnemonic, privateKey }),
          newPassword
        );
      } else if (privateKey) {
        newEncryptedWallet = await encryptData(
          JSON.stringify({ privateKey }),
          newPassword
        );
      }

      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          newEncryptedWallet
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update password");
      }

      if (newEncryptedWallet) {
        await setSecureItem("onyx_encrypted_wallet", newEncryptedWallet);
      }
      await setSecureItem("onyx_session_password", newPassword);
      return true;
    } catch (e) {
      console.error("Failed to change password:", e);
      throw e;
    }
  };

  const generateNewWallet = async (usernameInput: string, password: string, phone?: string, email?: string, fullName?: string, img?: string) => {
    disconnectWallet();
    const randomWallet = Wallet.createRandom();
    const walletMnemonic = randomWallet.mnemonic?.phrase || null;
    
    if (walletMnemonic) {
      const encrypted = await encryptData(
        JSON.stringify({ mnemonic: walletMnemonic, privateKey: randomWallet.privateKey }),
        password
      );

      // Register with MongoDB backend
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password, encryptedWallet: encrypted, phone: phone || "", email: email || "", fullName: fullName || "", img: img || "" })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to register wallet on database.");
      }

      const data = await res.json();

      await setSecureItem("onyx_jwt_token", data.token);
      await setSecureItem("onyx_username", data.username);
      await setSecureItem("onyx_encrypted_wallet", data.encryptedWallet);

      setToken(data.token);
      setUsername(data.username);
      setFullName(data.fullName || null);
      setEmail(data.email || null);
      setPhone(data.phone || null);
      setImg(data.img || null);
      setIsAuthenticated(true);
      setHasSavedWallet(true);
      
      setMnemonic(walletMnemonic);
      setPrivateKey(randomWallet.privateKey);
      setAddress(randomWallet.address);
      setWalletType("in-memory");

      // Reconnect signer
      const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[rpcIndex]);
      setProvider(readProvider);
      setSigner(new Wallet(randomWallet.privateKey, readProvider));
    }
  };

  const importWalletFromMnemonic = async (usernameInput: string, phrase: string, password: string, phone?: string, email?: string, fullName?: string, img?: string): Promise<boolean> => {
    try {
      disconnectWallet();
      const mn = Mnemonic.fromPhrase(phrase.trim());
      const node = HDNodeWallet.fromMnemonic(mn);
      
      const encrypted = await encryptData(
        JSON.stringify({ mnemonic: phrase.trim(), privateKey: node.privateKey }),
        password
      );

      // Register with backend
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password, encryptedWallet: encrypted, phone: phone || "", email: email || "", fullName: fullName || "", img: img || "" })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to import wallet on database.");
      }

      const data = await res.json();

      await setSecureItem("onyx_jwt_token", data.token);
      await setSecureItem("onyx_username", data.username);
      await setSecureItem("onyx_encrypted_wallet", data.encryptedWallet);

      setToken(data.token);
      setUsername(data.username);
      setFullName(data.fullName || null);
      setEmail(data.email || null);
      setPhone(data.phone || null);
      setImg(data.img || null);
      setIsAuthenticated(true);
      setHasSavedWallet(true);

      setMnemonic(phrase.trim());
      setPrivateKey(node.privateKey);
      setAddress(node.address);
      setWalletType("in-memory");

      const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[rpcIndex]);
      setProvider(readProvider);
      setSigner(new Wallet(node.privateKey, readProvider));
      return true;
    } catch (e) {
      console.error("Invalid mnemonic phrase or registration failed", e);
      return false;
    }
  };

  const importWalletFromPrivateKey = async (usernameInput: string, pk: string, password: string, phone?: string, email?: string, fullName?: string, img?: string): Promise<boolean> => {
    try {
      disconnectWallet();
      const formattedPk = pk.trim().startsWith("0x") ? pk.trim() : `0x${pk.trim()}`;
      const tempWallet = new Wallet(formattedPk);

      const encrypted = await encryptData(
        JSON.stringify({ privateKey: formattedPk }),
        password
      );

      // Register with backend
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password, encryptedWallet: encrypted, phone: phone || "", email: email || "", fullName: fullName || "", img: img || "" })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to import wallet on database.");
      }

      const data = await res.json();

      await setSecureItem("onyx_jwt_token", data.token);
      await setSecureItem("onyx_username", data.username);
      await setSecureItem("onyx_encrypted_wallet", data.encryptedWallet);

      setToken(data.token);
      setUsername(data.username);
      setFullName(data.fullName || null);
      setEmail(data.email || null);
      setPhone(data.phone || null);
      setImg(data.img || null);
      setIsAuthenticated(true);
      setHasSavedWallet(true);

      setPrivateKey(formattedPk);
      setAddress(tempWallet.address);
      setWalletType("in-memory");

      const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[rpcIndex]);
      setProvider(readProvider);
      setSigner(new Wallet(formattedPk, readProvider));
      return true;
    } catch (e) {
      console.error("Invalid private key or registration failed", e);
      return false;
    }
  };

  const loginUser = async (usernameInput: string, password: string): Promise<boolean> => {
    try {
      disconnectWallet();
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to log in.");
      }

      const data = await res.json();

      await setSecureItem("onyx_jwt_token", data.token);
      await setSecureItem("onyx_username", data.username);
      await setSecureItem("onyx_encrypted_wallet", data.encryptedWallet);

      setToken(data.token);
      setUsername(data.username);
      setFullName(data.fullName || null);
      setEmail(data.email || null);
      setPhone(data.phone || null);
      setImg(data.img || null);
      setIsAuthenticated(true);
      setHasSavedWallet(true);

      // Also trigger bank accounts fetch
      try {
        const bRes = await fetch(`${API_URL}/api/banks`, {
          headers: { "Authorization": `Bearer ${data.token}` }
        });
        if (bRes.ok) {
          const bList = await bRes.json();
          if (Array.isArray(bList)) setBanks(bList);
        }
      } catch (e) {
        console.warn("Failed to load banks on login:", e);
      }

      // Decrypt credentials
      const decrypted = await decryptData(data.encryptedWallet, password);
      const { mnemonic: savedMnemonic, privateKey: savedPk } = JSON.parse(decrypted);

      if (savedMnemonic) {
        const mn = Mnemonic.fromPhrase(savedMnemonic);
        const node = HDNodeWallet.fromMnemonic(mn);
        setMnemonic(savedMnemonic);
        setPrivateKey(node.privateKey);
        setAddress(node.address);
        
        const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[rpcIndex]);
        setProvider(readProvider);
        setSigner(new Wallet(node.privateKey, readProvider));
      } else if (savedPk) {
        const tempWallet = new Wallet(savedPk);
        setPrivateKey(savedPk);
        setAddress(tempWallet.address);

        const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[rpcIndex]);
        setProvider(readProvider);
        setSigner(new Wallet(savedPk, readProvider));
      }

      setWalletType("in-memory");
      setIsLocked(false);
      // Cache the session password so biometric unlock can use it next time
      await setSecureItem("onyx_session_password", password);
      return true;
    } catch (err: any) {
      console.error("Login failed:", err);
      throw err;
    }
  };

  const unlockWallet = async (password: string): Promise<boolean> => {
    const saved = await getSecureItem("onyx_encrypted_wallet");
    if (!saved) return false;
    try {
      const decrypted = await decryptData(saved, password);
      const { mnemonic: savedMnemonic, privateKey: savedPk } = JSON.parse(decrypted);

      if (savedMnemonic) {
        const mn = Mnemonic.fromPhrase(savedMnemonic);
        const node = HDNodeWallet.fromMnemonic(mn);
        setMnemonic(savedMnemonic);
        setPrivateKey(node.privateKey);
        setAddress(node.address);
        
        const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[rpcIndex]);
        setProvider(readProvider);
        setSigner(new Wallet(node.privateKey, readProvider));
      } else if (savedPk) {
        const tempWallet = new Wallet(savedPk);
        setPrivateKey(savedPk);
        setAddress(tempWallet.address);

        const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[rpcIndex]);
        setProvider(readProvider);
        setSigner(new Wallet(savedPk, readProvider));
      }

      setWalletType("in-memory");
      setIsLocked(false);
      // Cache the session password so biometric unlock can use it next time
      await setSecureItem("onyx_session_password", password);
      return true;
    } catch (err) {
      console.error("Unlock failed:", err);
      return false;
    }
  };

  // Biometric unlock — verifies fingerprint/FaceID then decrypts without requiring password
  const unlockWithBiometrics = async (): Promise<boolean> => {
    try {
      const authenticated = await verifyBiometrics("Unlock your Onyx Vault");
      if (!authenticated) return false;

      // Retrieve saved encrypted wallet and cached password from secure storage
      const saved = await getSecureItem("onyx_encrypted_wallet");
      const cachedPassword = await getSecureItem("onyx_session_password");
      if (!saved || !cachedPassword) {
        console.warn("Biometric unlock: no saved wallet or cached password found.");
        return false;
      }

      const decrypted = await decryptData(saved, cachedPassword);
      const { mnemonic: savedMnemonic, privateKey: savedPk } = JSON.parse(decrypted);

      if (savedMnemonic) {
        const mn = Mnemonic.fromPhrase(savedMnemonic);
        const node = HDNodeWallet.fromMnemonic(mn);
        setMnemonic(savedMnemonic);
        setPrivateKey(node.privateKey);
        setAddress(node.address);
        const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[rpcIndex]);
        setProvider(readProvider);
        setSigner(new Wallet(node.privateKey, readProvider));
      } else if (savedPk) {
        const tempWallet = new Wallet(savedPk);
        setPrivateKey(savedPk);
        setAddress(tempWallet.address);
        const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[rpcIndex]);
        setProvider(readProvider);
        setSigner(new Wallet(savedPk, readProvider));
      } else {
        return false;
      }

      setWalletType("in-memory");
      setIsLocked(false);
      return true;
    } catch (err) {
      console.error("Biometric unlock failed:", err);
      return false;
    }
  };

  const connectMetaMask = async (): Promise<boolean> => {
    if ((window as any).ethereum) {
      try {
        disconnectWallet();
        
        // 1. Request to switch MetaMask to Sepolia Testnet (Chain ID 11155111 -> Hex: 0xaa36a7)
        try {
          await (window as any).ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          });
        } catch (switchError: any) {
          // If the network is not added to MetaMask, add it automatically
          if (switchError.code === 4902) {
            await (window as any).ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0xaa36a7",
                  chainName: "Sepolia Test Network",
                  nativeCurrency: { name: "Sepolia ETH", symbol: "SepoliaETH", decimals: 18 },
                  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }

        const web3Provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await web3Provider.send("eth_requestAccounts", []);
        
        if (accounts.length > 0) {
          const userAddress = accounts[0];
          const browserSigner = await web3Provider.getSigner();

          setProvider(web3Provider);
          setSigner(browserSigner);
          setAddress(userAddress);
          setWalletType("metamask");

          // Watch account/chain changes
          (window as any).ethereum.on("accountsChanged", (accs: any) => {
            if (accs.length > 0) {
              setAddress(accs[0]);
            } else {
              disconnectWallet();
            }
          });

          (window as any).ethereum.on("chainChanged", () => {
            window.location.reload();
          });

          return true;
        }
      } catch (err) {
        console.error("MetaMask connection rejected", err);
      }
    } else {
      alert("MetaMask is not installed. Please install it or use in-memory wallet.");
    }
    return false;
  };

  const sendTokens = async (to: string, amount: string, tokenSymbol: "ETH" | "MYC" | "INR" | "ONYX") => {
    const verified = await verifyBiometrics(`Confirm sending ${amount} ${tokenSymbol} to ${to}`);
    if (!verified) throw new Error("Biometric authorization required");
    
    if (!signer) throw new Error("Wallet not connected");

    let tx: ethers.TransactionResponse;

    if (tokenSymbol === "ETH") {
      tx = await signer.sendTransaction({
        to,
        value: parseEther(amount),
      });
    } else if (tokenSymbol === "MYC") {
      const mycContract = new Contract(CONTRACT_ADDRESSES.MyCoin, MYCOIN_ABI, signer);
      tx = await mycContract.transfer(to, parseEther(amount));
    } else if (tokenSymbol === "ONYX") {
      const onyxContract = new Contract(CONTRACT_ADDRESSES.CustomToken, MYCOIN_ABI, signer);
      tx = await onyxContract.transfer(to, parseEther(amount));
    } else if (tokenSymbol === "INR") {
      const inrContract = new Contract(CONTRACT_ADDRESSES.MockINR, MOCKINR_ABI, signer);
      tx = await inrContract.transfer(to, parseUnits(amount, 6));
    } else {
      throw new Error("Unsupported token symbol");
    }

    tx.wait().then(async (receipt: any) => {
      if (receipt) {
        await cacheTransaction({
          hash: tx.hash,
          type: "Send",
          token: tokenSymbol,
          amount,
          otherAddress: to,
          blockNumber: receipt.blockNumber,
          timestamp: Date.now()
        });
        refreshState();
      }
    }).catch(console.error);

    return tx;
  };

  const claimFaucet = async () => {
    const verified = await verifyBiometrics("Confirm claiming test tokens from Faucet");
    if (!verified) throw new Error("Biometric authorization required");

    if (!address) throw new Error("Wallet not connected");

    try {
      // 1. Try backend automated relayer (funds gas + mints test crypto instantly)
      const res = await fetch(`${API_URL}/api/faucet/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ address })
      });

      if (res.ok) {
        const data = await res.json();
        await cacheTransaction({
          hash: data.txHash,
          type: "Faucet",
          token: "MYC+INR+ONYX",
          amount: "100+100+100",
          blockNumber: data.blockNumber || 0,
          timestamp: Date.now()
        });
        await refreshState();
        return { hash: data.txHash } as any;
      }
    } catch (backendErr) {
      console.warn("Backend faucet relayer error, attempting direct contract call:", backendErr);
    }

    // 2. Fallback to direct smart contract call if relayer is unavailable
    if (!signer) throw new Error("Wallet not connected");
    const faucetContract = new Contract(CONTRACT_ADDRESSES.Faucet, FAUCET_ABI, signer);
    const tx = await faucetContract.requestTokens();

    tx.wait().then(async (receipt: any) => {
      if (receipt) {
        await cacheTransaction({
          hash: tx.hash,
          type: "Faucet",
          token: "MYC+INR+ONYX",
          amount: "100+100+100",
          blockNumber: receipt.blockNumber,
          timestamp: Date.now()
        });
        refreshState();
      }
    }).catch(console.error);

    return tx;
  };

  const depositINR = async (amountInr: string) => {
    const verified = await verifyBiometrics(`Confirm depositing ₹${amountInr} from Bank Account`);
    if (!verified) throw new Error("Biometric authorization required");

    if (!signer || !address) throw new Error("Wallet not connected");
    const inrContract = new Contract(CONTRACT_ADDRESSES.MockINR, MOCKINR_ABI, signer);
    const rawAmount = parseUnits(amountInr, 6);
    const tx = await inrContract.mint(address, rawAmount);

    tx.wait().then(async (receipt: any) => {
      if (receipt) {
        await cacheTransaction({
          hash: tx.hash,
          type: "Deposit",
          token: "INR",
          amount: amountInr,
          blockNumber: receipt.blockNumber,
          timestamp: Date.now()
        });
        refreshState();
      }
    }).catch(console.error);

    return tx;
  };

  const swapTokens = async (
    tokenInSymbol: "MYC" | "INR" | "ONYX",
    tokenOutSymbol: "MYC" | "INR" | "ONYX",
    amountIn: string,
    minAmountOut: string
  ) => {
    const verified = await verifyBiometrics(`Confirm swapping ${amountIn} ${tokenInSymbol} for ${tokenOutSymbol}`);
    if (!verified) throw new Error("Biometric authorization required");

    if (!signer) throw new Error("Wallet not connected");

    const isDirectMycOnyx = (tokenInSymbol === "MYC" && tokenOutSymbol === "ONYX") || (tokenInSymbol === "ONYX" && tokenOutSymbol === "MYC");
    const useMultiHop = isDirectMycOnyx && (!mycOnyxReserves || parseFloat(mycOnyxReserves.reserveA) === 0);

    if (useMultiHop) {
      console.log("Direct MYC/ONYX pool is not deployed or has no reserves. Routing via INR (multi-hop)...");
      
      const firstSwapAddress = tokenInSymbol === "MYC" ? CONTRACT_ADDRESSES.SimpleSwap : CONTRACT_ADDRESSES.OnyxSwap;
      const secondSwapAddress = tokenOutSymbol === "MYC" ? CONTRACT_ADDRESSES.SimpleSwap : CONTRACT_ADDRESSES.OnyxSwap;
      
      const firstSwapContract = new Contract(firstSwapAddress, SIMPLESWAP_ABI, signer);
      const secondSwapContract = new Contract(secondSwapAddress, SIMPLESWAP_ABI, signer);
      
      const tokenInAddress = tokenInSymbol === "MYC" ? CONTRACT_ADDRESSES.MyCoin : CONTRACT_ADDRESSES.CustomToken;
      const rawAmountIn = parseUnits(amountIn, 18);
      
      // Calculate estimated INR out
      const rawInrEstimated = await firstSwapContract.getAmountOut(tokenInAddress, rawAmountIn);
      const minInrOut = (rawInrEstimated * 99n) / 100n; // 1% slippage
      
      // 1. Approve first pool if needed
      const tokenContract = new Contract(tokenInAddress, MYCOIN_ABI, signer);
      const allowance1 = await tokenContract.allowance(address, firstSwapAddress);
      if (allowance1 < rawAmountIn) {
        console.log("Approving first pool...");
        const approveTx = await tokenContract.approve(firstSwapAddress, ethers.MaxUint256);
        await approveTx.wait();
      }
      
      // Record INR balance before first swap
      const inrContract = new Contract(CONTRACT_ADDRESSES.MockINR, MOCKINR_ABI, signer);
      const inrBalBefore = await inrContract.balanceOf(address);
      
      // Swap In -> INR
      console.log("Executing first hop (TokenIn -> INR)...");
      const tx1 = await firstSwapContract.swap(tokenInAddress, rawAmountIn, minInrOut);
      await tx1.wait();
      
      // Check how much INR was received
      const inrBalAfter = await inrContract.balanceOf(address);
      const inrReceived = inrBalAfter - inrBalBefore;
      if (inrReceived.toString() === "0") {
        throw new Error("No INR received from the first hop swap");
      }
      
      // 2. Approve second pool for INR if needed
      const allowance2 = await inrContract.allowance(address, secondSwapAddress);
      if (allowance2 < inrReceived) {
        console.log("Approving second pool...");
        const approveTx = await inrContract.approve(secondSwapAddress, ethers.MaxUint256);
        await approveTx.wait();
      }
      
      // Calculate final tokenOut estimated
      const rawOutEstimated = await secondSwapContract.getAmountOut(CONTRACT_ADDRESSES.MockINR, inrReceived);
      const minTokenOut = (rawOutEstimated * 99n) / 100n; // 1% slippage
      
      // Swap INR -> tokenOut
      console.log("Executing second hop (INR -> TokenOut)...");
      const tx2 = await secondSwapContract.swap(CONTRACT_ADDRESSES.MockINR, inrReceived, minTokenOut);
      
      tx2.wait().then(async (receipt: any) => {
        if (receipt) {
          await cacheTransaction({
            hash: tx2.hash,
            type: "Swap",
            token: `${tokenInSymbol} → ${tokenOutSymbol}`,
            amount: `${amountIn} → ${formatUnits(rawOutEstimated, 18)}`,
            blockNumber: receipt.blockNumber,
            timestamp: Date.now()
          });
          refreshState();
        }
      }).catch(console.error);
      
      return tx2;
    }

    let swapContractAddress = CONTRACT_ADDRESSES.SimpleSwap;
    if ((tokenInSymbol === "MYC" && tokenOutSymbol === "ONYX") || (tokenInSymbol === "ONYX" && tokenOutSymbol === "MYC")) {
      swapContractAddress = CONTRACT_ADDRESSES.MycOnyxSwap;
    } else if (tokenInSymbol === "ONYX" || tokenOutSymbol === "ONYX") {
      swapContractAddress = CONTRACT_ADDRESSES.OnyxSwap;
    }
    const swapContract = new Contract(swapContractAddress, SIMPLESWAP_ABI, signer);

    let tokenInAddress = "";
    let tokenABI: any = MYCOIN_ABI;
    let decimalsIn = 18;

    if (tokenInSymbol === "MYC") {
      tokenInAddress = CONTRACT_ADDRESSES.MyCoin;
      tokenABI = MYCOIN_ABI;
      decimalsIn = 18;
    } else if (tokenInSymbol === "ONYX") {
      tokenInAddress = CONTRACT_ADDRESSES.CustomToken;
      tokenABI = MYCOIN_ABI;
      decimalsIn = 18;
    } else if (tokenInSymbol === "INR") {
      tokenInAddress = CONTRACT_ADDRESSES.MockINR;
      tokenABI = MOCKINR_ABI;
      decimalsIn = 6;
    }

    const decimalsOut = tokenOutSymbol === "INR" ? 6 : 18;

    const rawAmountIn = parseUnits(amountIn, decimalsIn);
    const rawMinAmountOut = parseUnits(minAmountOut, decimalsOut);

    // 1. Ensure allowance
    const tokenContract = new Contract(tokenInAddress, tokenABI, signer);
    const allowance = await tokenContract.allowance(address, swapContractAddress);

    if (allowance < rawAmountIn) {
      console.log("Approving AMM for token swap...");
      const approveTx = await tokenContract.approve(swapContractAddress, ethers.MaxUint256);
      await approveTx.wait();
      console.log("Approved!");
    }

    // 2. Execute swap
    const tx = await swapContract.swap(tokenInAddress, rawAmountIn, rawMinAmountOut);

    tx.wait().then(async (receipt: any) => {
      if (receipt) {
        await cacheTransaction({
          hash: tx.hash,
          type: "Swap",
          token: `${tokenInSymbol} → ${tokenOutSymbol}`,
          amount: `${amountIn} → ${minAmountOut}`,
          blockNumber: receipt.blockNumber,
          timestamp: Date.now()
        });
        refreshState();
      }
    }).catch(console.error);

    return tx;
  };

  // Reset inactivity timer on user interactions
  const resetInactivityTimer = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  useEffect(() => {
    if (!address || walletType !== "in-memory" || isLocked) return;

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    const handleActivity = () => {
      resetInactivityTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Run active inactivity check every 10 seconds
    const interval = setInterval(() => {
      const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        console.warn("Wallet session auto-locked due to inactivity.");
        lockWallet();
      }
    }, 10000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, [address, walletType, isLocked, lastActivity, lockWallet, resetInactivityTimer]);

  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        address,
        mnemonic,
        privateKey,
        walletType,
        ethBalance,
        mycBalance,
        inrBalance,
        onyxBalance,
        lpBalance,
        reserves,
        onyxReserves,
        mycOnyxReserves,
        transactions,
        loading,
        rpcUrl: SEPOLIA_RPCS[rpcIndex],
        contractConfigured,
        isLocked,
        hasSavedWallet,
        isAuthenticated,
        username,
        fullName,
        email,
        phone,
        img,
        banks,
        updateProfile,
        addBankAccount,
        removeBankAccount,
        updateBankAccount,
        changePassword,
        generateNewWallet,
        importWalletFromMnemonic,
        importWalletFromPrivateKey,
        loginUser,
        connectMetaMask,
        disconnectWallet,
        lockWallet,
        unlockWallet,
        unlockWithBiometrics,
        refreshState,
        sendTokens,
        claimFaucet,
        swapTokens,
        depositINR,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
