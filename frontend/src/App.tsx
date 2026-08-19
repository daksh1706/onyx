import { useState, useRef } from "react";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { WalletInit } from "./components/WalletInit";
import { Dashboard } from "./components/Dashboard";
import { SendReceive } from "./components/SendReceive";
import { Swap } from "./components/Swap";
import { TxHistory } from "./components/TxHistory";
import { LockScreen } from "./components/LockScreen";
import { Markets } from "./components/Markets";
import { Landmark, Send, ArrowRightLeft, Lock, LogOut, Bell, ChevronDown, PieChart, Shield, TrendingUp, History, Check, Download, Plus, Trash2, Edit, Camera } from "lucide-react";

function MainApp() {
  const { 
    address, 
    isLocked, 
    hasSavedWallet, 
    lockWallet, 
    disconnectWallet, 
    transactions,
    username,
    fullName,
    email,
    phone,
    img,
    banks,
    updateProfile,
    addBankAccount,
    removeBankAccount,
    changePassword,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<"portfolio" | "send" | "swap" | "markets" | "transactions">("portfolio");
  const [sendReceiveMode, setSendReceiveMode] = useState<"send" | "receive" | "deposit">("deposit");
  const [copied, setCopied] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passcodeMessage, setPasscodeMessage] = useState("");
  const [passcodeError, setPasscodeError] = useState("");

  const [newBankName, setNewBankName] = useState("");
  const [newBankAccNumber, setNewBankAccNumber] = useState("");
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempPhone, setTempPhone] = useState("");
  const [tempEmail, setTempEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = fullName || username || "Onyx User";
  const displayPhone = phone || "Not provided";
  const displayEmail = email || "Not provided";
  const displayPic = img || "/user_avatar.jpg";

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          try {
            await updateProfile({ img: base64 });
          } catch (err) {
            console.error("Failed to upload avatar to MongoDB:", err);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Sync temp variables when editing is opened
  const handleStartEditing = () => {
    setTempName(fullName || "");
    setTempPhone(phone || "");
    setTempEmail(email || "");
    setIsEditingDetails(true);
  };

  const handleSaveProfileDetails = async () => {
    setProfileLoading(true);
    try {
      await updateProfile({
        fullName: tempName.trim(),
        phone: tempPhone.trim(),
        email: tempEmail.trim(),
      });
      setIsEditingDetails(false);
    } catch (err) {
      console.error("Failed to save profile to MongoDB:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim()) return;
    setBankLoading(true);
    setBankError(null);
    try {
      const generatedAccNumber = newBankAccNumber.trim() || `**** ${Math.floor(1000 + Math.random() * 9000)}`;
      await addBankAccount({
        bankName: newBankName.trim(),
        accountNumber: generatedAccNumber,
      });
      setNewBankName("");
      setNewBankAccNumber("");
    } catch (err: any) {
      setBankError(err.message || "Failed to link bank account");
    } finally {
      setBankLoading(false);
    }
  };

  const handleRemoveBankAccount = async (bankId: string) => {
    try {
      await removeBankAccount(bankId);
    } catch (err) {
      console.error("Failed to remove bank account:", err);
    }
  };

  const handleResetPasscode = async () => {
    if (!passcode || passcode.length < 6) {
      setPasscodeError("Passcode must be at least 6 characters.");
      return;
    }
    setPasscodeError("");
    try {
      await changePassword(passcode);
      setPasscodeMessage("Security passcode updated successfully!");
      setPasscode("");
      setTimeout(() => setPasscodeMessage(""), 4000);
    } catch (err: any) {
      setPasscodeError(err.message || "Failed to update passcode");
    }
  };

  const handleDownloadStatement = () => {
    if (!transactions || transactions.length === 0) {
      alert("No transaction logs available to download.");
      return;
    }
    const headers = ["Type", "Token", "Amount", "Counterparty", "Transaction Hash"];
    const rows = transactions.map(tx => [
      tx.type,
      tx.token,
      tx.amount,
      tx.otherAddress || "N/A",
      tx.hash
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Onyx_Wallet_Statement_${address}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          ONYX <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Vault Wallet</span>
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
              background: "var(--color-primary-glow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-accent)"
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
              style={{ flex: 1, padding: "8px", borderRadius: "8px", color: "var(--color-danger)" }}
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
              <Landmark size={16} style={{ color: "var(--color-accent)" }} />
              <span className="mono-text">{copied ? "Copied!" : truncatedAddress}</span>
              <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
            </div>
          </div>
        </header>

        {/* Mobile Header (Fixed at top when sidebar is hidden) */}
        <header className="mobile-header" style={{ position: "fixed", display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
          <button 
            className="circle-btn" 
            onClick={() => setShowProfile(true)} 
            style={{ 
              width: "32px", 
              height: "32px", 
              border: "none", 
              background: "transparent", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              position: "absolute", 
              left: "24px", 
              bottom: "14px",
              padding: 0,
              borderRadius: "50%",
              overflow: "hidden"
            }}
          >
            <img 
              src={displayPic} 
              alt="User Avatar" 
              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/identicon/svg?seed=" + (username || "onyx");
              }}
            />
          </button>
          
          <div style={{
            fontFamily: "var(--font-headline)",
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "var(--color-primary)",
            textAlign: "center",
            paddingBottom: "2px"
          }}>
            ONYX
          </div>

          <div style={{ position: "absolute", right: "24px", bottom: "14px", display: "flex", alignItems: "center" }}>
            <div className="dropdown-pill" onClick={handleCopyAddress} style={{ padding: "6px 10px", fontSize: "11px" }}>
              <span className="mono-text">{copied ? "Copied!" : truncatedAddress}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Content Pane */}
        <div className="content-pane">
          <div className="fade-in" style={{ minHeight: "450px" }}>
            {activeTab === "portfolio" && (
              <Dashboard
                setActiveTab={(tab) => {
                  if (tab === "send") {
                    setSendReceiveMode("send");
                    setActiveTab("send");
                  } else if (tab === "receive") {
                    setSendReceiveMode("receive");
                    setActiveTab("send");
                  } else {
                    setActiveTab(tab as any);
                  }
                }}
              />
            )}
            {activeTab === "send" && <SendReceive initialMode={sendReceiveMode} />}
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
          title="Portfolio"
        >
          <PieChart size={24} />
        </button>
        <button
          className={`bottom-nav-item ${activeTab === "send" ? "active" : ""}`}
          onClick={() => {
            setSendReceiveMode("deposit");
            setActiveTab("send");
          }}
          title="Deposit"
        >
          <Landmark size={24} />
        </button>
        <button
          className={`bottom-nav-item ${activeTab === "swap" ? "active" : ""}`}
          onClick={() => setActiveTab("swap")}
          title="Swap"
        >
          <ArrowRightLeft size={24} />
        </button>
        <button
          className={`bottom-nav-item ${activeTab === "markets" ? "active" : ""}`}
          onClick={() => setActiveTab("markets")}
          title="Markets"
        >
          <TrendingUp size={24} />
        </button>
        <button
          className={`bottom-nav-item ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
          title="History"
        >
          <History size={24} />
        </button>
      </nav>

      {/* Slide-Up User Profile Settings Drawer */}
      {showProfile && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 1000,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          backdropFilter: "blur(4px)",
          animation: "fadeIn 0.2s ease-out"
        }} onClick={() => setShowProfile(false)}>
          <div style={{
            background: "var(--bg-card)",
            borderTop: "1px solid var(--border-glass)",
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
            width: "100%",
            maxWidth: "500px",
            maxHeight: "85vh",
            overflowY: "auto",
            padding: "24px 24px max(40px, calc(24px + env(safe-area-inset-bottom))) 24px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            animation: "slideUp 0.3s cubic-bezier(0.1, 0.9, 0.2, 1)"
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header Drag Handle */}
            <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.15)", borderRadius: "2px", margin: "0 auto 8px auto" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px" }}>User Profile & Settings</h3>
              <button 
                className="btn btn-secondary" 
                style={{ padding: "6px 12px", borderRadius: "100px", fontSize: "12px" }}
                onClick={() => setShowProfile(false)}
              >
                Done
              </button>
            </div>

            {/* Profile details card */}
            <div className="glass-panel" style={{ padding: "16px", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div 
                  onClick={handleAvatarClick}
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    cursor: "pointer",
                    position: "relative",
                    border: "2px solid var(--color-primary)",
                    background: "rgba(99,102,241,0.1)"
                  }}
                  title="Change Profile Picture"
                >
                  <img 
                    src={displayPic} 
                    alt="User Avatar" 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/identicon/svg?seed=" + (username || "onyx");
                    }}
                  />
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%"
                  }}>
                    <Camera size={14} style={{ color: "white" }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
                      {displayName}
                    </span>
                    {!isEditingDetails && (
                      <button 
                        onClick={handleStartEditing} 
                        style={{ background: "transparent", border: "none", color: "var(--color-primary)", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
                        title="Edit Details"
                      >
                        <Edit size={14} />
                      </button>
                    )}
                  </div>
                  <div className="mono-text" style={{ fontSize: "11px", color: "var(--text-muted)", wordBreak: "break-all" }}>
                    {address}
                  </div>
                </div>
              </div>

              {/* Editable profile fields */}
              {isEditingDetails ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Full Name</label>
                    <input 
                      type="text" 
                      value={tempName} 
                      placeholder="e.g. John Doe"
                      onChange={(e) => setTempName(e.target.value)} 
                      style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-glass)", borderRadius: "8px", padding: "8px", color: "var(--text-main)", fontSize: "12px" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Phone Number</label>
                    <input 
                      type="tel" 
                      value={tempPhone} 
                      placeholder="e.g. +91 98765 43210"
                      onChange={(e) => setTempPhone(e.target.value)} 
                      style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-glass)", borderRadius: "8px", padding: "8px", color: "var(--text-main)", fontSize: "12px" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Email Address</label>
                    <input 
                      type="email" 
                      value={tempEmail} 
                      placeholder="e.g. user@example.com"
                      onChange={(e) => setTempEmail(e.target.value)} 
                      style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-glass)", borderRadius: "8px", padding: "8px", color: "var(--text-main)", fontSize: "12px" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ flex: 1, padding: "8px", fontSize: "12px" }} 
                      onClick={() => setIsEditingDetails(false)}
                      disabled={profileLoading}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 1, padding: "8px", fontSize: "12px" }} 
                      onClick={handleSaveProfileDetails}
                      disabled={profileLoading}
                    >
                      {profileLoading ? "Saving..." : "Save Details"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Phone:</span>
                    <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{displayPhone}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Email:</span>
                    <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{displayEmail}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Linked Bank Accounts Manager */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Linked Bank Accounts</h4>
                <span style={{ fontSize: "11px", color: "var(--color-primary)", fontWeight: 600 }}>{banks.length} Connected</span>
              </div>
              
              <div className="glass-panel" style={{ padding: "16px", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                
                {/* Bank List from MongoDB */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {banks.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                      No bank accounts connected yet. Link your Indian bank account below to deposit INR.
                    </div>
                  ) : (
                    banks.map((bank) => (
                      <div key={bank._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Landmark size={14} style={{ color: "var(--color-primary)" }} />
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{bank.bankName}</span>
                            {bank.isPrimary && (
                              <span style={{ fontSize: "9px", background: "rgba(99,102,241,0.2)", color: "var(--color-primary)", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                PRIMARY
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "20px" }}>{bank.accountNumber}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveBankAccount(bank._id)}
                          style={{ background: "transparent", border: "none", color: "var(--color-danger)", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
                          title="Remove Account"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {bankError && (
                  <div style={{ color: "var(--color-danger)", fontSize: "12px" }}>{bankError}</div>
                )}

                {/* Add new Bank Form */}
                <form onSubmit={handleAddBankAccount} style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="Bank Name (e.g. HDFC Bank)"
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      style={{
                        flex: 1,
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--border-glass)",
                        borderRadius: "10px",
                        padding: "8px 12px",
                        color: "var(--text-main)",
                        fontSize: "12px"
                      }}
                      required
                      disabled={bankLoading}
                    />
                    <input
                      type="text"
                      placeholder="Acc No. (or **** 1234)"
                      value={newBankAccNumber}
                      onChange={(e) => setNewBankAccNumber(e.target.value)}
                      style={{
                        width: "120px",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--border-glass)",
                        borderRadius: "10px",
                        padding: "8px 12px",
                        color: "var(--text-main)",
                        fontSize: "12px"
                      }}
                      disabled={bankLoading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: "8px 12px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    disabled={bankLoading || !newBankName.trim()}
                  >
                    <Plus size={14} /> {bankLoading ? "Linking..." : "Link Bank Account"}
                  </button>
                </form>
              </div>
            </div>

            {/* Password Reset Form Block */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h4 style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Security Passcode</h4>
              <div className="glass-panel" style={{ padding: "16px", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="password"
                    placeholder="New Passcode (Min 6 chars)"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    style={{
                      flex: 1,
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid var(--border-glass)",
                      borderRadius: "10px",
                      padding: "10px",
                      color: "var(--text-main)",
                      fontSize: "13px"
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleResetPasscode}
                    disabled={!passcode || passcode.length < 6}
                    style={{ padding: "10px 16px", fontSize: "13px", fontWeight: 700 }}
                  >
                    Update
                  </button>
                </div>
                {passcodeError && (
                  <div style={{ fontSize: "12px", color: "var(--color-danger)" }}>
                    {passcodeError}
                  </div>
                )}
                {passcodeMessage && (
                  <div style={{ fontSize: "12px", color: "var(--color-success)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Check size={12} />
                    {passcodeMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Account Statements */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h4 style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reports & Statements</h4>
              <button 
                className="btn btn-secondary" 
                onClick={handleDownloadStatement}
                style={{
                  padding: "14px",
                  borderRadius: "16px",
                  width: "100%",
                  fontWeight: 700,
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                <Download size={16} />
                Download Account Statement (CSV)
              </button>
            </div>

            {/* Log Out Control */}
            <button 
              className="btn btn-secondary"
              onClick={() => {
                disconnectWallet();
                setShowProfile(false);
              }}
              style={{
                padding: "14px",
                borderRadius: "16px",
                width: "100%",
                fontWeight: 700,
                color: "var(--color-danger)",
                borderColor: "rgba(161, 61, 52, 0.2)",
                fontSize: "13px"
              }}
            >
              Disconnect & Wipe Wallet Session
            </button>

            {/* Hidden file input for changing avatar */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              style={{ display: "none" }} 
            />

          </div>
        </div>
      )}
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
