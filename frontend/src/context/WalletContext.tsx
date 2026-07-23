import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers, Wallet, HDNodeWallet, Mnemonic, Contract, formatEther, parseEther, formatUnits, parseUnits } from "ethers";
import {
  CONTRACT_ADDRESSES,
  MYCOIN_ABI,
  MOCKUSDC_ABI,
  FAUCET_ABI,
  SIMPLESWAP_ABI,
} from "../constants/contracts";
import { encryptData, decryptData } from "../utils/crypto";

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
  usdcBalance: string;
  onyxBalance: string;
  lpBalance: string;
  reserves: { reserveA: string; reserveB: string } | null;
  onyxReserves: { reserveA: string; reserveB: string } | null;
  transactions: Transaction[];
  loading: boolean;
  rpcUrl: string;
  contractConfigured: boolean;
  isLocked: boolean;
  hasSavedWallet: boolean;
  generateNewWallet: (password: string) => Promise<void>;
  importWalletFromMnemonic: (phrase: string, password: string) => Promise<boolean>;
  importWalletFromPrivateKey: (pk: string, password: string) => Promise<boolean>;
  connectMetaMask: () => Promise<boolean>;
  disconnectWallet: () => void;
  lockWallet: () => void;
  unlockWallet: (password: string) => Promise<boolean>;
  refreshState: () => Promise<void>;
  sendTokens: (to: string, amount: string, tokenSymbol: "ETH" | "MYC" | "USDC" | "ONYX") => Promise<ethers.TransactionResponse>;
  claimFaucet: () => Promise<ethers.TransactionResponse>;
  swapTokens: (tokenInSymbol: "MYC" | "USDC" | "ONYX", tokenOutSymbol: "MYC" | "USDC" | "ONYX", amountIn: string, minAmountOut: string) => Promise<ethers.TransactionResponse>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const DEFAULT_RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<ethers.JsonRpcProvider | ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<"in-memory" | "metamask" | null>(null);

  // Authentication states
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [hasSavedWallet, setHasSavedWallet] = useState<boolean>(false);

  // Balance states
  const [ethBalance, setEthBalance] = useState<string>("0");
  const [mycBalance, setMycBalance] = useState<string>("0");
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [onyxBalance, setOnyxBalance] = useState<string>("0");
  const [lpBalance, setLpBalance] = useState<string>("0");
  const [reserves, setReserves] = useState<{ reserveA: string; reserveB: string } | null>(null);
  const [onyxReserves, setOnyxReserves] = useState<{ reserveA: string; reserveB: string } | null>(null);

  // Tx history
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const contractConfigured = Boolean(
    CONTRACT_ADDRESSES.MyCoin &&
    CONTRACT_ADDRESSES.MockUSDC &&
    CONTRACT_ADDRESSES.CustomToken &&
    CONTRACT_ADDRESSES.Faucet &&
    CONTRACT_ADDRESSES.SimpleSwap &&
    CONTRACT_ADDRESSES.OnyxSwap
  );

  // Check saved wallet on startup
  useEffect(() => {
    const saved = localStorage.getItem("mycoin_encrypted_wallet");
    if (saved) {
      setHasSavedWallet(true);
      setIsLocked(true);
    }
  }, []);

  // Initialize read-only provider
  useEffect(() => {
    try {
      const p = new ethers.JsonRpcProvider(DEFAULT_RPC_URL);
      setProvider(p);
    } catch (e) {
      console.error("Failed to connect to RPC:", e);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setSigner(null);
    setAddress(null);
    setMnemonic(null);
    setPrivateKey(null);
    setWalletType(null);
    setEthBalance("0");
    setMycBalance("0");
    setUsdcBalance("0");
    setOnyxBalance("0");
    setLpBalance("0");
    setTransactions([]);
    localStorage.removeItem("mycoin_encrypted_wallet");
    setHasSavedWallet(false);
    setIsLocked(false);
  }, []);

  const lockWallet = useCallback(() => {
    setSigner(null);
    setAddress(null);
    setMnemonic(null);
    setPrivateKey(null);
    setWalletType(null);
    setEthBalance("0");
    setMycBalance("0");
    setUsdcBalance("0");
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

        // 3. Fetch USDC Balance
        const usdcContract = new Contract(CONTRACT_ADDRESSES.MockUSDC, MOCKUSDC_ABI, provider);
        const usdcBal = await usdcContract.balanceOf(activeAddress);
        setAddress(activeAddress); // redundant but safe
        setUsdcBalance(formatUnits(usdcBal, 6));

        // 3b. Fetch CustomToken (Onyx) Balance
        const onyxContract = new Contract(CONTRACT_ADDRESSES.CustomToken, MYCOIN_ABI, provider);
        const onyxBal = await onyxContract.balanceOf(activeAddress);
        setOnyxBalance(formatEther(onyxBal));

        // 4. Fetch SimpleSwap LP balance
        const swapContract = new Contract(CONTRACT_ADDRESSES.SimpleSwap, SIMPLESWAP_ABI, provider);
        const lpBal = await swapContract.balanceOf(activeAddress);
        setLpBalance(formatEther(lpBal));

        // 5. Fetch reserves
        const resA = await swapContract.reserveA();
        const resB = await swapContract.reserveB();
        setReserves({
          reserveA: formatEther(resA),
          reserveB: formatUnits(resB, 6),
        });

        // 5b. Fetch OnyxSwap reserves
        if (CONTRACT_ADDRESSES.OnyxSwap) {
          const onyxSwapContract = new Contract(CONTRACT_ADDRESSES.OnyxSwap, SIMPLESWAP_ABI, provider);
          const oResA = await onyxSwapContract.reserveA();
          const oResB = await onyxSwapContract.reserveB();
          setOnyxReserves({
            reserveA: formatEther(oResA),
            reserveB: formatUnits(oResB, 6),
          });
        }

        // 6. Fetch Tx History via events
        const currentBlock = await provider.getBlockNumber();
        const startBlock = Math.max(0, currentBlock - 5000); // Last 5000 blocks

        const txList: Transaction[] = [];

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
            token: "MYC+USDC+ONYX",
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
            token: isMyc ? "MYC → USDC" : "USDC → MYC",
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
              token: isOnyx ? "ONYX → USDC" : "USDC → ONYX",
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

        // Sort by block number descending
        txList.sort((a, b) => b.blockNumber - a.blockNumber);
        setTransactions(txList);
      }
    } catch (e) {
      console.error("Error fetching balance/event details:", e);
    } finally {
      setLoading(false);
    }
  }, [address, provider, walletType, signer, contractConfigured, disconnectWallet]);

  useEffect(() => {
    if (address && provider) {
      refreshState();
    }
  }, [address, provider, refreshState]);

  const generateNewWallet = async (password: string) => {
    disconnectWallet();
    const randomWallet = Wallet.createRandom();
    const walletMnemonic = randomWallet.mnemonic?.phrase || null;
    
    if (walletMnemonic) {
      const encrypted = await encryptData(
        JSON.stringify({ mnemonic: walletMnemonic, privateKey: randomWallet.privateKey }),
        password
      );
      localStorage.setItem("mycoin_encrypted_wallet", encrypted);
      setHasSavedWallet(true);
      
      setMnemonic(walletMnemonic);
      setPrivateKey(randomWallet.privateKey);
      setAddress(randomWallet.address);
      setWalletType("in-memory");

      // Reconnect signer
      const readProvider = new ethers.JsonRpcProvider(DEFAULT_RPC_URL);
      setProvider(readProvider);
      setSigner(new Wallet(randomWallet.privateKey, readProvider));
    }
  };

  const importWalletFromMnemonic = async (phrase: string, password: string): Promise<boolean> => {
    try {
      disconnectWallet();
      const mn = Mnemonic.fromPhrase(phrase.trim());
      const node = HDNodeWallet.fromMnemonic(mn);
      
      const encrypted = await encryptData(
        JSON.stringify({ mnemonic: phrase.trim(), privateKey: node.privateKey }),
        password
      );
      localStorage.setItem("mycoin_encrypted_wallet", encrypted);
      setHasSavedWallet(true);

      setMnemonic(phrase.trim());
      setPrivateKey(node.privateKey);
      setAddress(node.address);
      setWalletType("in-memory");

      const readProvider = new ethers.JsonRpcProvider(DEFAULT_RPC_URL);
      setProvider(readProvider);
      setSigner(new Wallet(node.privateKey, readProvider));
      return true;
    } catch (e) {
      console.error("Invalid mnemonic phrase", e);
      return false;
    }
  };

  const importWalletFromPrivateKey = async (pk: string, password: string): Promise<boolean> => {
    try {
      disconnectWallet();
      const formattedPk = pk.trim().startsWith("0x") ? pk.trim() : `0x${pk.trim()}`;
      const tempWallet = new Wallet(formattedPk);

      const encrypted = await encryptData(
        JSON.stringify({ privateKey: formattedPk }),
        password
      );
      localStorage.setItem("mycoin_encrypted_wallet", encrypted);
      setHasSavedWallet(true);

      setPrivateKey(formattedPk);
      setAddress(tempWallet.address);
      setWalletType("in-memory");

      const readProvider = new ethers.JsonRpcProvider(DEFAULT_RPC_URL);
      setProvider(readProvider);
      setSigner(new Wallet(formattedPk, readProvider));
      return true;
    } catch (e) {
      console.error("Invalid private key", e);
      return false;
    }
  };

  const unlockWallet = async (password: string): Promise<boolean> => {
    const saved = localStorage.getItem("mycoin_encrypted_wallet");
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
        
        const readProvider = new ethers.JsonRpcProvider(DEFAULT_RPC_URL);
        setProvider(readProvider);
        setSigner(new Wallet(node.privateKey, readProvider));
      } else if (savedPk) {
        const tempWallet = new Wallet(savedPk);
        setPrivateKey(savedPk);
        setAddress(tempWallet.address);

        const readProvider = new ethers.JsonRpcProvider(DEFAULT_RPC_URL);
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

  const sendTokens = async (to: string, amount: string, tokenSymbol: "ETH" | "MYC" | "USDC" | "ONYX") => {
    if (!signer) throw new Error("Wallet not connected");

    if (tokenSymbol === "ETH") {
      const tx = await signer.sendTransaction({
        to,
        value: parseEther(amount),
      });
      return tx;
    } else if (tokenSymbol === "MYC") {
      const mycContract = new Contract(CONTRACT_ADDRESSES.MyCoin, MYCOIN_ABI, signer);
      const tx = await mycContract.transfer(to, parseEther(amount));
      return tx;
    } else if (tokenSymbol === "ONYX") {
      const onyxContract = new Contract(CONTRACT_ADDRESSES.CustomToken, MYCOIN_ABI, signer);
      const tx = await onyxContract.transfer(to, parseEther(amount));
      return tx;
    } else {
      const usdcContract = new Contract(CONTRACT_ADDRESSES.MockUSDC, MOCKUSDC_ABI, signer);
      const tx = await usdcContract.transfer(to, parseUnits(amount, 6));
      return tx;
    }
  };

  const claimFaucet = async () => {
    if (!signer) throw new Error("Wallet not connected");
    const faucetContract = new Contract(CONTRACT_ADDRESSES.Faucet, FAUCET_ABI, signer);
    const tx = await faucetContract.requestTokens();
    return tx;
  };

  const swapTokens = async (
    tokenInSymbol: "MYC" | "USDC" | "ONYX",
    tokenOutSymbol: "MYC" | "USDC" | "ONYX",
    amountIn: string,
    minAmountOut: string
  ) => {
    if (!signer) throw new Error("Wallet not connected");

    const isOnyxSwap = tokenInSymbol === "ONYX" || tokenOutSymbol === "ONYX";
    const swapContractAddress = isOnyxSwap ? CONTRACT_ADDRESSES.OnyxSwap : CONTRACT_ADDRESSES.SimpleSwap;
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
    } else {
      tokenInAddress = CONTRACT_ADDRESSES.MockUSDC;
      tokenABI = MOCKUSDC_ABI;
      decimalsIn = 6;
    }

    const decimalsOut = tokenOutSymbol === "USDC" ? 6 : 18;

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
    return tx;
  };

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
        usdcBalance,
        onyxBalance,
        lpBalance,
        reserves,
        onyxReserves,
        transactions,
        loading,
        rpcUrl: DEFAULT_RPC_URL,
        contractConfigured,
        isLocked,
        hasSavedWallet,
        generateNewWallet,
        importWalletFromMnemonic,
        importWalletFromPrivateKey,
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
