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

// Secure Storage Native-to-Web Fallback Wrappers
const getSecureItem = async (key: string): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) {
    return localStorage.getItem(key);
  }
  try {
    const result = await SecureStoragePlugin.get({ key });
    return result.value;
  } catch (e) {
    return null;
  }
};

const setSecureItem = async (key: string, value: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStoragePlugin.set({ key, value });
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

export interface Transaction {
  hash: string;
  type: "Send" | "Receive" | "Swap" | "Faucet";
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
  generateNewWallet: (username: string, password: string) => Promise<void>;
  importWalletFromMnemonic: (username: string, phrase: string, password: string) => Promise<boolean>;
  importWalletFromPrivateKey: (username: string, pk: string, password: string) => Promise<boolean>;
  loginUser: (username: string, password: string) => Promise<boolean>;
  connectMetaMask: () => Promise<boolean>;
  disconnectWallet: () => void;
  lockWallet: () => void;
  unlockWallet: (password: string) => Promise<boolean>;
  refreshState: () => Promise<void>;
  sendTokens: (to: string, amount: string, tokenSymbol: "ETH" | "MYC" | "INR" | "ONYX") => Promise<ethers.TransactionResponse>;
  claimFaucet: () => Promise<ethers.TransactionResponse>;
  swapTokens: (tokenInSymbol: "MYC" | "INR" | "ONYX", tokenOutSymbol: "MYC" | "INR" | "ONYX", amountIn: string, minAmountOut: string) => Promise<ethers.TransactionResponse>;
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
  const [token, setToken] = useState<string | null>(null);

  // Balance states
  const [ethBalance, setEthBalance] = useState<string>("0");
  const [mycBalance, setMycBalance] = useState<string>("0");
  const [inrBalance, setInrBalance] = useState<string>("0");
  const [onyxBalance, setOnyxBalance] = useState<string>("0");
  const [lpBalance, setLpBalance] = useState<string>("0");
  const [reserves, setReserves] = useState<{ reserveA: string; reserveB: string } | null>(null);
  const [onyxReserves, setOnyxReserves] = useState<{ reserveA: string; reserveB: string } | null>(null);
  const [mycOnyxReserves, setMycOnyxReserves] = useState<{ reserveA: string; reserveB: string } | null>(null);

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
    setIsAuthenticated(false);
    setHasSavedWallet(false);
    setIsLocked(false);

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
      setEthBalance(formatEther(ethBal));

      if (contractConfigured) {
        // 2. Fetch MYC Balance
        const mycContract = new Contract(CONTRACT_ADDRESSES.MyCoin, MYCOIN_ABI, provider);
        const mycBal = await mycContract.balanceOf(activeAddress);
        setMycBalance(formatEther(mycBal));

        // 3. Fetch INR Balance (under the hood uses VITE_USDC_ADDRESS contract with decimal 6)
        const inrContract = new Contract(CONTRACT_ADDRESSES.MockINR, MOCKINR_ABI, provider);
        const inrBal = await inrContract.balanceOf(activeAddress);
        setAddress(activeAddress);
        setInrBalance(formatUnits(inrBal, 6));

        // 3b. Fetch CustomToken (Onyx) Balance
        const onyxContract = new Contract(CONTRACT_ADDRESSES.CustomToken, MYCOIN_ABI, provider);
        const onyxBal = await onyxContract.balanceOf(activeAddress);
        setOnyxBalance(formatEther(onyxBal));

        // 4. Fetch SimpleSwap LP balance
        const swapContract = new Contract(CONTRACT_ADDRESSES.SimpleSwap, SIMPLESWAP_ABI, provider);
        const lpBal = await swapContract.balanceOf(activeAddress);
        setLpBalance(formatEther(lpBal));

        // 5. Fetch reserves
        try {
          const resA = await swapContract.reserveA();
          const resB = await swapContract.reserveB();
          setReserves({
            reserveA: formatEther(resA),
            reserveB: formatUnits(resB, 6),
          });
        } catch (err) {
          console.warn("Failed to fetch SimpleSwap reserves:", err);
        }

        // 5b. Fetch OnyxSwap reserves
        try {
          if (CONTRACT_ADDRESSES.OnyxSwap) {
            const onyxSwapContract = new Contract(CONTRACT_ADDRESSES.OnyxSwap, SIMPLESWAP_ABI, provider);
            const oResA = await onyxSwapContract.reserveA();
            const oResB = await onyxSwapContract.reserveB();
            setOnyxReserves({
              reserveA: formatEther(oResA),
              reserveB: formatUnits(oResB, 6),
            });
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
            setMycOnyxReserves({
              reserveA: formatEther(moResA),
              reserveB: formatEther(moResB),
            });
          }
        } catch (err) {
          console.warn("Failed to fetch MycOnyxSwap reserves:", err);
        }

        // 6. Fetch Tx History (from backend cache if authenticated, else from blockchain logs)
        let txList: Transaction[] = [];
        let fetchedFromBackend = false;

        if (isAuthenticated && token) {
          try {
            const res = await fetch("http://localhost:5001/api/transactions", {
              headers: {
                "Authorization": `Bearer ${token}`
              }
            });
            if (res.ok) {
              const data = await res.json();
              txList = data.map((t: any) => ({
                hash: t.hash,
                type: t.type as any,
                token: t.token === "USDC" ? "INR" : t.token,
                amount: t.amount,
                otherAddress: t.otherAddress,
                blockNumber: t.blockNumber,
                timestamp: new Date(t.timestamp).getTime()
              }));
              fetchedFromBackend = true;
            }
          } catch (e) {
            console.error("Failed to fetch transactions from MongoDB, falling back to blockchain logs:", e);
          }
        }

        if (!fetchedFromBackend) {
          const currentBlock = await provider.getBlockNumber();
          const startBlock = Math.max(0, currentBlock - 5000); // Last 5000 blocks

          // Claim events from Faucet
          const faucetContract = new Contract(CONTRACT_ADDRESSES.Faucet, FAUCET_ABI, provider);
          const faucetClaims = await faucetContract.queryFilter(
            faucetContract.filters.TokensDispensed(activeAddress),
            startBlock,
            currentBlock
          );

          for (const log of faucetClaims) {
            const parsedLog = log as any;
            txList.push({
              hash: parsedLog.transactionHash,
              type: "Faucet",
              token: "MYC+INR+ONYX",
              amount: "100+100+100",
              blockNumber: parsedLog.blockNumber,
            });
          }

          // Swaps on SimpleSwap
          const swapEvents = await swapContract.queryFilter(
            swapContract.filters.Swapped(activeAddress),
            startBlock,
            currentBlock
          );

          for (const log of swapEvents) {
            const parsedLog = log as any;
            const [, tokenIn, amountIn, amountOut] = parsedLog.args;
            const isMyc = tokenIn.toLowerCase() === CONTRACT_ADDRESSES.MyCoin.toLowerCase();
            
            txList.push({
              hash: parsedLog.transactionHash,
              type: "Swap",
              token: isMyc ? "MYC → INR" : "INR → MYC",
              amount: isMyc 
                ? `${formatEther(amountIn)} → ${formatUnits(amountOut, 6)}`
                : `${formatUnits(amountIn, 6)} → ${formatEther(amountOut)}`,
              blockNumber: parsedLog.blockNumber,
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
              const parsedLog = log as any;
              const [, tokenIn, amountIn, amountOut] = parsedLog.args;
              const isOnyx = tokenIn.toLowerCase() === CONTRACT_ADDRESSES.CustomToken.toLowerCase();
              
              txList.push({
                hash: parsedLog.transactionHash,
                type: "Swap",
                token: isOnyx ? "ONYX → INR" : "INR → ONYX",
                amount: isOnyx 
                  ? `${formatEther(amountIn)} → ${formatUnits(amountOut, 6)}`
                  : `${formatUnits(amountIn, 6)} → ${formatEther(amountOut)}`,
                blockNumber: parsedLog.blockNumber,
              });
            }
          }

          // MYC Transfers (Send/Receive)
          const mycOutgoing = await mycContract.queryFilter(
            mycContract.filters.Transfer(activeAddress, null),
            startBlock,
            currentBlock
          );
          for (const log of mycOutgoing) {
            const parsedLog = log as any;
            const [, to, value] = parsedLog.args;
            if (to.toLowerCase() !== CONTRACT_ADDRESSES.SimpleSwap.toLowerCase() && to.toLowerCase() !== CONTRACT_ADDRESSES.Faucet.toLowerCase()) {
              txList.push({
                hash: parsedLog.transactionHash,
                type: "Send",
                token: "MYC",
                amount: formatEther(value),
                otherAddress: to,
                blockNumber: parsedLog.blockNumber,
              });
            }
          }

          const mycIncoming = await mycContract.queryFilter(
            mycContract.filters.Transfer(null, activeAddress),
            startBlock,
            currentBlock
          );
          for (const log of mycIncoming) {
            const parsedLog = log as any;
            const [from,, value] = parsedLog.args;
            if (from.toLowerCase() !== CONTRACT_ADDRESSES.SimpleSwap.toLowerCase() && from.toLowerCase() !== CONTRACT_ADDRESSES.Faucet.toLowerCase()) {
              txList.push({
                hash: parsedLog.transactionHash,
                type: "Receive",
                token: "MYC",
                amount: formatEther(value),
                otherAddress: from,
                blockNumber: parsedLog.blockNumber,
              });
            }
          }

          // ONYX Transfers (Send/Receive)
          const onyxOutgoing = await onyxContract.queryFilter(
            onyxContract.filters.Transfer(activeAddress, null),
            startBlock,
            currentBlock
          );
          for (const log of onyxOutgoing) {
            const parsedLog = log as any;
            const [, to, value] = parsedLog.args;
            if (to.toLowerCase() !== CONTRACT_ADDRESSES.SimpleSwap.toLowerCase() && to.toLowerCase() !== CONTRACT_ADDRESSES.Faucet.toLowerCase()) {
              txList.push({
                hash: parsedLog.transactionHash,
                type: "Send",
                token: "ONYX",
                amount: formatEther(value),
                otherAddress: to,
                blockNumber: parsedLog.blockNumber,
              });
            }
          }

          const onyxIncoming = await onyxContract.queryFilter(
            onyxContract.filters.Transfer(null, activeAddress),
            startBlock,
            currentBlock
          );
          for (const log of onyxIncoming) {
            const parsedLog = log as any;
            const [from,, value] = parsedLog.args;
            if (from.toLowerCase() !== CONTRACT_ADDRESSES.SimpleSwap.toLowerCase() && from.toLowerCase() !== CONTRACT_ADDRESSES.Faucet.toLowerCase()) {
              txList.push({
                hash: parsedLog.transactionHash,
                type: "Receive",
                token: "ONYX",
                amount: formatEther(value),
                otherAddress: from,
                blockNumber: parsedLog.blockNumber,
              });
            }
          }
        }

        // Sort by block number descending
        txList.sort((a, b) => b.blockNumber - a.blockNumber);
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

  const cacheTransaction = useCallback(async (txData: {
    hash: string;
    type: "Send" | "Receive" | "Swap" | "Faucet";
    token: string;
    amount: string;
    otherAddress?: string;
    blockNumber: number;
    timestamp?: number;
  }) => {
    if (!token) return;
    try {
      await fetch("http://localhost:5001/api/transactions", {
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

  const generateNewWallet = async (usernameInput: string, password: string) => {
    disconnectWallet();
    const randomWallet = Wallet.createRandom();
    const walletMnemonic = randomWallet.mnemonic?.phrase || null;
    
    if (walletMnemonic) {
      const encrypted = await encryptData(
        JSON.stringify({ mnemonic: walletMnemonic, privateKey: randomWallet.privateKey }),
        password
      );

      // Register with MongoDB backend
      const res = await fetch("http://localhost:5001/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password, encryptedWallet: encrypted })
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

  const importWalletFromMnemonic = async (usernameInput: string, phrase: string, password: string): Promise<boolean> => {
    try {
      disconnectWallet();
      const mn = Mnemonic.fromPhrase(phrase.trim());
      const node = HDNodeWallet.fromMnemonic(mn);
      
      const encrypted = await encryptData(
        JSON.stringify({ mnemonic: phrase.trim(), privateKey: node.privateKey }),
        password
      );

      // Register with backend
      const res = await fetch("http://localhost:5001/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password, encryptedWallet: encrypted })
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

  const importWalletFromPrivateKey = async (usernameInput: string, pk: string, password: string): Promise<boolean> => {
    try {
      disconnectWallet();
      const formattedPk = pk.trim().startsWith("0x") ? pk.trim() : `0x${pk.trim()}`;
      const tempWallet = new Wallet(formattedPk);

      const encrypted = await encryptData(
        JSON.stringify({ privateKey: formattedPk }),
        password
      );

      // Register with backend
      const res = await fetch("http://localhost:5001/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password, encryptedWallet: encrypted })
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
      const res = await fetch("http://localhost:5001/api/auth/login", {
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
      setIsAuthenticated(true);
      setHasSavedWallet(true);

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
      return true;
    } catch (err) {
      console.error("Login failed:", err);
      return false;
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
      return true;
    } catch (err) {
      console.error("Unlock failed:", err);
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
    const verified = await verifyBiometrics("Confirm claiming tokens from Faucet");
    if (!verified) throw new Error("Biometric authorization required");

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

  const swapTokens = async (
    tokenInSymbol: "MYC" | "INR" | "ONYX",
    tokenOutSymbol: "MYC" | "INR" | "ONYX",
    amountIn: string,
    minAmountOut: string
  ) => {
    const verified = await verifyBiometrics(`Confirm swapping ${amountIn} ${tokenInSymbol} for ${tokenOutSymbol}`);
    if (!verified) throw new Error("Biometric authorization required");

    if (!signer) throw new Error("Wallet not connected");

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
        generateNewWallet,
        importWalletFromMnemonic,
        importWalletFromPrivateKey,
        loginUser,
        connectMetaMask,
        disconnectWallet,
        lockWallet,
        unlockWallet,
        refreshState,
        sendTokens,
        claimFaucet,
        swapTokens,
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
