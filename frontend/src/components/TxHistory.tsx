import React from "react";
import { useWallet } from "../context/WalletContext";
import { ExternalLink, ArrowUpRight, ArrowDownLeft, RefreshCcw, Gift, Cpu } from "lucide-react";

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
      default:
        return <ExternalLink size={16} />;
    }
  };

  return (
    <div className="glass-card fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "20px" }}>Transaction History</h3>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Last 5000 blocks</span>
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
        <div className="glass-table-container">
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
      )}
    </div>
  );
};
