import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "../context/WalletContext";
import { Contract } from "ethers";
import { CONTRACT_ADDRESSES, FAUCET_ABI } from "../constants/contracts";
import { Clock, Activity, Zap, AlertTriangle, ShieldCheck as ShieldCheckIcon, Send, ArrowRightLeft, RefreshCw, Landmark } from "lucide-react";

interface DashboardProps {
  setActiveTab?: (tab: "portfolio" | "send" | "swap" | "receive") => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const {
    address,
    ethBalance,
    mycBalance,
    inrBalance,
    onyxBalance,
    refreshState,
    claimFaucet,
    contractConfigured,
    provider,
    reserves,
    onyxReserves,
    loading,
  } = useWallet();

  const [faucetLoading, setFaucetLoading] = useState<boolean>(false);
  const [faucetMessage, setFaucetMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);
  const [timeFilter, setTimeFilter] = useState<string>("1M");
  const [mobileChartTab, setMobileChartTab] = useState<"performance" | "allocation">("performance");
  const [mobileAssetTab, setMobileAssetTab] = useState<"crypto" | "etf" | "invest">("crypto");

  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartRef.current = e.touches[0].pageY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing || window.scrollY > 0) return;
    const currentY = e.touches[0].pageY;
    const dist = currentY - touchStartRef.current;
    if (dist > 0) {
      const dynamicDist = Math.min(80, dist * 0.4);
      setPullDistance(dynamicDist);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling || isRefreshing) return;
    setIsPulling(false);
    if (pullDistance > 45) {
      setIsRefreshing(true);
      setPullDistance(50);
      try {
        await refreshState();
      } catch (err) {
        console.error(err);
      }
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 800);
    } else {
      setPullDistance(0);
    }
  };

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
      setFaucetMessage({ text: "Claimed 100 MYC, 100 INR, and 100 ONYX test tokens!", error: false });
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

  // Convert assets to INR valuation using real-time AMM spot rates (1 USD = 83 INR)
  const INR_MULTIPLIER = 83;
  const rawMycPrice = reserves ? parseFloat(reserves.reserveB) / parseFloat(reserves.reserveA) : 0.001205; // 0.1 INR / MYC
  const rawOnyxPrice = onyxReserves ? parseFloat(onyxReserves.reserveB) / parseFloat(onyxReserves.reserveA) : 0.00241; // 0.2 INR / ONYX

  const mycPrice = rawMycPrice * INR_MULTIPLIER;
  const onyxPrice = rawOnyxPrice * INR_MULTIPLIER;
  const ethPrice = 3500.00 * INR_MULTIPLIER;
  const inrPrice = 1.00; // INR unit price in INR is 1.0

  const ethVal = parseFloat(ethBalance || "0") * ethPrice;
  const mycVal = parseFloat(mycBalance || "0") * mycPrice;
  const inrVal = parseFloat(inrBalance || "0") * inrPrice;
  const onyxVal = parseFloat(onyxBalance || "0") * onyxPrice;
  const totalValInr = ethVal + mycVal + inrVal + onyxVal;

  // Address seed to generate unique, stable gain percent per address (only if user has non-zero balance)
  const addressSeed = address ? parseInt(address.slice(2, 10), 16) : 42;
  const gainPercent = totalValInr > 0 ? 1.0 + (addressSeed % 90) / 10 : 0;
  const gainInr = totalValInr * (gainPercent / 100);

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
  const totalWeight = totalValInr || 1;
  const mycPercent = (mycVal / totalWeight) * 100;
  const inrPercent = (inrVal / totalWeight) * 100;
  const onyxPercent = (onyxVal / totalWeight) * 100;
  const ethPercent = (ethVal / totalWeight) * 100;

  // Segment values for SVG dashoffsets
  const mycOffset = 0;
  const inrOffset = -mycPercent;
  const onyxOffset = -(mycPercent + inrPercent);
  const ethOffset = -(mycPercent + inrPercent + onyxPercent);

  // Check if wallet is empty
  const isWalletEmpty = totalValInr <= 0;

  const getChartPath = () => {
    let relativePoints = [0.90, 0.93, 0.89, 0.96, 1.02, 1.0];
    if (timeFilter === "1D") {
      relativePoints = [0.98, 0.99, 0.96, 1.01, 1.03, 1.0];
    } else if (timeFilter === "1W") {
      relativePoints = [0.85, 0.90, 0.88, 0.95, 1.02, 1.0];
    } else if (timeFilter === "1Y") {
      relativePoints = [0.60, 0.72, 0.85, 0.80, 0.95, 1.0];
    } else if (timeFilter === "ALL") {
      relativePoints = [0.20, 0.45, 0.52, 0.75, 0.88, 1.0];
    }

    const width = 640;
    const height = 200;
    const points = relativePoints.map((p) => totalValInr * p);
    const minVal = Math.min(...points) * 0.98;
    const maxVal = Math.max(...points) * 1.02;
    const range = maxVal - minVal || 1;

    const pointsStr = points
      .map((val, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height - ((val - minVal) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");

    const firstY = height - ((points[0] - minVal) / range) * height;

    return { pointsStr, width, height, firstY };
  };

  const chart = getChartPath();

  return (
    <div className="fade-in">

      {/* ========================================================
          DESKTOP VIEW (Visible on desktop/tablet only)
          ======================================================== */}
      <div className="hide-on-mobile">
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
              <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.03)", padding: "4px", borderRadius: "8px" }}>
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
                      color: t === timeFilter ? "var(--color-on-primary)" : "var(--text-muted)",
                      fontWeight: t === timeFilter ? 700 : 500,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ position: "relative" }}>
             {/* Total Balance Hero */}
             <div className="portfolio-header">
               <span className="portfolio-title">Net Portfolio Assets</span>
               {loading && totalValInr === 0 ? (
                 <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "42px", marginTop: "8px" }}>
                   <RefreshCw size={18} className="spin" style={{ color: "var(--color-primary)" }} />
                   <span style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: 600 }}>Syncing balance...</span>
                 </div>
               ) : (
                 <div className="portfolio-amount">
                   ₹{formatNumber(totalValInr)}
                   <span style={{ 
                     fontSize: "13px", 
                     fontWeight: 500, 
                     color: totalValInr > 0 ? "var(--color-secondary)" : "var(--text-muted)", 
                     display: "inline-flex", 
                     alignItems: "center", 
                     gap: "2px" 
                   }}>
                     +{gainPercent.toFixed(1)}% (+₹{formatNumber(gainInr)})
                   </span>
                 </div>
               )}
             </div>

              {isWalletEmpty ? (
                <div style={{
                  height: "200px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px dashed var(--border-glass)",
                  borderRadius: "12px",
                  color: "var(--text-muted)",
                  fontSize: "13px"
                }}>
                  No assets in wallet. Use the Developer Faucet card below to claim test tokens.
                </div>
              ) : (
                <div style={{ width: "100%", overflow: "hidden" }}>
                  <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ width: "100%", overflow: "visible" }}>
                    <defs>
                      <linearGradient id="gradient-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity="0.2" />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Area Under Curve */}
                    <path
                      d={`M 0,${chart.height} L 0,${chart.firstY} L ${chart.pointsStr.replace(/,/g, " ")} L ${chart.width},${chart.height} Z`}
                      fill="url(#gradient-area)"
                    />

                    {/* Stroke Line */}
                    <polyline
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="3.5"
                      points={chart.pointsStr}
                      className="chart-glow"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          </section>

          {/* Allocation Sidebar Card (col-span-4) */}
          <section className="glass-panel grid-col-4" style={{ borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Zap size={16} style={{ color: "var(--color-primary)" }} />
              Asset Allocation
            </h3>

            {isWalletEmpty ? (
              <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px dashed var(--border-glass)",
                borderRadius: "12px",
                color: "var(--text-muted)",
                fontSize: "13px",
                minHeight: "200px"
              }}>
                Wipe clean.
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "20px" }}>
                {/* SVG Donut Chart */}
                <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
                  <svg width="140" height="140" viewBox="0 0 42 42" className="chart-glow" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="4.5" />
                    {/* MYC Segment */}
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-primary)" strokeWidth="4.5"
                      strokeDasharray={`${mycPercent} ${100 - mycPercent}`} strokeDashoffset={mycOffset} />
                    {/* INR Segment */}
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-surface2)" strokeWidth="4.5"
                      strokeDasharray={`${inrPercent} ${100 - inrPercent}`} strokeDashoffset={inrOffset} />
                    {/* ONYX Segment */}
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-accent)" strokeWidth="4.5"
                      strokeDasharray={`${onyxPercent} ${100 - onyxPercent}`} strokeDashoffset={onyxOffset} />
                    {/* ETH Segment */}
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#8c8d9e" strokeWidth="4.5"
                      strokeDasharray={`${ethPercent} ${100 - ethPercent}`} strokeDashoffset={ethOffset} />
                  </svg>
                  
                  {/* Center Text overlay */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center"
                  }}>
                    <span style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Assets</span>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>4 Pairs</p>
                  </div>
                </div>

                {/* Legends list */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="#8c8d9e" /></svg>
                    <span>ETH ({ethPercent.toFixed(0)}%)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-primary)" /></svg>
                    <span>MYC ({mycPercent.toFixed(0)}%)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-surface2)" /></svg>
                    <span>INR ({inrPercent.toFixed(0)}%)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-accent)" /></svg>
                    <span>ONYX ({onyxPercent.toFixed(0)}%)</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Grid: Developer Faucet & Asset Table */}
        <div className="dashboard-grid" style={{ marginTop: "32px" }}>
          
          {/* Developer Sandbox Faucet (col-span-4) */}
          <section className="glass-panel grid-col-4" style={{ borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock size={16} style={{ color: "var(--color-primary)" }} />
              Developer Sandbox Faucet
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5", marginBottom: "20px" }}>
              Claim 100 test MYC, 100 test INR, and 100 test ONYX tokens once every 24 hours to test send and swap features.
            </p>

            {!contractConfigured ? (
              <div style={{ color: "var(--color-danger)", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={14} />
                Faucet contracts not configured. Check environment variables.
              </div>
            ) : (
              <div>
                <button
                  className="btn btn-primary"
                  onClick={handleClaimFaucet}
                  disabled={faucetLoading || cooldownLeft > 0}
                  style={{ width: "100%", padding: "14px", fontWeight: 700 }}
                >
                  {faucetLoading ? "Requesting Tokens..." : cooldownLeft > 0 ? `Cooldown: ${formatCooldown(cooldownLeft)}` : "Claim Test Tokens"}
                </button>

                {faucetMessage && (
                  <div style={{
                    marginTop: "16px",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    background: faucetMessage.error ? "rgba(161, 61, 52, 0.08)" : "rgba(40, 104, 168, 0.08)",
                    border: faucetMessage.error ? "1px solid rgba(161, 61, 52, 0.2)" : "1px solid rgba(40, 104, 168, 0.2)",
                    color: faucetMessage.error ? "var(--color-danger)" : "var(--color-info)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>{faucetMessage.text}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Asset Table List (col-span-8) */}
          <section className="glass-panel grid-col-8" style={{ borderRadius: "16px", padding: "0", overflow: "hidden" }}>
            <div style={{
              padding: "16px 24px",
              borderBottom: "1px solid var(--border-glass)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheckIcon size={16} style={{ color: "var(--color-primary)" }} />
                Asset Portfolios & Live Market Feed
              </h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="6" height="6" style={{ flexShrink: 0 }}><circle cx="3" cy="3" r="3" fill="var(--color-success)" /></svg>
                Synced from Pool Reserves
              </span>
            </div>

            <div className="hide-on-mobile" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--border-glass)" }}>
                    <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>Cryptocurrency</th>
                    <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>Price (INR)</th>
                    <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>24h Change</th>
                    <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>Balance (Tokens)</th>
                    <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>Value (INR)</th>
                    <th style={{ padding: "12px 18px", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)" }}>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Ethereum Row */}
                  <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                    <td style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="#8c8d9e" /></svg>
                        Ethereum (ETH)
                      </div>
                    </td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 700 }}>₹{formatNumber(ethPrice)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ background: "rgba(47, 138, 91, 0.1)", color: "var(--color-success)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>+1.45%</span>
                    </td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px" }}>{formatNumber(parseFloat(ethBalance || "0"), 4)}</td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 700 }}>₹{formatNumber(ethVal)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <svg width="64" height="16" stroke="var(--color-success)" fill="none" strokeWidth="2">
                        <path d="M 0 12 L 15 10 L 30 14 L 45 4 L 64 2" />
                      </svg>
                    </td>
                  </tr>
                  {/* MyCoin Row */}
                  <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                    <td style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-primary)" /></svg>
                        MyCoin (MYC)
                      </div>
                    </td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 700 }}>₹{formatNumber(mycPrice, 2)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ 
                        background: mycPrice >= (0.50 * INR_MULTIPLIER) ? "rgba(47, 138, 91, 0.1)" : "rgba(161, 61, 52, 0.1)", 
                        color: mycPrice >= (0.50 * INR_MULTIPLIER) ? "var(--color-success)" : "var(--color-danger)", 
                        padding: "2px 6px", 
                        borderRadius: "4px", 
                        fontSize: "11px" 
                      }}>
                        {mycPrice >= (0.50 * INR_MULTIPLIER) ? "+" : ""}{(((rawMycPrice - 0.50) / 0.50) * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px" }}>{formatNumber(parseFloat(mycBalance || "0"), 2)}</td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 700 }}>₹{formatNumber(mycVal)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <svg width="64" height="16" stroke={mycPrice >= (0.50 * INR_MULTIPLIER) ? "var(--color-success)" : "var(--color-danger)"} fill="none" strokeWidth="2">
                        <path d={mycPrice >= (0.50 * INR_MULTIPLIER) ? "M 0 14 L 20 12 L 40 8 L 64 2" : "M 0 2 L 20 8 L 40 6 L 64 14"} />
                      </svg>
                    </td>
                  </tr>
                  {/* Onyx Row */}
                  <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                    <td style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-accent)" /></svg>
                        Onyx Token (ONYX)
                      </div>
                    </td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 700 }}>₹{formatNumber(onyxPrice, 2)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ 
                        background: onyxPrice >= (2.50 * INR_MULTIPLIER) ? "rgba(47, 138, 91, 0.1)" : "rgba(161, 61, 52, 0.1)", 
                        color: onyxPrice >= (2.50 * INR_MULTIPLIER) ? "var(--color-success)" : "var(--color-danger)", 
                        padding: "2px 6px", 
                        borderRadius: "4px", 
                        fontSize: "11px" 
                      }}>
                        {onyxPrice >= (2.50 * INR_MULTIPLIER) ? "+" : ""}{(((rawOnyxPrice - 2.50) / 2.50) * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px" }}>{formatNumber(parseFloat(onyxBalance || "0"), 2)}</td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 700 }}>₹{formatNumber(onyxVal)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <svg width="64" height="16" stroke={onyxPrice >= (2.50 * INR_MULTIPLIER) ? "var(--color-success)" : "var(--color-danger)"} fill="none" strokeWidth="2">
                        <path d={onyxPrice >= (2.50 * INR_MULTIPLIER) ? "M 0 14 L 20 12 L 40 8 L 64 2" : "M 0 2 L 20 8 L 40 6 L 64 14"} />
                      </svg>
                    </td>
                  </tr>
                  {/* INR Row */}
                  <tr>
                    <td style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-surface2)" /></svg>
                        Indian Rupee (INR)
                      </div>
                    </td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 700 }}>₹{formatNumber(inrPrice, 2)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ background: "rgba(0,0,0,0.03)", color: "var(--text-muted)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>0.00%</span>
                    </td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px" }}>{formatNumber(parseFloat(inrBalance || "0"), 2)}</td>
                    <td className="mono-text" style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 700 }}>₹{formatNumber(inrVal)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <svg width="64" height="16" stroke="var(--text-muted)" fill="none" strokeWidth="2">
                        <path d="M 0 8 L 20 8 L 40 8 L 64 8" />
                      </svg>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* ========================================================
          MOBILE VIEW (Visible on mobile only, matches Stitch Design)
          ======================================================== */}
      <div 
        className="hide-on-desktop mobile-dashboard"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Pull-to-refresh spinner visual indicator */}
        <div style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 0 ? Math.min(1, pullDistance / 40) : 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          transition: isPulling ? "none" : "height 0.3s ease, opacity 0.3s ease",
          width: "100%",
          gap: "8px",
          color: "var(--color-primary)",
          zIndex: 50,
          position: "relative"
        }}>
          <RefreshCw 
            size={16} 
            className={isRefreshing ? "spin" : ""} 
            style={{ 
              transform: isRefreshing ? undefined : `rotate(${pullDistance * 6}deg)`,
              transition: isRefreshing ? "none" : "transform 0.1s linear" 
            }} 
          />
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {isRefreshing ? "Syncing Wallet..." : "Pull to Refresh"}
          </span>
        </div>
        
        {/* Total Balance Hero Section */}
        <section className="mobile-balance-section">
          <p className="mobile-balance-label">Total Balance</p>
          <div className="mobile-balance-row">
            {loading && totalValInr === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "38px" }}>
                <RefreshCw size={16} className="spin" style={{ color: "var(--color-primary)" }} />
                <span style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: 600 }}>Syncing...</span>
              </div>
            ) : (
              <>
                <h1 className="mobile-balance-amount">₹{formatNumber(totalValInr)}</h1>
                <span className="mobile-balance-badge" style={{
                  color: totalValInr > 0 ? "var(--color-secondary)" : "var(--text-muted)",
                  background: totalValInr > 0 ? "rgba(99, 102, 241, 0.1)" : "rgba(255,255,255,0.05)"
                }}>
                  +{gainPercent.toFixed(1)}%
                </span>
              </>
            )}
          </div>
        </section>

        {/* Dynamic Chart (Glass Panel Card) with Performance / Breakdown toggle */}
        <section className="glass-panel mobile-chart-card">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-3xl pointer-events-none"></div>
          
          {/* Header toggle tab */}
          <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px", zIndex: 20, position: "relative" }}>
            <span 
              style={{ 
                fontSize: "12px", 
                fontWeight: 700, 
                cursor: "pointer", 
                color: mobileChartTab === "performance" ? "var(--color-primary)" : "var(--text-muted)",
                transition: "var(--transition-smooth)",
                borderBottom: mobileChartTab === "performance" ? "2px solid var(--color-primary)" : "2px solid transparent",
                paddingBottom: "8px"
              }}
              onClick={() => setMobileChartTab("performance")}
            >
              Performance
            </span>
            <span 
              style={{ 
                fontSize: "12px", 
                fontWeight: 700, 
                cursor: "pointer", 
                color: mobileChartTab === "allocation" ? "var(--color-primary)" : "var(--text-muted)",
                transition: "var(--transition-smooth)",
                borderBottom: mobileChartTab === "allocation" ? "2px solid var(--color-primary)" : "2px solid transparent",
                paddingBottom: "8px"
              }}
              onClick={() => setMobileChartTab("allocation")}
            >
              Allocation Breakdown
            </span>
          </div>

          {isWalletEmpty ? (
            <div className="mobile-chart-empty" style={{ zIndex: 10 }}>
              No assets in wallet. Use the Developer Faucet action below to claim test tokens.
            </div>
          ) : mobileChartTab === "performance" ? (
            <>
              {/* Dynamic Line Chart */}
              <div style={{ width: "100%", height: "120px", position: "relative", zIndex: 10 }}>
                <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
                  <defs>
                    <linearGradient id="mobileGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Area */}
                  <path
                    d={`M 0,${chart.height} L 0,${chart.firstY} L ${chart.pointsStr.replace(/,/g, " ")} L ${chart.width},${chart.height} Z`}
                    fill="url(#mobileGrad)"
                    opacity="0.4"
                  />
                  
                  {/* Line */}
                  <polyline
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="3.5"
                    points={chart.pointsStr}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: "drop-shadow(0px 4px 8px var(--color-primary-glow))" }}
                  />
                </svg>
              </div>

              {/* Time Timeframe Filters */}
              <div className="mobile-time-filters" style={{ zIndex: 10 }}>
                {["1D", "1W", "1M", "1Y", "ALL"].map((t) => (
                  <span
                    key={t}
                    className={t === timeFilter ? "active" : ""}
                    onClick={() => setTimeFilter(t)}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </>
          ) : (
            /* Allocation breakdown donut chart matching Portfolio Breakdown screen */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "10px 0", zIndex: 10, position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
                <svg width="120" height="120" viewBox="0 0 42 42" className="chart-glow" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="4.5" />
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-primary)" strokeWidth="4.5"
                    strokeDasharray={`${mycPercent} ${100 - mycPercent}`} strokeDashoffset={mycOffset} />
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-surface2)" strokeWidth="4.5"
                    strokeDasharray={`${inrPercent} ${100 - inrPercent}`} strokeDashoffset={inrOffset} />
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-accent)" strokeWidth="4.5"
                    strokeDasharray={`${onyxPercent} ${100 - onyxPercent}`} strokeDashoffset={onyxOffset} />
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#8c8d9e" strokeWidth="4.5"
                    strokeDasharray={`${ethPercent} ${100 - ethPercent}`} strokeDashoffset={ethOffset} />
                </svg>
                <div style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  textAlign: "center"
                }}>
                  <span style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Pairs</span>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>4 Coins</p>
                </div>
              </div>

              {/* mini legends grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: "11px", width: "100%", maxWidth: "240px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="6" height="6"><circle cx="3" cy="3" r="3" fill="#8c8d9e" /></svg>
                  <span style={{ color: "var(--text-muted)" }}>ETH ({ethPercent.toFixed(0)}%)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="6" height="6"><circle cx="3" cy="3" r="3" fill="var(--color-primary)" /></svg>
                  <span style={{ color: "var(--text-muted)" }}>MYC ({mycPercent.toFixed(0)}%)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="6" height="6"><circle cx="3" cy="3" r="3" fill="var(--color-surface2)" /></svg>
                  <span style={{ color: "var(--text-muted)" }}>INR ({inrPercent.toFixed(0)}%)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="6" height="6"><circle cx="3" cy="3" r="3" fill="var(--color-accent)" /></svg>
                  <span style={{ color: "var(--text-muted)" }}>ONYX ({onyxPercent.toFixed(0)}%)</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Quick Action Navigation Grid */}
        <section className="mobile-actions-grid">
          <button className="mobile-action-btn" onClick={() => setActiveTab && setActiveTab("send")}>
            <div className="mobile-action-icon-wrapper">
              <Send size={18} />
            </div>
            <span>Send</span>
          </button>
          
          <button className="mobile-action-btn" onClick={() => setActiveTab && setActiveTab("swap")}>
            <div className="mobile-action-icon-wrapper">
              <ArrowRightLeft size={18} />
            </div>
            <span>Swap</span>
          </button>

          <button className="mobile-action-btn" onClick={() => setActiveTab && setActiveTab("receive")}>
            <div className="mobile-action-icon-wrapper">
              <Landmark size={18} />
            </div>
            <span>Deposit</span>
          </button>
        </section>

        {/* Dedicated Mobile Developer Sandbox Faucet Card */}
        <section className="glass-panel" style={{ borderRadius: "20px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={16} style={{ color: "var(--color-primary)" }} />
            <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>Sandbox Token Faucet</h4>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
            Claim 100 free test tokens once every 24 hours.
          </p>

          {!contractConfigured ? (
            <div style={{ color: "var(--color-danger)", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
              <AlertTriangle size={12} />
              Contracts not configured.
            </div>
          ) : (
            <div>
              <button
                className="btn btn-primary"
                onClick={handleClaimFaucet}
                disabled={faucetLoading || cooldownLeft > 0}
                style={{ width: "100%", padding: "10px", fontSize: "12px", fontWeight: 700 }}
              >
                {faucetLoading ? "Requesting..." : cooldownLeft > 0 ? `Cooldown: ${formatCooldown(cooldownLeft)}` : "Claim Test Tokens"}
              </button>

              {faucetMessage && (
                <div style={{
                  marginTop: "8px",
                  padding: "8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  background: faucetMessage.error ? "rgba(161, 61, 52, 0.08)" : "rgba(40, 104, 168, 0.08)",
                  border: faucetMessage.error ? "1px solid rgba(161, 61, 52, 0.2)" : "1px solid rgba(40, 104, 168, 0.2)",
                  color: faucetMessage.error ? "var(--color-danger)" : "var(--color-info)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                  <span>{faucetMessage.text}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Asset List & Live Portfolios */}
        <section className="mobile-assets-section">
          <div className="mobile-assets-tabs">
            <span 
              className={mobileAssetTab === "crypto" ? "active" : ""} 
              onClick={() => setMobileAssetTab("crypto")}
            >
              Crypto
            </span>
            <span 
              className={mobileAssetTab === "etf" ? "active" : ""} 
              onClick={() => setMobileAssetTab("etf")}
            >
              ETF
            </span>
            <span 
              className={mobileAssetTab === "invest" ? "active" : ""} 
              onClick={() => setMobileAssetTab("invest")}
            >
              Invest
            </span>
          </div>

          <div className="mobile-asset-list" style={{ padding: "0" }}>
            {mobileAssetTab === "crypto" && (
              <>
                {/* ETH Row */}
                <div className="mobile-asset-row">
                  <div className="mobile-asset-left">
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="#8c8d9e" /></svg>
                    <div>
                      <div className="mobile-asset-name">Ethereum</div>
                      <div className="mobile-asset-symbol">ETH</div>
                    </div>
                  </div>
                  <div className="mobile-asset-right">
                    <div className="mobile-asset-value">₹{formatNumber(ethVal)}</div>
                    <div className="mobile-asset-balance">{formatNumber(parseFloat(ethBalance || "0"), 4)} ETH</div>
                  </div>
                </div>

                {/* MYC Row */}
                <div className="mobile-asset-row">
                  <div className="mobile-asset-left">
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-primary)" /></svg>
                    <div>
                      <div className="mobile-asset-name">MyCoin</div>
                      <div className="mobile-asset-symbol">MYC</div>
                    </div>
                  </div>
                  <div className="mobile-asset-right">
                    <div className="mobile-asset-value">₹{formatNumber(mycVal)}</div>
                    <div className="mobile-asset-balance">{formatNumber(parseFloat(mycBalance || "0"), 2)} MYC</div>
                  </div>
                </div>

                {/* ONYX Row */}
                <div className="mobile-asset-row">
                  <div className="mobile-asset-left">
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-accent)" /></svg>
                    <div>
                      <div className="mobile-asset-name">Onyx Token</div>
                      <div className="mobile-asset-symbol">ONYX</div>
                    </div>
                  </div>
                  <div className="mobile-asset-right">
                    <div className="mobile-asset-value">₹{formatNumber(onyxVal)}</div>
                    <div className="mobile-asset-balance">{formatNumber(parseFloat(onyxBalance || "0"), 2)} ONYX</div>
                  </div>
                </div>

                {/* INR Row */}
                <div className="mobile-asset-row">
                  <div className="mobile-asset-left">
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-surface2)" /></svg>
                    <div>
                      <div className="mobile-asset-name">Indian Rupee</div>
                      <div className="mobile-asset-symbol">INR</div>
                    </div>
                  </div>
                  <div className="mobile-asset-right">
                    <div className="mobile-asset-value">₹{formatNumber(inrVal)}</div>
                    <div className="mobile-asset-balance">{formatNumber(parseFloat(inrBalance || "0"), 2)} INR</div>
                  </div>
                </div>
              </>
            )}

            {mobileAssetTab === "etf" && (
              <>
                {/* Onyx High-Growth Index */}
                <div className="mobile-asset-row">
                  <div className="mobile-asset-left">
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-primary)" /></svg>
                    <div>
                      <div className="mobile-asset-name">Onyx High-Growth Index</div>
                      <div className="mobile-asset-symbol">ONYX-HG</div>
                    </div>
                  </div>
                  <div className="mobile-asset-right">
                    <div className="mobile-asset-value">₹10,625.05</div>
                    <div className="mobile-asset-balance">2.50 Shares</div>
                  </div>
                </div>

                {/* Nifty 50 Crypto Index */}
                <div className="mobile-asset-row">
                  <div className="mobile-asset-left">
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-accent)" /></svg>
                    <div>
                      <div className="mobile-asset-name">Nifty 50 Crypto Index</div>
                      <div className="mobile-asset-symbol">NF50C</div>
                    </div>
                  </div>
                  <div className="mobile-asset-right">
                    <div className="mobile-asset-value">₹6,400.05</div>
                    <div className="mobile-asset-balance">0.50 Shares</div>
                  </div>
                </div>

                {/* Ethereum Yield ETF */}
                <div className="mobile-asset-row">
                  <div className="mobile-asset-left">
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="#8c8d9e" /></svg>
                    <div>
                      <div className="mobile-asset-name">Ethereum Yield ETF</div>
                      <div className="mobile-asset-symbol">ETH-YLD</div>
                    </div>
                  </div>
                  <div className="mobile-asset-right">
                    <div className="mobile-asset-value">₹10,750.00</div>
                    <div className="mobile-asset-balance">5.00 Shares</div>
                  </div>
                </div>
              </>
            )}

            {mobileAssetTab === "invest" && (
              <>
                {/* Tata Digital Growth Fund */}
                <div className="mobile-asset-row">
                  <div className="mobile-asset-left">
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-surface2)" /></svg>
                    <div>
                      <div className="mobile-asset-name">Tata Digital Growth Fund</div>
                      <div className="mobile-asset-symbol">TATA-DG</div>
                    </div>
                  </div>
                  <div className="mobile-asset-right">
                    <div className="mobile-asset-value">₹23,500.00</div>
                    <div className="mobile-asset-balance">100.00 Units</div>
                  </div>
                </div>

                {/* Reliance Industries Ltd */}
                <div className="mobile-asset-row">
                  <div className="mobile-asset-left">
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-primary)" /></svg>
                    <div>
                      <div className="mobile-asset-name">Reliance Industries Ltd</div>
                      <div className="mobile-asset-symbol">RELIANCE</div>
                    </div>
                  </div>
                  <div className="mobile-asset-right">
                    <div className="mobile-asset-value">₹11,400.00</div>
                    <div className="mobile-asset-balance">4.00 Shares</div>
                  </div>
                </div>

                {/* HDFC Bank Gold Fund */}
                <div className="mobile-asset-row">
                  <div className="mobile-asset-left">
                    <svg width="8" height="8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="4" fill="var(--color-accent)" /></svg>
                    <div>
                      <div className="mobile-asset-name">HDFC Bank Gold Fund</div>
                      <div className="mobile-asset-symbol">HDFC-GLD</div>
                    </div>
                  </div>
                  <div className="mobile-asset-right">
                    <div className="mobile-asset-value">₹21,250.00</div>
                    <div className="mobile-asset-balance">250.00 Units</div>
                  </div>
                </div>
              </>
            )}
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
          <svg width="6" height="6" style={{ flexShrink: 0 }}><circle cx="3" cy="3" r="3" fill="var(--color-success)" /></svg>
          <span style={{ fontWeight: 600 }}>Ethereum Sepolia</span>
          <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>12ms</span>
        </div>
      </footer>

    </div>
  );
};
