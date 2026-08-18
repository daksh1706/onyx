import React, { useState } from "react";
import { useWallet, verifyBiometrics } from "../context/WalletContext";
import { Key, PlusCircle, ShieldAlert, Eye, EyeOff, KeyRound } from "lucide-react";

export const WalletInit: React.FC = () => {
  const {
    generateNewWallet,
    importWalletFromMnemonic,
    importWalletFromPrivateKey,
    loginUser,
    connectMetaMask,
    mnemonic,
    privateKey,
    address,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<"login" | "create" | "import-seed" | "import-key" | "metamask">("login");
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [seedPhrase, setSeedPhrase] = useState<string>("");
  const [privKey, setPrivKey] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  
  const [showKey, setShowKey] = useState<boolean>(false);
  const [showWalletPassword, setShowWalletPassword] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState<boolean>(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyMnemonic = async () => {
    const authenticated = await verifyBiometrics("Copy mnemonic seed phrase to clipboard");
    if (authenticated) {
      handleCopy(mnemonic || "");
    }
  };

  const handleToggleKeyVisibility = async () => {
    if (!showKey) {
      const authenticated = await verifyBiometrics("Reveal private key");
      if (authenticated) {
        setShowKey(true);
      }
    } else {
      setShowKey(false);
    }
  };

  const validatePassword = (): boolean => {
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return false;
    }
    return true;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!usernameInput.trim()) {
      setError("Username cannot be empty");
      return;
    }
    if (!password) {
      setError("Password cannot be empty");
      return;
    }
    setSetupLoading(true);
    try {
      const success = await loginUser(usernameInput, password);
      if (!success) {
        setError("Login failed. Verify your username and password, or ensure backend is running.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to log in.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleGenerateWallet = async () => {
    setError(null);
    if (!usernameInput.trim()) {
      setError("Username is required to save credentials.");
      return;
    }
    if (!validatePassword()) return;
    setSetupLoading(true);
    try {
      await generateNewWallet(usernameInput, password);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate wallet.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleImportMnemonicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!usernameInput.trim()) {
      setError("Username is required to save credentials.");
      return;
    }
    if (!seedPhrase.trim()) {
      setError("Seed phrase cannot be empty");
      return;
    }
    if (!validatePassword()) return;
    setSetupLoading(true);
    try {
      const success = await importWalletFromMnemonic(usernameInput, seedPhrase, password);
      if (!success) {
        setError("Invalid seed phrase. Make sure it has 12 or 24 words and is formatted correctly.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to import seed phrase.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleImportPrivateKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!usernameInput.trim()) {
      setError("Username is required to save credentials.");
      return;
    }
    if (!privKey.trim()) {
      setError("Private key cannot be empty");
      return;
    }
    if (!validatePassword()) return;
    setSetupLoading(true);
    try {
      const success = await importWalletFromPrivateKey(usernameInput, privKey, password);
      if (!success) {
        setError("Invalid private key. Make sure it is a valid hex string.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to import private key.");
    } finally {
      setSetupLoading(false);
    }
  };

  const renderUsernameInput = () => (
    <div className="form-group">
      <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Key size={12} />
        Username
      </label>
      <input
        type="text"
        className="form-input"
        placeholder="Enter username..."
        value={usernameInput}
        onChange={(e) => setUsernameInput(e.target.value)}
        disabled={setupLoading}
        required
      />
    </div>
  );

  const renderPasswordInput = () => (
    <div className="form-group" style={{ position: "relative" }}>
      <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <KeyRound size={12} />
        Wallet Password (Min 6 chars)
      </label>
      <input
        type={showWalletPassword ? "text" : "password"}
        className="form-input"
        placeholder="Choose password..."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ paddingRight: "50px" }}
        disabled={setupLoading}
        required
      />
      <button
        type="button"
        onClick={() => setShowWalletPassword(!showWalletPassword)}
        style={{
          position: "absolute",
          right: "12px",
          top: "34px",
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer"
        }}
      >
        {showWalletPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );

  return (
    <div className="glass-card fade-in" style={{ maxWidth: "600px", margin: "40px auto" }}>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <h2 style={{ fontSize: "28px", marginBottom: "8px" }}>Access Your Trading Wallet</h2>
        <p>Encrypt, store, and access your wallet credentials securely.</p>
      </div>

      {/* Warning Box */}
      <div style={{
        background: "rgba(59, 130, 246, 0.05)",
        border: "1px solid rgba(59, 130, 246, 0.15)",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        gap: "12px",
        marginBottom: "24px"
      }}>
        <ShieldAlert size={24} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
        <div>
          <h4 style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>Local Wallet Session Security</h4>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.4" }}>
            Keys are encrypted using PBKDF2 + AES-GCM and stored in localStorage. 
            Refreshing or re-entering the page locks your wallet for security. 
            Never paste mainnet keys or real money keys here!
          </p>
        </div>
      </div>

      {/* Tab Selectors */}
      <div style={{
        display: "flex",
        background: "rgba(0, 0, 0, 0.2)",
        borderRadius: "12px",
        padding: "4px",
        marginBottom: "30px",
        gap: "4px",
        flexWrap: "wrap"
      }}>
        {(["login", "create"] as const).map((tab) => (
          <button
            key={tab}
            className="btn"
            onClick={() => {
              setActiveTab(tab);
              setError(null);
              setPassword("");
            }}
            style={{
              flex: 1,
              background: activeTab === tab ? "rgba(59, 130, 246, 0.1)" : "transparent",
              color: activeTab === tab ? "var(--color-primary)" : "var(--text-muted)",
              border: activeTab === tab ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid transparent",
              padding: "10px 4px",
              fontSize: "13px",
              borderRadius: "10px",
              boxShadow: "none",
              minWidth: "90px"
            }}
          >
            {tab === "login" && <Key size={14} style={{ marginRight: "4px" }} />}
            {tab === "create" && <PlusCircle size={14} style={{ marginRight: "4px" }} />}
            {tab === "login" ? "Login" : "Create Wallet"}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: "rgba(255, 0, 122, 0.08)",
          border: "1px solid rgba(255, 0, 122, 0.2)",
          color: "#ff8da8",
          padding: "12px 16px",
          borderRadius: "10px",
          fontSize: "14px",
          marginBottom: "20px"
        }}>
          {error}
        </div>
      )}

      {/* Tab Panel Content */}
      {activeTab === "login" && (
        <form onSubmit={handleLoginSubmit} className="fade-in">
          <p style={{ marginBottom: "20px", fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
            Enter username and password to load your encrypted credentials from MongoDB.
          </p>
          {renderUsernameInput()}
          {renderPasswordInput()}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "10px" }}
            disabled={setupLoading || !usernameInput || !password}
          >
            {setupLoading ? "Logging In..." : "Log In & Sync"}
          </button>
        </form>
      )}

      {activeTab === "create" && (
        <div className="fade-in" style={{ textAlign: "left" }}>
          {!address ? (
            <div>
              <p style={{ marginBottom: "20px", fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
                Derive a brand new client-side wallet and save it to MongoDB.
              </p>
              {renderUsernameInput()}
              {renderPasswordInput()}
              <button
                className="btn btn-primary"
                onClick={handleGenerateWallet}
                style={{ width: "100%", marginTop: "10px" }}
                disabled={setupLoading || !usernameInput || !password}
              >
                {setupLoading ? "Generating..." : "Generate New Wallet"}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "left" }}>
              <h4 style={{ color: "var(--text-main)", marginBottom: "12px", fontSize: "16px" }}>Successfully Generated!</h4>
              
              <div className="form-group">
                <span className="form-label">Derived Wallet Address</span>
                <div className="mono-text" style={{
                  background: "rgba(0, 0, 0, 0.03)",
                  border: "1px solid var(--border-glass)",
                  padding: "12px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  wordBreak: "break-all",
                  color: "var(--color-secondary)"
                }}>
                  {address}
                </div>
              </div>

              {mnemonic && (
                <div className="form-group">
                  <span className="form-label">Mnemonic Seed Phrase (12 Words) - Keep Safe!</span>
                  <div className="mono-text" style={{
                    background: "rgba(0, 0, 0, 0.04)",
                    border: "1px dashed var(--border-glass)",
                    padding: "16px",
                    borderRadius: "10px",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    textAlign: "center",
                    wordSpacing: "8px",
                    color: "var(--text-main)",
                    marginBottom: "12px"
                  }}>
                    {mnemonic}
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button className="btn btn-secondary" onClick={handleCopyMnemonic} style={{ flex: 1 }}>
                      {copied ? "Copied!" : "Copy Seed Phrase"}
                    </button>
                  </div>
                </div>
              )}

              {privateKey && (
                <div className="form-group">
                  <span className="form-label">Private Key</span>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showKey ? "text" : "password"}
                      className="form-input mono-text"
                      readOnly
                      value={privateKey}
                      style={{ paddingRight: "50px", fontSize: "13px" }}
                    />
                    <button
                      type="button"
                      onClick={handleToggleKeyVisibility}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer"
                      }}
                    >
                      {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "import-seed" && (
        <form onSubmit={handleImportMnemonicSubmit} className="fade-in">
          {renderUsernameInput()}
          <div className="form-group">
            <label className="form-label">Enter 12 or 24-Word Seed Phrase</label>
            <textarea
              className="form-input mono-text"
              rows={3}
              placeholder="word1 word2 word3..."
              value={seedPhrase}
              onChange={(e) => setSeedPhrase(e.target.value)}
              style={{ resize: "none", fontSize: "14px", lineHeight: "1.6", marginBottom: "16px" }}
              disabled={setupLoading}
              required
            />
          </div>

          {renderPasswordInput()}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "10px" }}
            disabled={setupLoading || !usernameInput || !seedPhrase || !password}
          >
            {setupLoading ? "Importing..." : "Import Wallet"}
          </button>
        </form>
      )}

      {activeTab === "import-key" && (
        <form onSubmit={handleImportPrivateKeySubmit} className="fade-in">
          {renderUsernameInput()}
          <div className="form-group">
            <label className="form-label">Enter Private Key (Hex format)</label>
            <div style={{ position: "relative", marginBottom: "16px" }}>
              <input
                type={showKey ? "text" : "password"}
                className="form-input mono-text"
                placeholder="0x..."
                value={privKey}
                onChange={(e) => setPrivKey(e.target.value)}
                style={{ paddingRight: "50px" }}
                disabled={setupLoading}
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer"
                }}
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {renderPasswordInput()}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "10px" }}
            disabled={setupLoading || !usernameInput || !privKey || !password}
          >
            {setupLoading ? "Importing..." : "Import Private Key"}
          </button>
        </form>
      )}

      {activeTab === "metamask" && (
        <div className="fade-in" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: "20px", fontSize: "14px", color: "var(--text-muted)" }}>
            Connect via MetaMask browser extension or any other injected EIP-1193 Web3 provider.
          </p>
          <button className="btn btn-secondary" onClick={connectMetaMask} style={{ width: "100%", borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
            Connect Injected Wallet
          </button>
        </div>
      )}
    </div>
  );
};
