import React from "react";
import { useWallet } from "../context/WalletContext";
import { ExternalLink, ArrowUpRight, ArrowDownLeft, RefreshCcw, Gift, Cpu, Landmark } from "lucide-react";

export const TxHistory: React.FC = () => {
  const { transactions, loading, contractConfigured } = useWallet();

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "20px" }}>Transaction History</h3>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Last 100k blocks</span>
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
                        {tx.amount}
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

          {/* Mobile View (Visible on mobile only, prevents wide table overflow stretching) */}
          <div className="hide-on-desktop" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {transactions.map((tx) => (
              <div key={tx.hash} style={{
                padding: "16px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-glass)",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-main)" }}>{tx.type}</div>
                      <div className="mono-text" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tx.token}</div>
                    </div>
                  </div>
                  <span className="mono-text" style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
                    {tx.amount}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", borderTop: "1px dashed var(--border-glass)", paddingTop: "8px" }}>
                  <span style={{ color: "var(--text-muted)" }}>
                    {tx.type === "Send" ? "To: " : tx.type === "Receive" ? "From: " : "Party: "}
                    {tx.otherAddress ? (
                      <span className="mono-text">{tx.otherAddress.slice(0, 6)}...{tx.otherAddress.slice(-4)}</span>
                    ) : "-"}
                  </span>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono-text"
                    style={{ color: "var(--color-accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                    <ExternalLink size={12} />
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
