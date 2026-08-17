import { useState } from "react";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { WalletInit } from "./components/WalletInit";
import { Dashboard } from "./components/Dashboard";
import { SendReceive } from "./components/SendReceive";
import { Swap } from "./components/Swap";
import { TxHistory } from "./components/TxHistory";
import { LockScreen } from "./components/LockScreen";
import { Markets } from "./components/Markets";
import { Landmark, Send, ArrowRightLeft, Lock, LogOut, Bell, ChevronDown, PieChart, Shield, TrendingUp, History } from "lucide-react";

function MainApp() {
  const { address, isLocked, hasSavedWallet, lockWallet, disconnectWallet } = useWallet();
  const [activeTab, setActiveTab] = useState<"portfolio" | "send" | "swap" | "markets" | "transactions">("portfolio");
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 1. Lock Screen Overlay (Blocks access if saved wallet is locked)
  if (hasSavedWallet && isLocked) {
    return <LockScreen />;
  }

  // 2. Onboarding/Unconnected Screen
  if (!address) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "var(--bg-dark)"
      }}>
        <div style={{ width: "100%", maxWidth: "600px" }}>
          <WalletInit />
        </div>
      </div>
    );
  }

  // Helper to get Title
  const getTabTitle = () => {
    if (activeTab === "portfolio") return "Portfolio Analysis";
    if (activeTab === "send") return "Send / Receive Assets";
    if (activeTab === "swap") return "Swap Exchange";
    if (activeTab === "markets") return "Market Live Rates";
    return "Transaction History Log";
  };

  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  // 3. Connected Layout (Desktop Sidebar vs Mobile Bottom Nav)
  return (
    <div className="desktop-layout">
      {/* ========================================================
          DESKTOP: Left-Side Navigation Sidebar
          ======================================================== */}
      <aside className="sidebar-nav">
        <div className="sidebar-logo" style={{ color: "var(--color-primary)", fontSize: "22px", letterSpacing: "-0.03em" }}>
          MyCoin <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Vault Wallet</span>
        </div>
        <nav className="sidebar-menu">
          <button
            className={`sidebar-menu-item ${activeTab === "portfolio" ? "active" : ""}`}
            onClick={() => setActiveTab("portfolio")}
          >
            <PieChart size={18} />
            Portfolio
          </button>
          <button
            className={`sidebar-menu-item ${activeTab === "send" ? "active" : ""}`}
            onClick={() => setActiveTab("send")}
          >
            <Send size={18} />
            Send/Receive
          </button>
          <button
            className={`sidebar-menu-item ${activeTab === "swap" ? "active" : ""}`}
            onClick={() => setActiveTab("swap")}
          >
            <ArrowRightLeft size={18} />
            Swap
          </button>
          <button
            className={`sidebar-menu-item ${activeTab === "markets" ? "active" : ""}`}
            onClick={() => setActiveTab("markets")}
          >
            <TrendingUp size={18} />
            Markets
          </button>
          <button
            className={`sidebar-menu-item ${activeTab === "transactions" ? "active" : ""}`}
            onClick={() => setActiveTab("transactions")}
          >
            <History size={18} />
            Transactions
          </button>
          
          <button
            className="btn btn-primary"
            onClick={() => setActiveTab("send")}
            style={{
              width: "100%",
              marginTop: "24px",
              padding: "12px",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "13px",
              background: "var(--color-primary)",
              color: "#0b1326",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            New Transaction
          </button>
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="sidebar-footer">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(0, 219, 233, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-primary)"
            }}>
              <Shield size={16} />
            </div>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)" }}>Secure Vault</p>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {truncatedAddress}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn btn-secondary"
              title="Lock Session"
              onClick={lockWallet}
              style={{ flex: 1, padding: "8px", borderRadius: "8px" }}
            >
              <Lock size={14} />
            </button>
            <button
              className="btn btn-secondary"
              title="Disconnect & Wipe"
              onClick={disconnectWallet}
              style={{ flex: 1, padding: "8px", borderRadius: "8px", color: "rgba(255, 0, 85, 0.85)" }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================
          MAIN CONTENT AREA (Sidebar Margin on Desktop)
          ======================================================== */}
      <main className="main-content">
        {/* Desktop Sticky Header */}
        <header className="top-header">
          <h2 className="top-header-title">{getTabTitle()}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <button
              className="circle-btn"
              title="Notifications"
              onClick={() => alert("System Status: All services operational.\nNetwork: Ethereum Sepolia (Localhost Mode).")}
            >
              <Bell size={18} style={{ color: "var(--text-muted)" }} />
            </button>
            <div className="dropdown-pill" onClick={handleCopyAddress}>
              <Landmark size={16} style={{ color: "var(--color-primary)" }} />
              <span className="mono-text">{copied ? "Copied!" : truncatedAddress}</span>
              <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
            </div>
          </div>
        </header>

        {/* Mobile Header (Sticky at top when sidebar is hidden) */}
        <header className="mobile-header">
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--color-primary)" }}>MyCoin</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="dropdown-pill" onClick={handleCopyAddress} style={{ padding: "4px 10px", fontSize: "11px" }}>
              <span className="mono-text">{copied ? "Copied!" : truncatedAddress}</span>
            </div>
            <button className="circle-btn" onClick={lockWallet} style={{ width: "32px", height: "32px" }}>
              <Lock size={14} />
            </button>
          </div>
        </header>

        {/* Dynamic Content Pane */}
        <div className="content-pane">
          <div className="fade-in" style={{ minHeight: "450px" }}>
            {activeTab === "portfolio" && <Dashboard setActiveTab={setActiveTab} />}
            {activeTab === "send" && <SendReceive />}
            {activeTab === "swap" && <Swap />}
            {activeTab === "markets" && <Markets />}
            {activeTab === "transactions" && <TxHistory />}
          </div>

          {/* Persistent transaction history displayed at bottom of current layout */}
          {activeTab === "portfolio" && (
            <div style={{ marginTop: "40px" }}>
              <TxHistory />
            </div>
          )}
        </div>
      </main>

      <nav className="bottom-nav">
        <button
          className={`bottom-nav-item ${activeTab === "portfolio" ? "active" : ""}`}
          onClick={() => setActiveTab("portfolio")}
        >
          <PieChart size={20} />
          Portfolio
        </button>
        <button
          className={`bottom-nav-item ${activeTab === "send" ? "active" : ""}`}
          onClick={() => setActiveTab("send")}
        >
          <Send size={20} />
          Transact
        </button>
        <button
          className={`bottom-nav-item ${activeTab === "swap" ? "active" : ""}`}
          onClick={() => setActiveTab("swap")}
        >
          <ArrowRightLeft size={20} />
          Swap
        </button>
        <button
          className={`bottom-nav-item ${activeTab === "markets" ? "active" : ""}`}
          onClick={() => setActiveTab("markets")}
        >
          <TrendingUp size={20} />
          Markets
        </button>
        <button
          className={`bottom-nav-item ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          <History size={20} />
          Tx History
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <MainApp />
    </WalletProvider>
  );
}
