import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { ArrowDown, ArrowUp, Share2, Star } from "lucide-react";

export const Markets: React.FC = () => {
  const { reserves, onyxReserves, address } = useWallet();

  const [selectedPair, setSelectedPair] = useState<"MYC/USDC" | "ONYX/USDC" | "ETH/USDC">("MYC/USDC");
  const [timeframe, setTimeframe] = useState<"24h" | "1W" | "1M" | "1Y" | "All">("24h");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const INR_MULTIPLIER = 83;

  // Real-time spot rates from smart contract pools
  const rawMycPrice = reserves ? parseFloat(reserves.reserveB) / parseFloat(reserves.reserveA) : 0.50;
  const rawOnyxPrice = onyxReserves ? parseFloat(onyxReserves.reserveB) / parseFloat(onyxReserves.reserveA) : 2.50;
  const rawEthPrice = 3500.00;

  const getPriceInInr = (rawPrice: number) => rawPrice * INR_MULTIPLIER;

  const currentPriceInr = 
    selectedPair === "MYC/USDC" ? getPriceInInr(rawMycPrice) :
    selectedPair === "ONYX/USDC" ? getPriceInInr(rawOnyxPrice) :
    getPriceInInr(rawEthPrice);

  // Address-seeded stable parameters
  const addressSeed = address ? parseInt(address.slice(2, 10), 16) : 42;
  
  // Calculate stable historical data points based on selection so they don't fluctuate randomly
  const getHistoricalPoints = () => {
    let baseData = [1.02, 0.98, 0.95, 0.92, 0.96, 0.93, 0.99, 1.01, 1.03, 1.00];
    
    if (selectedPair === "MYC/USDC") {
      if (timeframe === "24h") baseData = [0.98, 0.99, 0.96, 0.97, 1.01, 0.98, 1.02, 1.00];
      else if (timeframe === "1W") baseData = [0.90, 0.95, 0.92, 0.97, 1.04, 1.02, 1.00];
      else baseData = [0.75, 0.82, 0.88, 0.96, 1.03, 1.00];
    } else if (selectedPair === "ONYX/USDC") {
      if (timeframe === "24h") baseData = [1.03, 1.01, 1.02, 0.99, 0.98, 1.00];
      else if (timeframe === "1W") baseData = [1.12, 1.08, 1.04, 1.01, 0.97, 1.00];
      else baseData = [1.35, 1.20, 1.10, 1.05, 0.98, 1.00];
    } else {
      if (timeframe === "24h") baseData = [0.99, 1.00, 0.98, 1.01, 1.00];
      else if (timeframe === "1W") baseData = [0.94, 0.96, 0.98, 1.02, 1.00];
      else baseData = [0.85, 0.90, 0.95, 1.00];
    }

    // Multiply by current price so that the chart scales dynamically and matches the spot price at the end!
    return baseData.map((val, idx) => {
      // The last element is pinned exactly to current price
      if (idx === baseData.length - 1) return currentPriceInr;
      return currentPriceInr * val;
    });
  };

  const prices = getHistoricalPoints();
  const openedPrice = prices[0];
  const priceDiff = currentPriceInr - openedPrice;
  const percentageChange = (priceDiff / openedPrice) * 100;

  // Chart rendering parameters
  const chartWidth = 600;
  const chartHeight = 280;
  const minPrice = Math.min(...prices) * 0.995;
  const maxPrice = Math.max(...prices) * 1.005;
  const range = maxPrice - minPrice || 1;

  const getX = (idx: number) => (idx / (prices.length - 1)) * chartWidth;
  const getY = (val: number) => chartHeight - ((val - minPrice) / range) * chartHeight;

  // Build SVG Path
  let linePath = `M ${getX(0)} ${getY(prices[0])}`;
  for (let i = 1; i < prices.length; i++) {
    linePath += ` L ${getX(i)} ${getY(prices[i])}`;
  }
  const areaPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  // CoinMarketCap Statistics (Seeded but stable per token)
  const getStats = () => {
    if (selectedPair === "MYC/USDC") {
      const circSupply = 5000000 + (addressSeed % 1000000);
      const maxSupply = 21000000;
      const mcap = currentPriceInr * circSupply;
      const vol = mcap * 0.12;
      return {
        symbol: "MYC",
        name: "MyCoin",
        rank: 124,
        mcap,
        vol,
        fdv: currentPriceInr * maxSupply,
        circSupply,
        maxSupply
      };
    } else if (selectedPair === "ONYX/USDC") {
      const circSupply = 2500000 + (addressSeed % 500000);
      const maxSupply = 10000000;
      const mcap = currentPriceInr * circSupply;
      const vol = mcap * 0.08;
      return {
        symbol: "ONYX",
        name: "Onyx Token",
        rank: 218,
        mcap,
        vol,
        fdv: currentPriceInr * maxSupply,
        circSupply,
        maxSupply
      };
    } else {
      const circSupply = 120000000;
      const maxSupply = 120000000;
      const mcap = currentPriceInr * circSupply;
      const vol = mcap * 0.05;
      return {
        symbol: "ETH",
        name: "Ethereum",
        rank: 2,
        mcap,
        vol,
        fdv: currentPriceInr * maxSupply,
        circSupply,
        maxSupply
      };
    }
  };

  const stats = getStats();

  const formatCurrency = (val: number) => {
    return "₹" + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatCompact = (val: number) => {
    if (val >= 10000000) return "₹" + (val / 10000000).toFixed(2) + " Cr";
    if (val >= 100000) return "₹" + (val / 100000).toFixed(2) + " L";
    return "₹" + val.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* CoinMarketCap Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            background: "var(--color-primary)",
            color: "#0b1326",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "14px"
          }}>
            {stats.symbol[0]}
          </div>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              {stats.name} 
              <span style={{ fontSize: "14px", color: "var(--text-muted)", textTransform: "uppercase" }}>{stats.symbol}</span>
              <span className="mono-text" style={{ fontSize: "10px", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px", color: "var(--text-muted)" }}>
                #{stats.rank}
              </span>
            </h1>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <select 
            value={selectedPair} 
            onChange={(e) => setSelectedPair(e.target.value as any)}
            className="form-input"
            style={{ 
              width: "140px", 
              background: "rgba(0,0,0,0.3)", 
              border: "1px solid var(--border-glass)", 
              color: "var(--color-primary)",
              fontWeight: 700
            }}
          >
            <option value="MYC/USDC">MYC / USDC</option>
            <option value="ONYX/USDC">ONYX / USDC</option>
            <option value="ETH/USDC">ETH / USDC</option>
          </select>
          <button className="circle-btn" title="Add to watchlist">
            <Star size={16} />
          </button>
          <button className="circle-btn" title="Share token">
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* Main Grid: Left statistics, Right Trade Chart */}
      <div className="dashboard-grid">
        
        {/* Left Column - CoinMarketCap Stats (grid-col-4) */}
        <div className="grid-col-4" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <section className="glass-panel" style={{ padding: "20px", borderRadius: "16px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Key Metrics (INR)
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Market Cap</p>
                <h4 className="mono-text" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)", margin: "4px 0 0 0" }}>
                  {formatCompact(stats.mcap)}
                </h4>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border-glass)", margin: 0 }} />
              <div>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>24h Volume</p>
                <h4 className="mono-text" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)", margin: "4px 0 0 0" }}>
                  {formatCompact(stats.vol)}
                </h4>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border-glass)", margin: 0 }} />
              <div>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Fully Diluted Valuation (FDV)</p>
                <h4 className="mono-text" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)", margin: "4px 0 0 0" }}>
                  {formatCompact(stats.fdv)}
                </h4>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border-glass)", margin: 0 }} />
              <div>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Circulating Supply</p>
                <h4 className="mono-text" style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)", margin: "4px 0 0 0" }}>
                  {stats.circSupply.toLocaleString()} {stats.symbol}
                </h4>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border-glass)", margin: 0 }} />
              <div>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Max Supply</p>
                <h4 className="mono-text" style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)", margin: "4px 0 0 0" }}>
                  {stats.maxSupply.toLocaleString()} {stats.symbol}
                </h4>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column - CoinMarketCap Chart (grid-col-8) */}
        <div className="grid-col-8" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <section className="glass-panel" style={{ padding: "24px", borderRadius: "16px", display: "flex", flexDirection: "column" }}>
            
            {/* Header: Price and Time Filters */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
              <div>
                <h2 className="mono-text" style={{ fontSize: "32px", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                  {formatCurrency(currentPriceInr)}
                </h2>
                <p className="mono-text" style={{ 
                  fontSize: "13px", 
                  fontWeight: 700, 
                  color: percentageChange >= 0 ? "#4edea3" : "rgba(255, 0, 85, 0.85)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  margin: "4px 0 0 0"
                }}>
                  {percentageChange >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  {percentageChange >= 0 ? "+" : ""}{percentageChange.toFixed(2)}% (24h)
                </p>
              </div>

              {/* Timeframes */}
              <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.05)", padding: "4px", borderRadius: "8px" }}>
                {(["24h", "1W", "1M", "1Y", "All"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className="btn"
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      borderRadius: "6px",
                      background: t === timeframe ? "var(--color-primary)" : "transparent",
                      color: t === timeframe ? "#0b1326" : "var(--text-muted)",
                      fontWeight: t === timeframe ? 700 : 500,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Dotted opening price threshold and main line graph */}
            <div 
              style={{ 
                height: `${chartHeight}px`, 
                width: "100%", 
                position: "relative",
                background: "rgba(255,255,255,0.01)",
                borderRadius: "8px"
              }}
              onMouseLeave={() => setHoverIndex(null)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const ratio = mouseX / rect.width;
                const index = Math.min(
                  prices.length - 1,
                  Math.max(0, Math.floor(ratio * prices.length))
                );
                setHoverIndex(index);
              }}
            >
              <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="marketsGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor={percentageChange >= 0 ? "#4edea3" : "rgba(255, 0, 85, 0.85)"} stopOpacity="0.25" />
                    <stop offset="95%" stopColor={percentageChange >= 0 ? "#4edea3" : "rgba(255, 0, 85, 0.85)"} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Dotted Opening Price Line */}
                <line 
                  x1="0" 
                  y1={getY(openedPrice)} 
                  x2={chartWidth} 
                  y2={getY(openedPrice)} 
                  stroke="rgba(255,255,255,0.15)" 
                  strokeDasharray="4 4" 
                  strokeWidth="1.5" 
                />

                {/* Fill Area */}
                <path d={areaPath} fill="url(#marketsGradient)" />

                {/* Line Path */}
                <path 
                  d={linePath} 
                  fill="none" 
                  stroke={percentageChange >= 0 ? "#4edea3" : "rgba(255, 0, 85, 0.85)"} 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                />

                {/* Hover Guide lines */}
                {hoverIndex !== null && (
                  <line 
                    x1={getX(hoverIndex)} 
                    y1="0" 
                    x2={getX(hoverIndex)} 
                    y2={chartHeight} 
                    stroke="rgba(255,255,255,0.1)" 
                    strokeDasharray="2 2"
                  />
                )}
              </svg>

              {/* Price axis tags on the right */}
              <div style={{
                position: "absolute",
                top: 0,
                right: "12px",
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                fontSize: "10px",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                pointerEvents: "none",
                textAlign: "right"
              }}>
                <span>{formatCurrency(maxPrice)}</span>
                <span>{formatCurrency(openedPrice)}</span>
                <span>{formatCurrency(minPrice)}</span>
              </div>

              {/* Live Interactive Hover Tooltip */}
              {hoverIndex !== null && (
                <div style={{
                  position: "absolute",
                  top: "16px",
                  left: "16px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-glass)",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  pointerEvents: "none"
                }}>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "9px" }}>HISTORICAL POINT</p>
                  <p className="mono-text" style={{ margin: "2px 0 0 0", fontWeight: 700, color: "var(--color-primary)" }}>
                    {formatCurrency(prices[hoverIndex])}
                  </p>
                </div>
              )}
            </div>

            {/* Time labels below chart */}
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "10px", marginTop: "12px", fontFamily: "var(--font-mono)" }}>
              <span>17 Aug</span>
              <span>3:00 AM</span>
              <span>6:00 AM</span>
              <span>9:00 AM</span>
              <span>12:00 PM</span>
              <span>3:00 PM</span>
              <span>6:00 PM</span>
              <span>9:00 PM</span>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};
