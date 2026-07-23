import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import { ethers, Contract, parseEther, parseUnits, isAddress } from "ethers";
import { CONTRACT_ADDRESSES, MYCOIN_ABI, MOCKUSDC_ABI } from "../constants/contracts";
import { QRCodeSVG } from "qrcode.react";
import { Send, Download, ArrowRightLeft, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

export const SendReceive: React.FC = () => {
  const {
    address,
    ethBalance,
    mycBalance,
    usdcBalance,
    onyxBalance,
    sendTokens,
    provider,
    contractConfigured,
  } = useWallet();

  const [activeMode, setActiveMode] = useState<"send" | "receive">("send");
  
  // Send state
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [token, setToken] = useState<"ETH" | "MYC" | "USDC" | "ONYX">("ETH");
  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [txMessage, setTxMessage] = useState<{ text: string; error: boolean; txHash?: string } | null>(null);

  // Gas estimation state
  const [gasEstimate, setGasEstimate] = useState<string>("Calculating...");
  
  const getSelectedTokenBalance = () => {
    if (token === "ETH") return ethBalance;
    if (token === "MYC") return mycBalance;
    if (token === "ONYX") return onyxBalance;
    return usdcBalance;
  };

  // Live gas estimation helper
  const estimateGasFee = useCallback(async () => {
    if (!provider || !address || !isAddress(recipient) || !amount || parseFloat(amount) <= 0) {
      setGasEstimate("N/A");
      return;
    }

    try {
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || parseUnits("10", "gwei");

      let gasLimit = 21000n; // default for ETH transfer

      if (token === "MYC" && contractConfigured) {
        const mycContract = new Contract(CONTRACT_ADDRESSES.MyCoin, MYCOIN_ABI, provider);
        gasLimit = await mycContract.transfer.estimateGas(recipient, parseEther(amount))
          .catch(() => 65000n); // fallback
      } else if (token === "USDC" && contractConfigured) {
        const usdcContract = new Contract(CONTRACT_ADDRESSES.MockUSDC, MOCKUSDC_ABI, provider);
        gasLimit = await usdcContract.transfer.estimateGas(recipient, parseUnits(amount, 6))
          .catch(() => 65000n); // fallback
      }

      const totalFee = gasLimit * gasPrice;
      setGasEstimate(`${ethers.formatEther(totalFee).slice(0, 8)} ETH`);
    } catch (err) {
      console.error("Error estimating gas:", err);
      setGasEstimate("Error");
    }
  }, [recipient, amount, token, provider, address, contractConfigured]);

  // Recalculate gas when recipient, amount, or token changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      estimateGasFee();
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [recipient, amount, token, estimateGasFee]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxMessage(null);

    // 1. Validation
    if (!isAddress(recipient)) {
      setTxMessage({ text: "Invalid Ethereum address format.", error: true });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setTxMessage({ text: "Please enter an amount greater than 0.", error: true });
      return;
    }

    const balance = getSelectedTokenBalance();
    if (parseFloat(amount) > parseFloat(balance)) {
      setTxMessage({ text: `Insufficient ${token} balance.`, error: true });
      return;
    }

    // 2. Submit Transaction
    setTxLoading(true);
    try {
      setTxMessage({ text: "Initiating signature request...", error: false });
      const tx = await sendTokens(recipient, amount, token);
      
      setTxMessage({
        text: "Transaction submitted! Waiting for block confirmation...",
        error: false,
        txHash: tx.hash,
      });

      await tx.wait();
      
      setTxMessage({
        text: `Successfully transferred ${amount} ${token} to ${recipient}!`,
        error: false,
        txHash: tx.hash,
      });
      setRecipient("");
      setAmount("");
    } catch (err: any) {
      console.error("Transaction failed:", err);
      let errorMsg = "Transaction failed or rejected by wallet.";
      if (err.reason) {
        errorMsg = `Error: ${err.reason}`;
      } else if (err.message && err.message.includes("user rejected")) {
        errorMsg = "Transaction rejected by user.";
      }
      setTxMessage({ text: errorMsg, error: true });
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: "600px", margin: "0 auto" }}>
      {/* Tab Selector */}
      <div style={{
        display: "flex",
        background: "rgba(0, 0, 0, 0.2)",
        borderRadius: "12px",
        padding: "4px",
        marginBottom: "24px"
      }}>
        <button
          className="btn"
          onClick={() => setActiveMode("send")}
          style={{
            flex: 1,
            background: activeMode === "send" ? "var(--color-primary)" : "transparent",
            color: "#fff",
            borderRadius: "10px",
            boxShadow: "none"
          }}
        >
          <Send size={16} />
          Send Assets
        </button>
        <button
          className="btn"
          onClick={() => setActiveMode("receive")}
          style={{
            flex: 1,
            background: activeMode === "receive" ? "var(--color-primary)" : "transparent",
            color: "#fff",
            borderRadius: "10px",
            boxShadow: "none"
          }}
        >
          <Download size={16} />
          Receive Assets
        </button>
      </div>

      {activeMode === "send" ? (
        <form onSubmit={handleSend} className="fade-in">
          {/* Asset Selection */}
          <div className="form-group">
            <label className="form-label">Asset to Send</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {(["ETH", "MYC", "USDC", "ONYX"] as const).map((sym) => (
                <button
                  type="button"
                  key={sym}
                  className="btn"
                  onClick={() => {
                    setToken(sym);
                    setTxMessage(null);
                  }}
                  style={{
                    flex: 1,
                    background: token === sym ? "rgba(173, 198, 255, 0.12)" : "rgba(0, 0, 0, 0.25)",
                    border: token === sym ? "1px solid var(--color-primary)" : "1px solid var(--border-glass)",
                    color: token === sym ? "var(--color-primary)" : "var(--text-muted)",
                    borderRadius: "12px",
                    boxShadow: "none"
                  }}
                >
                  {sym}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "13px" }}>
              <span style={{ color: "var(--text-muted)" }}>Available Balance:</span>
              <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{getSelectedTokenBalance()} {token}</span>
            </div>
          </div>

          {/* Recipient Input */}
          <div className="form-group">
            <label className="form-label">Recipient Address</label>
            <input
              type="text"
              className="form-input mono-text"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              style={{ fontSize: "14px" }}
              required
            />
          </div>

          {/* Amount Input */}
          <div className="form-group">
            <label className="form-label">Amount</label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                step="any"
                className="form-input"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAmount(getSelectedTokenBalance())}
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  padding: "6px 12px",
                  fontSize: "12px",
                  borderRadius: "8px"
                }}
              >
                MAX
              </button>
            </div>
          </div>

          {/* Gas Estimate Summary */}
          <div style={{
            background: "rgba(0, 0, 0, 0.25)",
            borderRadius: "12px",
            padding: "12px 16px",
            marginBottom: "24px",
            fontSize: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid var(--border-glass)"
          }}>
            <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <ArrowRightLeft size={14} />
              Estimated Gas Fee:
            </span>
            <span className="mono-text" style={{ color: "var(--text-main)", fontWeight: 500 }}>{gasEstimate}</span>
          </div>

          {/* Submit Button */}
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={txLoading}>
            {txLoading ? "Signing & Processing..." : `Send ${token}`}
          </button>

          {/* Messages */}
          {txMessage && (
            <div style={{
              background: txMessage.error ? "rgba(255, 0, 122, 0.08)" : "rgba(0, 240, 255, 0.08)",
              border: txMessage.error ? "1px solid rgba(255, 0, 122, 0.2)" : "1px solid rgba(0, 240, 255, 0.2)",
              color: txMessage.error ? "#ff8da8" : "#94f8ff",
              padding: "16px",
              borderRadius: "12px",
              marginTop: "20px",
              fontSize: "14px"
            }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                {txMessage.error ? <AlertCircle size={18} style={{ flexShrink: 0 }} /> : <CheckCircle2 size={18} style={{ flexShrink: 0 }} />}
                <div>
                  <div style={{ lineHeight: "1.4" }}>{txMessage.text}</div>
                  {txMessage.txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txMessage.txHash}`}
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
                      View on Etherscan: {txMessage.txHash}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      ) : (
        /* Receive Panel */
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
          <p style={{ textAlign: "center" }}>
            Share this address or scan the QR code to receive ETH, MYC, or mock USDC on the Sepolia network.
          </p>

          {/* QR Code Container */}
          {address && (
            <div style={{
              background: "#fff",
              padding: "20px",
              borderRadius: "20px",
              boxShadow: "0 0 30px rgba(143, 82, 255, 0.15)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }}>
              <QRCodeSVG value={address} size={200} />
            </div>
          )}

          {/* Address Display */}
          <div className="form-group" style={{ width: "100%" }}>
            <span className="form-label" style={{ textAlign: "center" }}>Your Public Address</span>
            <div className="mono-text" style={{
              background: "rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--border-glass)",
              padding: "16px",
              borderRadius: "12px",
              fontSize: "13px",
              wordBreak: "break-all",
              textAlign: "center",
              color: "var(--color-secondary)",
              userSelect: "all"
            }}>
              {address}
            </div>
          </div>

          <div style={{
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "12px",
            padding: "12px",
            fontSize: "13px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
            width: "100%"
          }}>
            <HelpCircle size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span>Clicking the address box above selects it for copying.</span>
          </div>
        </div>
      )}
    </div>
  );
};
