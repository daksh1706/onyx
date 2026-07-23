import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import { ethers, Contract, parseUnits, formatUnits } from "ethers";
import { CONTRACT_ADDRESSES, SIMPLESWAP_ABI, MYCOIN_ABI, MOCKUSDC_ABI } from "../constants/contracts";
import { ArrowDown, AlertTriangle, Settings, CheckCircle2 } from "lucide-react";

export const Swap: React.FC = () => {
  const {
    address,
    mycBalance,
    usdcBalance,
    onyxBalance,
    provider,
    signer,
    contractConfigured,
    swapTokens,
    reserves,
    onyxReserves,
    refreshState,
  } = useWallet();

  const [fromToken, setFromToken] = useState<"MYC" | "USDC" | "ONYX">("MYC");
  const [toToken, setToToken] = useState<"MYC" | "USDC" | "ONYX">("USDC");
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(0.5); // 0.5% default
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // States for live checks
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [allowanceNeeded, setAllowanceNeeded] = useState<boolean>(false);
  const [checkingAllowance, setCheckingAllowance] = useState<boolean>(false);
  
  // Swap process states
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionStep, setActionStep] = useState<"none" | "approving" | "swapping">("none");
  const [swapMessage, setSwapMessage] = useState<{ text: string; error: boolean; hash?: string } | null>(null);

  // Check if direct pool exists
  const isValidPair =
    (fromToken === "MYC" && toToken === "USDC") ||
    (fromToken === "USDC" && toToken === "MYC") ||
    (fromToken === "ONYX" && toToken === "USDC") ||
    (fromToken === "USDC" && toToken === "ONYX");

  // Get active reserves based on selected tokens
  const getActiveReserves = (): { reserveIn: number; reserveOut: number } | null => {
    if (fromToken === "MYC" && toToken === "USDC") {
      return reserves ? { reserveIn: parseFloat(reserves.reserveA), reserveOut: parseFloat(reserves.reserveB) } : null;
    }
    if (fromToken === "USDC" && toToken === "MYC") {
      return reserves ? { reserveIn: parseFloat(reserves.reserveB), reserveOut: parseFloat(reserves.reserveA) } : null;
    }
    if (fromToken === "ONYX" && toToken === "USDC") {
      return onyxReserves ? { reserveIn: parseFloat(onyxReserves.reserveA), reserveOut: parseFloat(onyxReserves.reserveB) } : null;
    }
    if (fromToken === "USDC" && toToken === "ONYX") {
      return onyxReserves ? { reserveIn: parseFloat(onyxReserves.reserveB), reserveOut: parseFloat(onyxReserves.reserveA) } : null;
    }
    return null;
  };

  const activeReserves = getActiveReserves();

  // Calculate price impact
  const calculatePriceImpact = (): { percent: number; level: "low" | "medium" | "high" } => {
    if (!activeReserves || !amountIn || !amountOut || parseFloat(amountIn) <= 0 || parseFloat(amountOut) <= 0) {
      return { percent: 0, level: "low" };
    }

    const inVal = parseFloat(amountIn);
    const outVal = parseFloat(amountOut);
    const { reserveIn, reserveOut } = activeReserves;

    if (reserveIn === 0 || reserveOut === 0) return { percent: 0, level: "low" };

    // Ideal exchange rate (no fee, marginal price)
    const idealRate = reserveOut / reserveIn;
    // Actual exchange rate
    const actualRate = outVal / inVal;

    // Price impact = (1 - actualRate / idealRate) * 100
    const impact = (1 - (actualRate / idealRate)) * 100;

    let level: "low" | "medium" | "high" = "low";
    if (impact > 5) level = "high";
    else if (impact > 2) level = "medium";

    return {
      percent: Math.max(0, parseFloat(impact.toFixed(2))),
      level
    };
  };

  const priceImpact = calculatePriceImpact();

  // Switch from/to tokens
  const handleSwitchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setAmountIn(amountOut);
    setAmountOut(amountIn);
    setSwapMessage(null);
  };

  // Get Live Quote
  const getLiveQuote = useCallback(async () => {
    if (!provider || !contractConfigured || !amountIn || parseFloat(amountIn) <= 0 || !isValidPair) {
      setAmountOut("");
      return;
    }

    setQuoteLoading(true);
    try {
      const isOnyxSwap = fromToken === "ONYX" || toToken === "ONYX";
      const swapContractAddress = isOnyxSwap ? CONTRACT_ADDRESSES.OnyxSwap : CONTRACT_ADDRESSES.SimpleSwap;
      const swapContract = new Contract(swapContractAddress, SIMPLESWAP_ABI, provider);

      let tokenInAddress = "";
      let decimalsIn = 18;

      if (fromToken === "MYC") {
        tokenInAddress = CONTRACT_ADDRESSES.MyCoin;
        decimalsIn = 18;
      } else if (fromToken === "ONYX") {
        tokenInAddress = CONTRACT_ADDRESSES.CustomToken;
        decimalsIn = 18;
      } else {
        tokenInAddress = CONTRACT_ADDRESSES.MockUSDC;
        decimalsIn = 6;
      }

      const decimalsOut = toToken === "USDC" ? 6 : 18;

      const rawIn = parseUnits(amountIn, decimalsIn);
      const rawOut = await swapContract.getAmountOut(tokenInAddress, rawIn);
      const formattedOut = formatUnits(rawOut, decimalsOut);

      setAmountOut(formattedOut);
    } catch (err) {
      console.error("Error getting quote:", err);
      setAmountOut("");
    } finally {
      setQuoteLoading(false);
    }
  }, [fromToken, toToken, amountIn, provider, contractConfigured, isValidPair]);

  // Trigger quote refresh
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      getLiveQuote();
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [amountIn, fromToken, toToken, getLiveQuote]);

  // Check ERC20 Allowance
  const checkAllowance = useCallback(async () => {
    if (!address || !provider || !contractConfigured || !amountIn || parseFloat(amountIn) <= 0 || !isValidPair) {
      setAllowanceNeeded(false);
      return;
    }

    setCheckingAllowance(true);
    try {
      const isOnyxSwap = fromToken === "ONYX" || toToken === "ONYX";
      const swapContractAddress = isOnyxSwap ? CONTRACT_ADDRESSES.OnyxSwap : CONTRACT_ADDRESSES.SimpleSwap;

      let tokenInAddress = "";
      let tokenABI: any = MYCOIN_ABI;
      let decimalsIn = 18;

      if (fromToken === "MYC") {
        tokenInAddress = CONTRACT_ADDRESSES.MyCoin;
        tokenABI = MYCOIN_ABI;
        decimalsIn = 18;
      } else if (fromToken === "ONYX") {
        tokenInAddress = CONTRACT_ADDRESSES.CustomToken;
        tokenABI = MYCOIN_ABI;
        decimalsIn = 18;
      } else {
        tokenInAddress = CONTRACT_ADDRESSES.MockUSDC;
        tokenABI = MOCKUSDC_ABI;
        decimalsIn = 6;
      }

      const tokenContract = new Contract(tokenInAddress, tokenABI, provider);
      const allowance = await tokenContract.allowance(address, swapContractAddress);
      const rawIn = parseUnits(amountIn, decimalsIn);

      setAllowanceNeeded(allowance < rawIn);
    } catch (err) {
      console.error("Error checking allowance:", err);
    } finally {
      setCheckingAllowance(false);
    }
  }, [address, fromToken, toToken, amountIn, provider, contractConfigured, isValidPair]);

  useEffect(() => {
    checkAllowance();
  }, [amountIn, fromToken, toToken, checkAllowance]);

  // Execute Swap or Approval
  const handleSwapAction = async () => {
    if (!signer || !amountIn || !amountOut || !isValidPair) return;

    setActionLoading(true);
    setSwapMessage(null);

    try {
      const isOnyxSwap = fromToken === "ONYX" || toToken === "ONYX";
      const swapContractAddress = isOnyxSwap ? CONTRACT_ADDRESSES.OnyxSwap : CONTRACT_ADDRESSES.SimpleSwap;

      let tokenInAddress = "";
      let tokenABI: any = MYCOIN_ABI;

      if (fromToken === "MYC") {
        tokenInAddress = CONTRACT_ADDRESSES.MyCoin;
        tokenABI = MYCOIN_ABI;
      } else if (fromToken === "ONYX") {
        tokenInAddress = CONTRACT_ADDRESSES.CustomToken;
        tokenABI = MYCOIN_ABI;
      } else {
        tokenInAddress = CONTRACT_ADDRESSES.MockUSDC;
        tokenABI = MOCKUSDC_ABI;
      }

      // 1. Handle ERC20 Approval if needed
      if (allowanceNeeded) {
        setActionStep("approving");
        setSwapMessage({ text: `Requesting ${fromToken} allowance approval...`, error: false });
        
        const tokenContract = new Contract(tokenInAddress, tokenABI, signer);
        const approveTx = await tokenContract.approve(swapContractAddress, ethers.MaxUint256);
        
        setSwapMessage({ text: "Approving token allowance on-chain...", error: false });
        await approveTx.wait();
        
        setAllowanceNeeded(false);
        setSwapMessage({ text: "Approval confirmed! Proceeding to swap...", error: false });
      }

      // 2. Perform Swap
      setActionStep("swapping");
      setSwapMessage({ text: "Requesting swap signature...", error: false });

      const decimalsOut = toToken === "USDC" ? 6 : 18;

      // Calculate minAmountOut based on slippage setting
      const outVal = parseFloat(amountOut);
      const minOutVal = outVal * (1 - slippage / 100);
      const minAmountOutStr = minOutVal.toFixed(decimalsOut);

      const tx = await swapTokens(fromToken, toToken, amountIn, minAmountOutStr);
      setSwapMessage({ text: "Transaction submitted! Confirming on-chain...", error: false, hash: tx.hash });
      
      await tx.wait();

      setSwapMessage({
        text: `Swapped ${amountIn} ${fromToken} for ${parseFloat(amountOut).toFixed(4)} ${toToken}!`,
        error: false,
        hash: tx.hash,
      });

      setAmountIn("");
      setAmountOut("");
      refreshState();
    } catch (err: any) {
      console.error("Swap action failed:", err);
      let errMsg = "Swap transaction failed.";
      if (err.message && err.message.includes("user rejected")) {
        errMsg = "Transaction signature rejected.";
      } else if (err.reason) {
        errMsg = `Error: ${err.reason}`;
      }
      setSwapMessage({ text: errMsg, error: true });
    } finally {
      setActionLoading(false);
      setActionStep("none");
    }
  };

  const getFromBalance = () => {
    if (fromToken === "MYC") return mycBalance;
    if (fromToken === "USDC") return usdcBalance;
    return onyxBalance;
  };

  const getToBalance = () => {
    if (toToken === "MYC") return mycBalance;
    if (toToken === "USDC") return usdcBalance;
    return onyxBalance;
  };

  const isButtonDisabled = () => {
    if (!isValidPair) return true;
    if (actionLoading || checkingAllowance || quoteLoading) return true;
    if (!amountIn || parseFloat(amountIn) <= 0) return true;
    if (parseFloat(amountIn) > parseFloat(getFromBalance())) return true;
    return false;
  };

  const getButtonText = () => {
    if (!isValidPair) return "Swap Route Not Supported";
    if (actionLoading) {
      if (actionStep === "approving") return "Approving Token Allowance...";
      if (actionStep === "swapping") return "Executing Swap...";
      return "Processing...";
    }
    if (quoteLoading) return "Fetching Quote...";
    if (!amountIn || parseFloat(amountIn) <= 0) return "Enter an Amount";
    if (parseFloat(amountIn) > parseFloat(getFromBalance())) return `Insufficient ${fromToken} Balance`;
    if (allowanceNeeded) return `Approve ${fromToken}`;
    return "Swap Tokens";
  };

  return (
    <div className="glass-card" style={{ maxWidth: "480px", margin: "0 auto", position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "20px" }}>Swap Assets</h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
        >
          <Settings size={18} style={{ color: showSettings ? "var(--color-secondary)" : "inherit" }} />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-card fade-in" style={{
          background: "rgba(0, 0, 0, 0.02)",
          padding: "16px",
          borderRadius: "12px",
          marginBottom: "20px",
          border: "1px solid var(--border-glass)"
        }}>
          <h4 style={{ fontSize: "14px", color: "var(--text-main)", marginBottom: "12px" }}>Transaction Settings</h4>
          <div className="form-group" style={{ marginBottom: "0" }}>
            <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Slippage Tolerance</span>
              <span className="mono-text" style={{ color: "var(--color-secondary)" }}>{slippage}%</span>
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              {[0.1, 0.5, 1.0, 2.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  className="btn"
                  onClick={() => setSlippage(val)}
                  style={{
                    flex: 1,
                    background: slippage === val ? "rgba(0, 102, 255, 0.1)" : "rgba(0, 0, 0, 0.03)",
                    border: slippage === val ? "1px solid var(--color-secondary)" : "1px solid var(--border-glass)",
                    color: slippage === val ? "var(--color-secondary)" : "var(--text-muted)",
                    padding: "8px 0",
                    fontSize: "12px",
                    borderRadius: "8px",
                    boxShadow: "none"
                  }}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Liquidity Pools Display */}
      <div style={{
        background: "rgba(0, 0, 0, 0.15)",
        border: "1px solid var(--border-glass)",
        borderRadius: "12px",
        padding: "12px 16px",
        marginBottom: "20px",
        fontSize: "13px"
      }}>
        <h4 style={{ fontWeight: 600, marginBottom: "8px", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.05em" }}>
          Active AMM Liquidity Pools
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>MYC ➔ USDC Pool Reserves</span>
            <span className="mono-text" style={{ color: "var(--color-primary)", fontSize: "12px" }}>
              {reserves ? `${parseFloat(reserves.reserveA).toLocaleString(undefined, {maximumFractionDigits:0})} MYC / ${parseFloat(reserves.reserveB).toLocaleString(undefined, {maximumFractionDigits:0})} USDC` : "Loading..."}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>ONYX ➔ USDC Pool Reserves</span>
            <span className="mono-text" style={{ color: "var(--color-primary)", fontSize: "12px" }}>
              {onyxReserves ? `${parseFloat(onyxReserves.reserveA).toLocaleString(undefined, {maximumFractionDigits:0})} ONYX / ${parseFloat(onyxReserves.reserveB).toLocaleString(undefined, {maximumFractionDigits:0})} USDC` : "Loading..."}
            </span>
          </div>
        </div>
      </div>

      {/* Swap inputs container */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", position: "relative" }}>
        
        {/* From Box */}
        <div style={{
          background: "rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--border-glass)",
          borderRadius: "16px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "13px" }}>
            <span>From</span>
            <span>Balance: {parseFloat(getFromBalance()).toFixed(4)} {fromToken}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <input
              type="number"
              step="any"
              className="mono-text"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              disabled={actionLoading}
              style={{
                background: "none",
                border: "none",
                fontSize: "24px",
                color: "var(--text-main)",
                outline: "none",
                width: "55%"
              }}
            />
            <select
              value={fromToken}
              onChange={(e) => {
                const selected = e.target.value as "MYC" | "USDC" | "ONYX";
                setFromToken(selected);
                setSwapMessage(null);
              }}
              disabled={actionLoading}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid var(--border-glass)",
                borderRadius: "12px",
                padding: "8px 12px",
                color: "var(--text-main)",
                fontWeight: 600,
                fontSize: "14px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="MYC" style={{ background: "var(--bg-dark)" }}>MYC</option>
              <option value="USDC" style={{ background: "var(--bg-dark)" }}>USDC</option>
              <option value="ONYX" style={{ background: "var(--bg-dark)" }}>ONYX</option>
            </select>
          </div>
        </div>

        {/* Switch Button */}
        <button
          onClick={handleSwitchTokens}
          disabled={actionLoading}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--bg-dark)",
            border: "1px solid var(--border-glass)",
            color: "var(--color-secondary)",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            zIndex: 2,
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.05)"
          }}
        >
          <ArrowDown size={16} />
        </button>

        {/* To Box */}
        <div style={{
          background: "rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--border-glass)",
          borderRadius: "16px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginTop: "4px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "13px" }}>
            <span>To (Estimated)</span>
            <span>Balance: {parseFloat(getToBalance()).toFixed(4)} {toToken}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <input
              type="text"
              className="mono-text"
              placeholder="0.0"
              value={quoteLoading ? "..." : amountOut}
              readOnly
              style={{
                background: "none",
                border: "none",
                fontSize: "24px",
                color: "var(--text-main)",
                outline: "none",
                width: "55%"
              }}
            />
            <select
              value={toToken}
              onChange={(e) => {
                const selected = e.target.value as "MYC" | "USDC" | "ONYX";
                setToToken(selected);
                setSwapMessage(null);
              }}
              disabled={actionLoading}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid var(--border-glass)",
                borderRadius: "12px",
                padding: "8px 12px",
                color: "var(--text-main)",
                fontWeight: 600,
                fontSize: "14px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="MYC" style={{ background: "var(--bg-dark)" }}>MYC</option>
              <option value="USDC" style={{ background: "var(--bg-dark)" }}>USDC</option>
              <option value="ONYX" style={{ background: "var(--bg-dark)" }}>ONYX</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quote Rate Details */}
      {amountIn && amountOut && isValidPair && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background: "rgba(0, 0, 0, 0.2)",
          borderRadius: "12px",
          padding: "12px 16px",
          marginTop: "16px",
          fontSize: "13px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
            <span>Exchange Rate</span>
            <span style={{ color: "var(--text-main)" }}>
              1 {fromToken} = {(parseFloat(amountOut) / parseFloat(amountIn)).toFixed(4)} {toToken}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
            <span>Price Impact</span>
            <span style={{
              color: priceImpact.level === "high" ? "#ff4da6" : priceImpact.level === "medium" ? "orange" : "var(--color-secondary)",
              fontWeight: 600
            }}>
              {priceImpact.percent}%
            </span>
          </div>
        </div>
      )}

      {/* Unsupported Route Warnings */}
      {!isValidPair && (
        <div style={{
          background: "rgba(255, 0, 122, 0.08)",
          border: "1px solid rgba(255, 0, 122, 0.2)",
          color: "#ff8da8",
          padding: "12px 16px",
          borderRadius: "12px",
          marginTop: "16px",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>
            {fromToken === toToken 
              ? "Cannot swap the same token." 
              : "Direct swap route not supported. Swap via USDC (e.g. MYC ➔ USDC ➔ ONYX)."}
          </span>
        </div>
      )}

      {/* Price Impact Warnings */}
      {priceImpact.level !== "low" && amountIn && amountOut && isValidPair && (
        <div style={{
          background: priceImpact.level === "high" ? "rgba(255, 0, 122, 0.08)" : "rgba(255, 166, 0, 0.08)",
          border: priceImpact.level === "high" ? "1px solid rgba(255, 0, 122, 0.2)" : "1px solid rgba(255, 166, 0, 0.2)",
          color: priceImpact.level === "high" ? "#ff8da8" : "#decba4",
          padding: "12px 16px",
          borderRadius: "12px",
          marginTop: "16px",
          fontSize: "13px",
          display: "flex",
          gap: "8px"
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>
            {priceImpact.level === "high" 
              ? "High price impact! You will lose significant value due to thin liquidity pool reserves." 
              : "Warning: Slippage and price impact are elevated. Please double check pool ratios."}
          </span>
        </div>
      )}

      {/* Swap Action Button */}
      <button
        onClick={handleSwapAction}
        disabled={isButtonDisabled()}
        className={`btn ${allowanceNeeded && isValidPair ? "btn-accent" : "btn-primary"}`}
        style={{ width: "100%", marginTop: "20px", height: "48px" }}
      >
        {getButtonText()}
      </button>

      {/* Message Output */}
      {swapMessage && (
        <div style={{
          background: swapMessage.error ? "rgba(255, 0, 122, 0.08)" : "rgba(0, 240, 255, 0.08)",
          border: swapMessage.error ? "1px solid rgba(255, 0, 122, 0.2)" : "1px solid rgba(0, 240, 255, 0.2)",
          color: swapMessage.error ? "#ff8da8" : "#94f8ff",
          padding: "16px",
          borderRadius: "12px",
          marginTop: "20px",
          fontSize: "14px"
        }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
            {swapMessage.error ? <AlertTriangle size={18} style={{ flexShrink: 0 }} /> : <CheckCircle2 size={18} style={{ flexShrink: 0 }} />}
            <div>
              <div style={{ lineHeight: "1.4" }}>{swapMessage.text}</div>
              {swapMessage.hash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${swapMessage.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono-text"
                  style={{
                    color: "var(--color-secondary)",
                    textDecoration: "underline",
                    display: "block",
                    marginTop: "8px",
                    fontSize: "12px",
                    wordBreak: "break-all"
                  }}
                >
                  View tx: {swapMessage.hash.slice(0, 20)}...
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
