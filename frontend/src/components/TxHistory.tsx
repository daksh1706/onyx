import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { ExternalLink, ArrowUpRight, ArrowDownLeft, RefreshCcw, Gift, Cpu, Landmark, RefreshCw } from "lucide-react";

export const TxHistory: React.FC = () => {
  const { transactions, loading, contractConfigured, refreshState } = useWallet();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshState();
    } catch (e) {
      console.error("Failed to refresh transactions:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatTxAmount = (rawAmount: string) => {
    if (!rawAmount) return "";
    if (rawAmount.includes("→") || rawAmount.includes("->")) {
      const parts = rawAmount.split(/→|->/).map(p => p.trim());
      if (parts.length === 2) {
        const p0 = parseFloat(parts[0]);
        const p1 = parseFloat(parts[1]);
        const s0 = isNaN(p0) ? parts[0] : p0.toLocaleString(undefined, { maximumFractionDigits: 4 });
        const s1 = isNaN(p1) ? parts[1] : p1.toLocaleString(undefined, { maximumFractionDigits: 4 });
        return `${s0} → ${s1}`;
      }
    }
    if (rawAmount.includes("+")) return rawAmount;
    const num = parseFloat(rawAmount);
    if (!isNaN(num)) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    return rawAmount;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "Send":
        return <ArrowUpRight size={16} style={{ color: "var(--color-danger)" }} />;
      case "Receive":
        return <ArrowDownLeft size={16} style={{ color: "var(--color-success)" }} />;
      case "Swap":
        return <RefreshCcw size={16} style={{ color: "var(--color-accent)" }} />;
      case "Faucet":
        return <Gift size={16} style={{ color: "var(--color-warning)" }} />;
      case "Deposit":
        return <Landmark size={16} style={{ color: "var(--color-success)" }} />;
      default:
        return <ExternalLink size={16} />;
    }
  };

  return (
    <div className="glass-card fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3 style={{ fontSize: "20px", margin: 0 }}>Transaction History</h3>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Sepolia on-chain & vault records</span>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            fontSize: "12px",
            borderRadius: "8px",
            fontWeight: 600
          }}
        >
          <RefreshCw size={13} className={isRefreshing || loading ? "spin" : ""} />
          <span>{isRefreshing || loading ? "Refreshing..." : "Refresh History"}</span>
        </button>
      </div>

      {!contractConfigured ? (
        <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)" }}>
          Configure contract addresses in .env to display transaction logs.
        </div>
      ) : loading && transactions.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "40px 0", gap: "10px" }}>
          <Cpu size={18} className="spin" style={{ animation: "spin 1s linear infinite" }} />
          <p>Querying Sepolia network logs...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 10px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>No transactions found for this address.</p>
          <p style={{ color: "var(--text-muted)", opacity: 0.7, fontSize: "12px", marginTop: "4px" }}>
            Try claiming from the faucet or making a swap to create on-chain history.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop View (Visible on desktop/tablet only) */}
          <div className="hide-on-mobile glass-table-container">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Asset</th>
                  <th>Amount</th>
                  <th>Recipient/Sender</th>
                  <th>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.hash}>
                    <td style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "none" }}>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "rgba(0, 0, 0, 0.04)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center"
                      }}>
                        {getIcon(tx.type)}
                      </div>
                      <span style={{ fontWeight: 600 }}>{tx.type}</span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ fontSize: "13px" }}>{tx.token}</span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-main)" }}>
                        {formatTxAmount(tx.amount)}
                      </span>
                    </td>
                    <td>
                      {tx.otherAddress ? (
                        <span className="mono-text" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {tx.otherAddress.slice(0, 6)}...{tx.otherAddress.slice(-4)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>-</span>
                      )}
                    </td>
                    <td>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "var(--color-accent)",
                          textDecoration: "none",
                          fontSize: "12px"
                        }}
                        className="mono-text"
                      >
                        {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                        <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View (Clean separate cards with spacious padding and no overlap) */}
          <div className="hide-on-desktop" style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "120px" }}>
            {transactions.map((tx) => (
              <div key={tx.hash} style={{
                padding: "16px 18px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-glass)",
                borderRadius: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.05)",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      flexShrink: 0
                    }}>
                      {getIcon(tx.type)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-main)" }}>{tx.type}</div>
                      <div className="mono-text" style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tx.token}</div>
                    </div>
                  </div>
                  <span className="mono-text" style={{ 
                    fontSize: "13px", 
                    fontWeight: 700, 
                    color: "var(--text-main)", 
                    textAlign: "right",
                    maxWidth: "55%",
                    wordBreak: "break-all",
                    lineHeight: "1.3"
                  }}>
                    {formatTxAmount(tx.amount)}
                  </span>
                </div>

                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  fontSize: "12px", 
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)", 
                  paddingTop: "10px" 
                }}>
                  <span style={{ color: "var(--text-muted)" }}>
                    {tx.type === "Send" ? "To: " : tx.type === "Receive" ? "From: " : "Party: "}
                    {tx.otherAddress ? (
                      <span className="mono-text" style={{ color: "var(--text-main)" }}>{tx.otherAddress.slice(0, 6)}...{tx.otherAddress.slice(-4)}</span>
                    ) : "-"}
                  </span>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono-text"
                    style={{ 
                      color: "var(--color-accent)", 
                      textDecoration: "none", 
                      display: "inline-flex", 
                      alignItems: "center", 
                      gap: "4px",
                      background: "rgba(99, 102, 241, 0.08)",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px"
                    }}
                  >
                    <span>{tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
