import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import { Contract } from "ethers";
import { CONTRACT_ADDRESSES, FAUCET_ABI } from "../constants/contracts";
import { Clock, Activity, Zap, ShieldCheck, HelpCircle, AlertTriangle } from "lucide-react";

interface DashboardProps {
  setActiveTab?: (tab: "portfolio" | "send" | "swap") => void;
}

export const Dashboard: React.FC<DashboardProps> = () => {
  const {
    address,
    ethBalance,
    mycBalance,
    usdcBalance,
    onyxBalance,
    refreshState,
    claimFaucet,
    contractConfigured,
    provider,
  } = useWallet();

  const [faucetLoading, setFaucetLoading] = useState<boolean>(false);
  const [faucetMessage, setFaucetMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);
  const [timeFilter, setTimeFilter] = useState<string>("1M");

  // Cooldown validation for faucet
  const checkFaucetCooldown = useCallback(async () => {
    if (!address || !provider || !contractConfigured) return;

    try {
      const faucetContract = new Contract(CONTRACT_ADDRESSES.Faucet, FAUCET_ABI, provider);
      const nextTime = await faucetContract.nextAccessTime(address);
      const nextTimestamp = Number(nextTime);
      const currentTimestamp = Math.floor(Date.now() / 1000);

      if (nextTimestamp > currentTimestamp) {
        setCooldownLeft(nextTimestamp - currentTimestamp);
      } else {
        setCooldownLeft(0);
      }
    } catch (err) {
      console.error("Error checking faucet cooldown:", err);
    }
  }, [address, provider, contractConfigured]);

  useEffect(() => {
    checkFaucetCooldown();
    const interval = setInterval(checkFaucetCooldown, 15000);
    return () => clearInterval(interval);
  }, [checkFaucetCooldown]);

  useEffect(() => {
    if (cooldownLeft > 0) {
      const timer = setTimeout(() => setCooldownLeft(cooldownLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownLeft]);

  const handleClaimFaucet = async () => {
    setFaucetLoading(true);
    setFaucetMessage(null);
    try {
      const tx = await claimFaucet();
      setFaucetMessage({ text: "Submitted transaction...", error: false });
      await tx.wait();
      setFaucetMessage({ text: "Claimed 100 MYC, 100 USDC, and 100 ONYX!", error: false });
      refreshState();
      checkFaucetCooldown();
      setTimeout(() => setFaucetMessage(null), 5000);
    } catch (err: any) {
      console.error("Faucet claim failed:", err);
      let errMsg = "Claim failed.";
      if (err.message && err.message.includes("Faucet: Cooldown active")) {
        errMsg = "Cooldown active.";
      } else if (err.message && err.message.includes("Insufficient")) {
        errMsg = "Faucet empty.";
      }
      setFaucetMessage({ text: errMsg, error: true });
      setTimeout(() => setFaucetMessage(null), 5000);
    } finally {
      setFaucetLoading(false);
    }
  };

  // Convert assets to mock USD valuation: 1 ETH = $3500, 1 MYC = $0.50, 1 USDC = $1.00, 1 ONYX = $2.50
  const ethVal = parseFloat(ethBalance || "0") * 3500;
  const mycVal = parseFloat(mycBalance || "0") * 0.50;
  const usdcVal = parseFloat(usdcBalance || "0") * 1.00;
  const onyxVal = parseFloat(onyxBalance || "0") * 2.50;
  const totalUsdVal = ethVal + mycVal + usdcVal + onyxVal;

  const formatNumber = (num: number, dec: number = 2) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };

  const formatCooldown = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Donut SVG ratio calculations
  const totalWeight = totalUsdVal || 1;
  const mycPercent = (mycVal / totalWeight) * 100;
  const usdcPercent = (usdcVal / totalWeight) * 100;
  const onyxPercent = (onyxVal / totalWeight) * 100;
  const ethPercent = (ethVal / totalWeight) * 100;

  // Segment values for SVG dashoffsets
  const mycOffset = 0;
  const usdcOffset = -mycPercent;
  const onyxOffset = -(mycPercent + usdcPercent);
  const ethOffset = -(mycPercent + usdcPercent + onyxPercent);

  // Check if wallet is empty
  const isWalletEmpty = totalUsdVal <= 0;

  return (
    <div className="fade-in">
      
      {/* Header and Top stats cards */}
      <header style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "24px",
        marginBottom: "32px",
        flexWrap: "wrap"
      }}>
        <div>
          <h1 style={{ fontSize: "36px", fontWeight: 800, color: "var(--color-primary)", letterSpacing: "-0.02em" }}>
            Portfolio Analysis
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px", maxWidth: "600px" }}>
            Comprehensive real-time tracking of your digital assets and performance metrics across multiple chains.
          </p>
        </div>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div className="glass-panel" style={{ padding: "12px 24px", borderRadius: "12px" }}>
            <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>
              Net Worth
            </p>
            <h2 className="mono-text" style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-primary)" }}>
              ${formatNumber(totalUsdVal)}
            </h2>
          </div>
          <div className="glass-panel" style={{ padding: "12px 24px", borderRadius: "12px", borderLeft: "4px solid #4edea3" }}>
            <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>
              24h Gain
            </p>
            <h2 className="mono-text" style={{ fontSize: "24px", fontWeight: 700, color: "#4edea3" }}>
              +$12,402.12
            </h2>
          </div>
        </div>
      </header>

      {/* Quick Guide Card */}
      <section className="glass-panel fade-in" style={{
        padding: "24px",
        borderRadius: "16px",
        marginBottom: "32px",
        border: "1px solid var(--border-glass)",
        background: "linear-gradient(135deg, rgba(0, 102, 255, 0.04) 0%, rgba(0, 0, 0, 0) 100%)"
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <HelpCircle size={18} style={{ color: "var(--color-primary)" }} />
          Getting Started & Guide
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                background: "var(--color-primary)",
                color: "#fff",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "11px"
              }}>1</span>
              <h4 style={{ fontWeight: 600, fontSize: "13px" }}>Claim Faucet Tokens</h4>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              Use the <strong>Developer Faucet</strong> card below to instantly claim 100 MYC, 100 USDC, and 100 ONYX test tokens.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                background: "var(--color-primary)",
                color: "#fff",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "11px"
              }}>2</span>
              <h4 style={{ fontWeight: 600, fontSize: "13px" }}>Import Custom Tokens</h4>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              In MetaMask, click <strong>Import Token ➔ Custom Token</strong> and paste the contract addresses (shown in README) to see your balances.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                background: "var(--color-primary)",
                color: "#fff",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "11px"
              }}>3</span>
              <h4 style={{ fontWeight: 600, fontSize: "13px" }}>Swap on AMM Pool</h4>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              Navigate to the <strong>Swap</strong> tab to trade assets. Supported liquidity pairs are <strong>MYC ➔ USDC</strong> and <strong>ONYX ➔ USDC</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Bento Grid */}
      <div className="dashboard-grid">
        
        {/* Main Chart Card (col-span-8) */}
        <section className="glass-panel grid-col-8" style={{
          borderRadius: "16px",
          padding: "24px",
          position: "relative",
          minHeight: "400px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={18} style={{ color: "var(--color-primary)" }} />
              Value Performance
            </h3>
            <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.05)", padding: "4px", borderRadius: "8px" }}>
              {["1D", "1W", "1M", "1Y", "ALL"].map((t) => (
                <button
                  key={t}
                  className="btn"
                  onClick={() => setTimeFilter(t)}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    borderRadius: "6px",
                    background: t === timeFilter ? "var(--color-primary)" : "transparent",
                    color: t === timeFilter ? "#0b1326" : "var(--text-muted)",
                    fontWeight: t === timeFilter ? 700 : 500,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const getChartPath = () => {
              switch (timeFilter) {
                case "1D":
                  return {
                    line: "M 0 180 Q 200 160 400 190 T 800 80",
                    area: "M 0 180 Q 200 160 400 190 T 800 80 L 800 260 L 0 260 Z",
                    circle: { cx: 800, cy: 80 },
                    top: "50px",
                    left: "660px"
                  };
                case "1W":
                  return {
                    line: "M 0 220 Q 150 240 300 150 T 600 110 T 800 60",
                    area: "M 0 220 Q 150 240 300 150 T 600 110 T 800 60 L 800 260 L 0 260 Z",
                    circle: { cx: 600, cy: 110 },
                    top: "80px",
                    left: "540px"
                  };
                case "1Y":
                  return {
                    line: "M 0 250 Q 200 240 400 120 T 800 15",
                    area: "M 0 250 Q 200 240 400 120 T 800 15 L 800 260 L 0 260 Z",
                    circle: { cx: 800, cy: 15 },
                    top: "10px",
                    left: "660px"
                  };
                case "ALL":
                  return {
                    line: "M 0 255 Q 100 255 200 245 T 400 180 T 600 100 T 800 10",
                    area: "M 0 255 Q 100 255 200 245 T 400 180 T 600 100 T 800 10 L 800 260 L 0 260 Z",
                    circle: { cx: 600, cy: 100 },
                    top: "70px",
                    left: "540px"
                  };
                default: // "1M"
                  return {
                    line: "M 0 240 Q 100 220 200 210 T 400 150 T 600 120 T 800 40",
                    area: "M 0 240 Q 100 220 200 210 T 400 150 T 600 120 T 800 40 L 800 260 L 0 260 Z",
                    circle: { cx: 600, cy: 120 },
                    top: "90px",
                    left: "540px"
                  };
              }
            };
            const chartData = getChartPath();
            return (
              <div style={{ height: "260px", width: "100%", position: "relative", marginTop: "16px" }}>
                {/* SVG Area chart */}
                <svg className="chart-glow" width="100%" height="100%" viewBox="0 0 800 260" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#00dbe9" stopOpacity="0.25" />
                      <stop offset="95%" stopColor="#00dbe9" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <line x1="0" y1="50" x2="800" y2="50" stroke="rgba(132, 148, 149, 0.08)" strokeWidth="1" />
                  <line x1="0" y1="130" x2="800" y2="130" stroke="rgba(132, 148, 149, 0.08)" strokeWidth="1" />
                  <line x1="0" y1="210" x2="800" y2="210" stroke="rgba(132, 148, 149, 0.08)" strokeWidth="1" />
                  
                  {/* Area path */}
                  <path
                    d={chartData.area}
                    fill="url(#chartGradient)"
                  />
                  
                  {/* Line path */}
                  <path
                    d={chartData.line}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Animated active point */}
                  <circle cx={chartData.circle.cx} cy={chartData.circle.cy} r="5" fill="var(--color-primary)" />
                </svg>
                
                {/* Interactive Tooltip Simulation */}
                <div className="glass-panel" style={{
                  position: "absolute",
                  top: chartData.top,
                  left: chartData.left,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  border: "1px solid rgba(0, 219, 233, 0.3)",
                  transition: "all 0.3s ease"
                }}>
                  <p style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>ACTIVE VALUATION</p>
                  <p className="mono-text" style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                    ${formatNumber(totalUsdVal)}
                  </p>
                </div>
              </div>
            );
          })()}
        </section>

        {/* Asset Allocation Donut Card (col-span-4) */}
        <section className="glass-panel grid-col-4" style={{
          borderRadius: "16px",
          padding: "24px",
          display: "flex",
          flexDirection: "column"
        }}>
          <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={18} style={{ color: "var(--color-primary)" }} />
            Asset Allocation
          </h3>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyItems: "center" }}>
            <div style={{ position: "relative", width: "160px", height: "160px", marginBottom: "24px" }}>
              <svg className="donut-svg" width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                {/* Empty base circle */}
                <circle cx="18" cy="18" r="16" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                
                {!isWalletEmpty ? (
                  <>
                    {/* MYC Segment */}
                    {mycPercent > 0 && (
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="transparent"
                        stroke="var(--color-primary)"
                        strokeWidth="4"
                        strokeDasharray={`${mycPercent} 100`}
                        strokeDashoffset={mycOffset}
                      />
                    )}
                    {/* USDC Segment */}
                    {usdcPercent > 0 && (
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="transparent"
                        stroke="var(--color-secondary)"
                        strokeWidth="4"
                        strokeDasharray={`${usdcPercent} 100`}
                        strokeDashoffset={usdcOffset}
                      />
                    )}
                    {/* ONYX Segment */}
                    {onyxPercent > 0 && (
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="transparent"
                        stroke="var(--color-accent)"
                        strokeWidth="4"
                        strokeDasharray={`${onyxPercent} 100`}
                        strokeDashoffset={onyxOffset}
                      />
                    )}
                    {/* ETH Segment */}
                    {ethPercent > 0 && (
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="transparent"
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth="4"
                        strokeDasharray={`${ethPercent} 100`}
                        strokeDashoffset={ethOffset}
                      />
                    )}
                  </>
                ) : null}
              </svg>
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center"
              }}>
                <p style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase" }}>Primary</p>
                <p className="mono-text" style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-primary)" }}>
                  {isWalletEmpty ? "N/A" : mycPercent >= ethPercent && mycPercent >= usdcPercent && mycPercent >= onyxPercent ? "MYC" : onyxPercent >= ethPercent && onyxPercent >= usdcPercent ? "ONYX" : ethPercent >= usdcPercent ? "ETH" : "USDC"}
                </p>
              </div>
            </div>

            {/* Asset Legend list */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
              
              {/* MYC Row */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-primary)" }} />
                  <span style={{ fontWeight: 600 }}>MyCoin (MYC)</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontWeight: 700 }}>{isWalletEmpty ? "0.0" : mycPercent.toFixed(1)}%</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "11px", marginLeft: "8px" }}>${formatNumber(mycVal, 0)}</span>
                </div>
              </div>

              {/* ONYX Row */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-accent)" }} />
                  <span style={{ fontWeight: 600 }}>Onyx (ONYX)</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontWeight: 700 }}>{isWalletEmpty ? "0.0" : onyxPercent.toFixed(1)}%</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "11px", marginLeft: "8px" }}>${formatNumber(onyxVal, 0)}</span>
                </div>
              </div>

              {/* USDC Row */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-secondary)" }} />
                  <span style={{ fontWeight: 600 }}>USD Coin (USDC)</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontWeight: 700 }}>{isWalletEmpty ? "0.0" : usdcPercent.toFixed(1)}%</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "11px", marginLeft: "8px" }}>${formatNumber(usdcVal, 0)}</span>
                </div>
              </div>

              {/* ETH Row */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(255,255,255,0.25)" }} />
                  <span style={{ fontWeight: 600 }}>Ethereum (ETH)</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontWeight: 700 }}>{isWalletEmpty ? "0.0" : ethPercent.toFixed(1)}%</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "11px", marginLeft: "8px" }}>${formatNumber(ethVal, 0)}</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Sandbox Developer Faucet Card (col-span-4) */}
        {contractConfigured && (
          <section className="glass-panel grid-col-4" style={{
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Zap size={16} style={{ color: "var(--color-primary)" }} />
                Developer Faucet
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                Get instant test liquidity: claim 100 MYC, 100 Mock USDC, and 100 ONYX to experiment with trades.
              </p>
            </div>
            
            <div style={{ marginTop: "16px" }}>
              {parseFloat(ethBalance) < 0.0005 && (
                <div style={{
                  background: "rgba(255, 166, 0, 0.08)",
                  border: "1px solid rgba(255, 166, 0, 0.2)",
                  color: "#decba4",
                  padding: "12px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  lineHeight: "1.4",
                  marginBottom: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                    <AlertTriangle size={14} style={{ color: "orange" }} />
                    <span>0 ETH Gas Balance</span>
                  </div>
                  <span>
                    You need Sepolia ETH in your wallet to cover network transaction fees. Get test ETH here:
                  </span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
                    <a
                      href="https://www.alchemy.com/faucets/ethereum-sepolia"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--color-primary)", textDecoration: "underline", fontWeight: 600 }}
                    >
                      Alchemy Faucet
                    </a>
                    <a
                      href="https://faucet.quicknode.com/drip"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--color-primary)", textDecoration: "underline", fontWeight: 600 }}
                    >
                      QuickNode Faucet
                    </a>
                  </div>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    Or send gas from your MetaMask (Account 1) to this address: <br/>
                    <strong className="mono-text" style={{ wordBreak: "break-all", color: "var(--text-main)", fontSize: "9px" }}>{address}</strong>
                  </span>
                </div>
              )}

              {cooldownLeft > 0 ? (
                <div className="mono-text" style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--color-primary)",
                  background: "rgba(0, 219, 233, 0.08)",
                  border: "1px solid rgba(0, 219, 233, 0.2)",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}>
                  <Clock size={12} />
                  Cooldown: {formatCooldown(cooldownLeft)}
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleClaimFaucet}
                  disabled={faucetLoading || parseFloat(ethBalance) < 0.0005}
                  style={{ width: "100%", padding: "10px 0", borderRadius: "10px", fontWeight: 700 }}
                >
                  {faucetLoading ? "Dispensing..." : "Claim Faucet Funds"}
                </button>
              )}

              {faucetMessage && (
                <p style={{
                  marginTop: "8px",
                  fontSize: "11px",
                  textAlign: "center",
                  color: faucetMessage.error ? "rgba(255, 0, 85, 0.85)" : "var(--color-primary)",
                  fontWeight: 600
                }}>
                  {faucetMessage.text}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Performance Timeline Table (col-span-8) */}
        <section className="glass-panel grid-col-8" style={{
          borderRadius: "16px",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border-glass)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <ShieldCheck size={16} style={{ color: "var(--color-primary)" }} />
              Performance Tracking
            </h3>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4edea3", display: "inline-block" }} />
              Live Market Feed
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border-glass)" }}>
                  <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>Timeline</th>
                  <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>PnL ($)</th>
                  <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>PnL (%)</th>
                  <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>Top Performer</th>
                  <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                  <td style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 600 }}>Daily (24h)</td>
                  <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", color: "#4edea3", fontWeight: 700 }}>+$12,402.12</td>
                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ background: "rgba(78, 222, 163, 0.1)", color: "#4edea3", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>+1.02%</span>
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: "13px" }}>MyCoin (+4.2%)</td>
                  <td style={{ padding: "14px 18px" }}>
                    <svg width="64" height="16" stroke="#4edea3" fill="none" strokeWidth="2">
                      <path d="M 0 12 L 15 10 L 30 14 L 45 4 L 64 2" />
                    </svg>
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                  <td style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 600 }}>Weekly (7d)</td>
                  <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", color: "#4edea3", fontWeight: 700 }}>+$84,291.55</td>
                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ background: "rgba(78, 222, 163, 0.1)", color: "#4edea3", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>+7.45%</span>
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: "13px" }}>Onyx (+14.8%)</td>
                  <td style={{ padding: "14px 18px" }}>
                    <svg width="64" height="16" stroke="#4edea3" fill="none" strokeWidth="2">
                      <path d="M 0 14 L 20 12 L 40 8 L 64 2" />
                    </svg>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 600 }}>Monthly (30d)</td>
                  <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", color: "rgba(255, 0, 85, 0.85)", fontWeight: 700 }}>-$22,102.84</td>
                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ background: "rgba(255, 0, 85, 0.1)", color: "rgba(255, 0, 85, 0.85)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>-1.74%</span>
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: "13px" }}>USDC (+0.01%)</td>
                  <td style={{ padding: "14px 18px" }}>
                    <svg width="64" height="16" stroke="rgba(255, 0, 85, 0.85)" fill="none" strokeWidth="2">
                      <path d="M 0 2 L 20 8 L 40 6 L 64 14" />
                    </svg>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {/* Network Latency Status Footer */}
      <footer style={{
        marginTop: "32px",
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        alignItems: "center"
      }}>
        <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)" }}>Network Status:</span>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-glass)",
          padding: "6px 12px",
          borderRadius: "100px",
          fontSize: "12px"
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4edea3", display: "inline-block" }} />
          <span style={{ fontWeight: 600 }}>Ethereum Sepolia</span>
          <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>12ms</span>
        </div>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-glass)",
          padding: "6px 12px",
          borderRadius: "100px",
          fontSize: "12px",
          opacity: 0.6
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4edea3", display: "inline-block" }} />
          <span style={{ fontWeight: 600 }}>Polygon Amoy</span>
          <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>24ms</span>
        </div>
      </footer>

    </div>
  );
};
