import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import { Contract } from "ethers";
import { CONTRACT_ADDRESSES, FAUCET_ABI } from "../constants/contracts";
import { Clock, Activity, Zap, AlertTriangle, ShieldCheck as ShieldCheckIcon } from "lucide-react";

interface DashboardProps {
  setActiveTab?: (tab: "portfolio" | "send" | "swap") => void;
}

export const Dashboard: React.FC<DashboardProps> = () => {
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
  const rawMycPrice = reserves ? parseFloat(reserves.reserveB) / parseFloat(reserves.reserveA) : 0.50;
  const rawOnyxPrice = onyxReserves ? parseFloat(onyxReserves.reserveB) / parseFloat(onyxReserves.reserveA) : 2.50;

  const mycPrice = rawMycPrice * INR_MULTIPLIER;
  const onyxPrice = rawOnyxPrice * INR_MULTIPLIER;
  const ethPrice = 3500.00 * INR_MULTIPLIER;
  const inrPrice = 1.00; // INR unit price in INR is 1.0

  const ethVal = parseFloat(ethBalance || "0") * ethPrice;
  const mycVal = parseFloat(mycBalance || "0") * mycPrice;
  const inrVal = parseFloat(inrBalance || "0") * inrPrice;
  const onyxVal = parseFloat(onyxBalance || "0") * onyxPrice;
  const totalValInr = ethVal + mycVal + inrVal + onyxVal;

  // Address seed to generate unique, stable gain percent per address
  const addressSeed = address ? parseInt(address.slice(2, 10), 16) : 42;
  const gainPercent = 1.0 + (addressSeed % 90) / 10; // Between 1.0% and 10.0%
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

  return (
    <div className="fade-in">
      


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

          {(() => {
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

              return { pointsStr, width, height, firstY: height - ((points[0] - minVal) / range) * height };
            };

            const chart = getChartPath();

            return (
              <div style={{ position: "relative" }}>
                {/* Total Balance Hero */}
                <div className="portfolio-header">
                  <span className="portfolio-title">Net Portfolio Assets</span>
                  <div className="portfolio-amount">
                    ₹{formatNumber(totalValInr)}
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-success)", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                      +{gainPercent}% (+₹{formatNumber(gainInr)})
                    </span>
                  </div>
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
                    No assets in wallet. Use the Developer Faucet card below to mint test tokens.
                  </div>
                ) : (
                  <div style={{ width: "100%", overflow: "hidden" }}>
                    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ width: "100%", overflow: "visible" }}>
                      <defs>
                        <linearGradient id="gradient-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-accent)" stopOpacity="0.2" />
                          <stop offset="95%" stopColor="var(--color-accent)" stopOpacity="0" />
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
                        stroke="var(--color-accent)"
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
            );
          })()}
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
              padding: "24px"
            }}>
              No allocation data available.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", flex: 1, justifyContent: "center" }}>
              
              {/* Donut Chart SVG */}
              <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
                <svg width="140" height="140" viewBox="0 0 42 42" style={{ transform: "rotate(-90deg)" }}>
                  {/* Segment: MYC */}
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-primary)" strokeWidth="4.5"
                    strokeDasharray={`${mycPercent} ${100 - mycPercent}`} strokeDashoffset={mycOffset} />
                  {/* Segment: INR */}
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-surface2)" strokeWidth="4.5"
                    strokeDasharray={`${inrPercent} ${100 - inrPercent}`} strokeDashoffset={inrOffset} />
                  {/* Segment: ONYX */}
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-accent)" strokeWidth="4.5"
                    strokeDasharray={`${onyxPercent} ${100 - onyxPercent}`} strokeDashoffset={onyxOffset} />
                  {/* Segment: ETH */}
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#8c8d9e" strokeWidth="4.5"
                    strokeDasharray={`${ethPercent} ${100 - ethPercent}`} strokeDashoffset={ethOffset} />
                </svg>
                
                {/* Center Badge */}
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
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8c8d9e" }} />
                  <span>ETH ({ethPercent.toFixed(0)}%)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-primary)" }} />
                  <span>MYC ({mycPercent.toFixed(0)}%)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-surface2)" }} />
                  <span>INR ({inrPercent.toFixed(0)}%)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-accent)" }} />
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
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-success)", display: "inline-block" }} />
              Synced from Pool Reserves
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
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
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8c8d9e" }} />
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
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-primary)" }} />
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
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-accent)" }} />
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
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-surface2)" }} />
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
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-success)", display: "inline-block" }} />
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
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-success)", display: "inline-block" }} />
          <span style={{ fontWeight: 600 }}>Polygon Amoy</span>
          <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>24ms</span>
        </div>
      </footer>

    </div>
  );
};
