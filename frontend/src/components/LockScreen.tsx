import React, { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { Shield, Eye, EyeOff, KeyRound, AlertTriangle, Fingerprint } from "lucide-react";
import { Capacitor } from "@capacitor/core";

export const LockScreen: React.FC = () => {
  const { unlockWallet, unlockWithBiometrics, disconnectWallet } = useWallet();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Auto-trigger biometrics on native platform when screen mounts
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      handleBiometricUnlock();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBiometricUnlock = async () => {
    setBiometricLoading(true);
    setError(null);
    try {
      const success = await unlockWithBiometrics();
      if (!success) {
        setError("Biometric authentication failed. Enter your password instead.");
      }
    } catch {
      setError("Biometric authentication failed. Enter your password instead.");
    } finally {
      setBiometricLoading(false);
    }
  };

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
        boxShadow: "var(--shadow-deep)",
        border: "1px solid var(--border-glass)",
        background: "var(--bg-card)"
      }}>
        {!showResetConfirm ? (
          <form onSubmit={handleUnlock}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "var(--color-primary-glow)",
              border: "1px solid var(--border-glass)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              boxShadow: "var(--shadow-neon)"
            }}>
              <Shield size={28} style={{ color: "var(--color-accent)" }} />
            </div>

            <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--text-main)" }}>
              Vault Locked
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px" }}>
              Use biometrics or your password to decrypt and access your portfolio.
            </p>

            {/* Biometric Button — primary unlock action */}
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={biometricLoading || loading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "16px",
                marginBottom: "16px",
                background: biometricLoading
                  ? "rgba(99,102,241,0.1)"
                  : "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.18))",
                border: "1px solid rgba(99,102,241,0.35)",
                color: "var(--color-primary)",
                fontSize: "15px",
                fontWeight: 700,
                cursor: biometricLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                transition: "all 0.2s ease"
              }}
            >
              <Fingerprint
                size={22}
                style={{ animation: biometricLoading ? "spin 1.5s linear infinite" : "none" }}
              />
              {biometricLoading ? "Scanning…" : "Unlock with Fingerprint / Face ID"}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ flex: 1, height: "1px", background: "var(--border-glass)" }} />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>or use password</span>
              <div style={{ flex: 1, height: "1px", background: "var(--border-glass)" }} />
            </div>

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
                disabled={loading || biometricLoading}
                autoFocus={!Capacitor.isNativePlatform()}
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
                color: "var(--color-danger)",
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
              disabled={loading || biometricLoading || !password}
            >
              {loading ? "Unlocking..." : "Unlock Wallet"}
            </button>

            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-danger)",
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
              background: "rgba(161,61,52,0.1)",
              border: "1px solid var(--border-glass)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
            }}>
              <AlertTriangle size={28} style={{ color: "var(--color-danger)" }} />
            </div>

            <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--text-main)" }}>
              Reset Local Wallet?
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px", lineHeight: "1.5" }}>
              WARNING: This will permanently wipe your encrypted seed phrases from this device.
              If you do not have your recovery phrase saved, you will lose access to this wallet forever.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                className="btn"
                onClick={handleReset}
                style={{
                  background: "var(--color-danger)",
                  color: "var(--color-fg-inverse)",
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
