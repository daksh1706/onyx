import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { Key, PlusCircle, Import, Layers, ShieldAlert, Eye, EyeOff, KeyRound } from "lucide-react";

export const WalletInit: React.FC = () => {
  const {
    generateNewWallet,
    importWalletFromMnemonic,
    importWalletFromPrivateKey,
    connectMetaMask,
    mnemonic,
    privateKey,
    address,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<"create" | "import-seed" | "import-key" | "metamask">("create");
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

  const validatePassword = (): boolean => {
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return false;
    }
    return true;
  };

  const handleGenerateWallet = async () => {
    setError(null);
    if (!validatePassword()) return;
    setSetupLoading(true);
    try {
      await generateNewWallet(password);
    } catch (err) {
      console.error(err);
      setError("Failed to generate wallet.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleImportMnemonicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!seedPhrase.trim()) {
      setError("Seed phrase cannot be empty");
      return;
    }
    if (!validatePassword()) return;
    setSetupLoading(true);
    try {
      const success = await importWalletFromMnemonic(seedPhrase, password);
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
    if (!privKey.trim()) {
      setError("Private key cannot be empty");
      return;
    }
    if (!validatePassword()) return;
    setSetupLoading(true);
    try {
      const success = await importWalletFromPrivateKey(privKey, password);
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

  const renderPasswordInput = () => (
    <div className="form-group" style={{ position: "relative" }}>
      <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <KeyRound size={12} />
        Set Wallet Password (Min 6 chars)
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
        gap: "4px"
      }}>
        {(["create", "import-seed", "import-key", "metamask"] as const).map((tab) => (
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
              boxShadow: "none"
            }}
          >
            {tab === "create" && <PlusCircle size={14} style={{ marginRight: "4px" }} />}
            {tab === "import-seed" && <Import size={14} style={{ marginRight: "4px" }} />}
            {tab === "import-key" && <Key size={14} style={{ marginRight: "4px" }} />}
            {tab === "metamask" && <Layers size={14} style={{ marginRight: "4px" }} />}
            {tab === "create" ? "Create Wallet" : tab === "import-seed" ? "Import Seed" : tab === "import-key" ? "Import Key" : "MetaMask"}
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
      {activeTab === "create" && (
        <div className="fade-in" style={{ textAlign: "left" }}>
          {!address ? (
            <div>
              <p style={{ marginBottom: "20px", fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
                Derive a brand new client-side wallet from a BIP-39 mnemonic seed phrase.
              </p>
              
              {renderPasswordInput()}
              
              <button
                className="btn btn-primary"
                onClick={handleGenerateWallet}
                style={{ width: "100%", marginTop: "10px" }}
                disabled={setupLoading || !password}
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
                    <button className="btn btn-secondary" onClick={() => handleCopy(mnemonic)} style={{ flex: 1 }}>
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
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "import-seed" && (
        <form onSubmit={handleImportMnemonicSubmit} className="fade-in">
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
            disabled={setupLoading || !seedPhrase || !password}
          >
            {setupLoading ? "Importing..." : "Import Wallet"}
          </button>
        </form>
      )}

      {activeTab === "import-key" && (
        <form onSubmit={handleImportPrivateKeySubmit} className="fade-in">
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
            disabled={setupLoading || !privKey || !password}
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
