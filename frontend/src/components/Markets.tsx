import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { ArrowDown, ArrowUp, Share2, Star, Landmark } from "lucide-react";

export const Markets: React.FC = () => {
  const { reserves, onyxReserves, address } = useWallet();

  const [selectedPair, setSelectedPair] = useState<"MYC" | "ONYX" | "ETH">("MYC");
  const [timeframe, setTimeframe] = useState<"24h" | "1W" | "1M" | "1Y" | "All">("24h");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const INR_MULTIPLIER = 83;

  // Real-time spot rates from smart contract pools
  const rawMycPrice = reserves ? parseFloat(reserves.reserveB) / parseFloat(reserves.reserveA) : 0.50;
  const rawOnyxPrice = onyxReserves ? parseFloat(onyxReserves.reserveB) / parseFloat(onyxReserves.reserveA) : 2.50;
  const rawEthPrice = 3500.00;

  const getPriceInInr = (rawPrice: number) => rawPrice * INR_MULTIPLIER;

  const currentPriceInr = 
    selectedPair === "MYC" ? getPriceInInr(rawMycPrice) :
    selectedPair === "ONYX" ? getPriceInInr(rawOnyxPrice) :
    selectedPair === "ETH" ? getPriceInInr(rawEthPrice) :
    1.00;

  // Address-seeded stable parameters
  const addressSeed = address ? parseInt(address.slice(2, 10), 16) : 42;
  
  // Calculate stable historical data points based on selection so they don't fluctuate randomly
  const getHistoricalPoints = () => {
    let baseData = [1.02, 0.98, 0.95, 0.92, 0.96, 0.93, 0.99, 1.01, 1.03, 1.00];
    
    if (selectedPair === "MYC") {
      if (timeframe === "24h") baseData = [0.98, 0.99, 0.96, 0.97, 1.01, 0.98, 1.02, 1.00];
      else if (timeframe === "1W") baseData = [0.90, 0.95, 0.92, 0.97, 1.04, 1.02, 1.00];
      else baseData = [0.75, 0.82, 0.88, 0.96, 1.03, 1.00];
    } else if (selectedPair === "ONYX") {
      if (timeframe === "24h") baseData = [1.03, 1.01, 1.02, 0.99, 0.98, 1.00];
      else if (timeframe === "1W") baseData = [1.12, 1.08, 1.04, 1.01, 0.97, 1.00];
      else baseData = [1.35, 1.20, 1.10, 1.05, 0.98, 1.00];
    } else if (selectedPair === "ETH") {
      if (timeframe === "24h") baseData = [0.99, 1.00, 0.98, 1.01, 1.00];
      else if (timeframe === "1W") baseData = [0.94, 0.96, 0.98, 1.02, 1.00];
      else baseData = [0.85, 0.90, 0.95, 1.00];
    } else { // INR stablecoin index
      if (timeframe === "24h") baseData = [1.001, 0.999, 1.000, 1.002, 1.000, 0.998, 1.000];
      else if (timeframe === "1W") baseData = [0.999, 1.001, 1.000, 1.002, 1.000];
      else baseData = [1.000, 1.000, 1.000, 1.000];
    }

    return baseData.map((val, idx) => {
      if (idx === baseData.length - 1) return currentPriceInr;
      return currentPriceInr * val;
    });
  };

  const prices = getHistoricalPoints();
  const openedPrice = prices[0];
  const priceDiff = currentPriceInr - openedPrice;
  const percentageChange = (priceDiff / openedPrice) * 100;

  // Chart rendering parameters
  const chartWidth = 720;
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

  // CoinMarketCap Statistics (Seeded but stable per token)
  const getStats = () => {
    if (selectedPair === "MYC") {
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
    } else if (selectedPair === "ONYX") {
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
    } else if (selectedPair === "ETH") {
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
    } else { // INR
      const circSupply = 34000000000;
      const maxSupply = 34000000000;
      const mcap = currentPriceInr * circSupply;
      const vol = mcap * 0.04;
      return {
        symbol: "INR",
        name: "Indian Rupee",
        rank: 5,
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
      <div className="glass-panel" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px",
        padding: "16px 24px",
        borderRadius: "16px",
        border: "1px solid var(--border-glass)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
            color: "var(--color-fg-inverse)",
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: "18px",
            boxShadow: "0 0 15px rgba(0, 122, 255, 0.15)"
          }}>
            {stats.symbol[0]}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                {stats.name}
              </h1>
              <span className="mono-text" style={{ fontSize: "11px", color: "var(--text-muted)", background: "rgba(0,0,0,0.03)", padding: "2px 6px", borderRadius: "6px" }}>
                {stats.symbol}
              </span>
              <span className="mono-text" style={{ fontSize: "10px", background: "var(--color-primary)", padding: "2px 6px", borderRadius: "6px", color: "var(--color-on-primary)", fontWeight: 700 }}>
                RANK #{stats.rank}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-secondary" style={{ padding: "10px 14px", display: "inline-flex", gap: "6px", borderRadius: "10px" }}>
            <Star size={15} />
            Watchlist
          </button>
          <button className="btn btn-secondary" style={{ padding: "10px 14px", display: "inline-flex", gap: "6px", borderRadius: "10px" }}>
            <Share2 size={15} />
            Share
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="dashboard-grid">
        
        {/* Left Column - Stats (grid-col-4) */}
        <div className="grid-col-4" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Token Select Panel */}
          <section className="glass-panel" style={{ padding: "20px", borderRadius: "16px", border: "1px solid var(--border-glass)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "12px", letterSpacing: "0.05em" }}>
              Select Asset Pair
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {(["MYC", "ONYX", "ETH"] as const).map((pair) => (
                <button
                  key={pair}
                  className="btn"
                  onClick={() => setSelectedPair(pair)}
                  style={{
                    background: selectedPair === pair ? "var(--color-primary)" : "rgba(0,0,0,0.02)",
                    border: selectedPair === pair ? "1px solid var(--color-primary-active)" : "1px solid var(--border-glass)",
                    color: selectedPair === pair ? "var(--color-on-primary)" : "var(--text-muted)",
                    padding: "10px",
                    fontWeight: 700,
                    borderRadius: "10px",
                    boxShadow: "none"
                  }}
                >
                  {pair} / INR
                </button>
              ))}
            </div>
          </section>

          {/* Market Cap & Supply Stats */}
          <section className="glass-panel" style={{ padding: "20px", borderRadius: "16px", border: "1px solid var(--border-glass)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "16px", letterSpacing: "0.05em" }}>
              Market Valuation Stats
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Market Cap</span>
                <span className="mono-text" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                  {formatCompact(stats.mcap)}
                </span>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border-glass)", margin: 0 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>24h Volume</span>
                <span className="mono-text" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                  {formatCompact(stats.vol)}
                </span>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border-glass)", margin: 0 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Fully Diluted Val</span>
                <span className="mono-text" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                  {formatCompact(stats.fdv)}
                </span>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border-glass)", margin: 0 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Circulating Supply</span>
                <span className="mono-text" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                  {stats.circSupply.toLocaleString()}
                </span>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border-glass)", margin: 0 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Max Supply</span>
                <span className="mono-text" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                  {stats.maxSupply.toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          {/* Quick Pool Reserve Ratio Badge */}
          <section className="glass-panel" style={{ padding: "16px", borderRadius: "16px", border: "1px solid var(--border-glass)" }}>
            <h4 style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Landmark size={12} style={{ color: "var(--color-primary)" }} />
              On-Chain Pricing Method
            </h4>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.5", margin: 0 }}>
              Determined fully on-chain by constant product Automated Market Maker (AMM) reserves. Current spot rate is: {stats.name} reserve divided by INR reserve.
            </p>
          </section>
        </div>

        {/* Right Column - CoinMarketCap Chart (grid-col-8) */}
        <div className="grid-col-8" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <section className="glass-panel" style={{ padding: "24px", borderRadius: "16px", border: "1px solid var(--border-glass)", display: "flex", flexDirection: "column" }}>
            
            {/* Header: Price and Time Filters */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
              <div>
                <h2 className="mono-text" style={{ fontSize: "32px", fontWeight: 800, margin: 0, color: "var(--text-main)", letterSpacing: "-0.03em" }}>
                  {formatCurrency(currentPriceInr)}
                </h2>
                <p className="mono-text" style={{ 
                  fontSize: "13px", 
                  fontWeight: 700, 
                  color: percentageChange >= 0 ? "var(--color-success)" : "var(--color-danger)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  marginTop: "2px"
                }}>
                  {percentageChange >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  {percentageChange >= 0 ? "+" : ""}{percentageChange.toFixed(2)}% ({formatCurrency(priceDiff)})
                </p>
              </div>

              {/* Timeframes filter */}
              <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.03)", padding: "4px", borderRadius: "8px" }}>
                {(["24h", "1W", "1M", "1Y", "All"] as const).map((t) => (
                  <button
                    key={t}
                    className="btn"
                    onClick={() => setTimeframe(t)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "11px",
                      borderRadius: "6px",
                      background: t === timeframe ? "var(--color-primary)" : "transparent",
                      color: t === timeframe ? "var(--color-on-primary)" : "var(--text-muted)",
                      fontWeight: t === timeframe ? 700 : 500,
                      boxShadow: "none"
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Chart SVG */}
            <div style={{ position: "relative", width: "100%", overflow: "hidden" }}>
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", overflow: "visible" }}>
                <defs>
                  <linearGradient id="markets-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={percentageChange >= 0 ? "var(--color-success)" : "var(--color-danger)"} stopOpacity="0.2" />
                    <stop offset="95%" stopColor={percentageChange >= 0 ? "var(--color-success)" : "var(--color-danger)"} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Area under curve */}
                <path d={`M 0,${chartHeight} L 0,${getY(prices[0])} L ${prices.map((p, i) => `${getX(i)},${getY(p)}`).join(" ")} L ${chartWidth},${chartHeight} Z`} fill="url(#markets-gradient)" />
                
                {/* SVG Polyline Stroke */}
                <path
                  d={linePath}
                  fill="none"
                  stroke={percentageChange >= 0 ? "var(--color-success)" : "var(--color-danger)"}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="chart-glow"
                />

                {/* Grid guidelines */}
                <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="var(--border-glass)" strokeDasharray="4 4" />
                <line x1={chartWidth / 2} y1="0" x2={chartWidth / 2} y2={chartHeight} stroke="var(--border-glass)" strokeDasharray="4 4" />

                {/* Interactive hover guides */}
                {hoverIndex !== null && (
                  <>
                    <line x1={getX(hoverIndex)} y1="0" x2={getX(hoverIndex)} y2={chartHeight} stroke="var(--color-accent)" strokeWidth="1" />
                    <circle cx={getX(hoverIndex)} cy={getY(prices[hoverIndex])} r="6" fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth="2" />
                  </>
                )}

                {/* Invisible overlay for capture interactions */}
                <rect
                  width={chartWidth}
                  height={chartHeight}
                  fill="transparent"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const index = Math.round((x / rect.width) * (prices.length - 1));
                    if (index >= 0 && index < prices.length) {
                      setHoverIndex(index);
                    }
                  }}
                  onMouseLeave={() => setHoverIndex(null)}
                  style={{ cursor: "crosshair" }}
                />
              </svg>
            </div>

            {/* Chart footer tooltip info */}
            <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)" }}>
              <span>First point: {formatCurrency(openedPrice)}</span>
              {hoverIndex !== null && (
                <span className="mono-text" style={{ color: "var(--color-accent)", fontWeight: 700 }}>
                  Selected Rate: {formatCurrency(prices[hoverIndex])}
                </span>
              )}
              <span>Last point: {formatCurrency(currentPriceInr)}</span>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};
