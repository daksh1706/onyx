import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { Shield, Eye, EyeOff, KeyRound, AlertTriangle } from "lucide-react";

export const LockScreen: React.FC = () => {
  const { unlockWallet, disconnectWallet } = useWallet();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);

    try {
      const success = await unlockWallet(password);
      if (!success) {
        setError("Invalid password. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred during unlock.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    disconnectWallet();
    window.location.reload();
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "var(--bg-dark)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px"
    }}>
      <div className="glass-card" style={{
        maxWidth: "400px",
        width: "100%",
        textAlign: "center",
        padding: "32px",
        borderRadius: "24px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(22, 23, 26, 0.65)"
      }}>
        {!showResetConfirm ? (
          <form onSubmit={handleUnlock}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              boxShadow: "0 0 20px rgba(59, 130, 246, 0.2)"
            }}>
              <Shield size={28} style={{ color: "var(--color-primary)" }} />
            </div>

            <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--text-main)" }}>
              Vault Locked
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px" }}>
              Enter your session password to decrypt keys and access your portfolio.
            </p>

            <div className="form-group" style={{ position: "relative", textAlign: "left" }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <KeyRound size={12} />
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: "40px" }}
                disabled={loading}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "34px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <div style={{
                color: "var(--color-accent)",
                fontSize: "13px",
                fontWeight: 600,
                marginTop: "-12px",
                marginBottom: "20px",
                textAlign: "left"
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", borderRadius: "12px", marginBottom: "16px" }}
              disabled={loading || !password}
            >
              {loading ? "Unlocking..." : "Unlock Wallet"}
            </button>

            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255, 0, 85, 0.65)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline"
              }}
            >
              Reset / Erase Wallet Data
            </button>
          </form>
        ) : (
          <div>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(255, 0, 85, 0.1)",
              border: "1px solid rgba(255, 0, 85, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              boxShadow: "0 0 20px rgba(255, 0, 85, 0.15)"
            }}>
              <AlertTriangle size={28} style={{ color: "rgba(255, 0, 85, 0.85)" }} />
            </div>

            <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--text-main)" }}>
              Reset Local Wallet?
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px", lineHeight: "1.5" }}>
              WARNING: This will permanently wipe your encrypted seed phrases from this browser. 
              If you do not have your recovery phrase saved, you will lose access to this wallet forever.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                className="btn"
                onClick={handleReset}
                style={{
                  background: "rgba(255, 0, 85, 0.85)",
                  color: "#fff",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "none",
                  fontWeight: 700
                }}
              >
                Yes, Wipe Wallet
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowResetConfirm(false)}
                style={{ padding: "12px", borderRadius: "12px" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
