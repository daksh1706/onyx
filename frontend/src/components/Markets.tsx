import React, { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { TrendingUp, ArrowDown, ArrowUp, Activity } from "lucide-react";

export const Markets: React.FC = () => {
  const { reserves, onyxReserves, address } = useWallet();

  const [selectedPair, setSelectedPair] = useState<"MYC/USDC" | "ONYX/USDC" | "ETH/USDC">("MYC/USDC");
  const [tickerPrice, setTickerPrice] = useState<number>(0.50);
  const [priceChange, setPriceChange] = useState<number>(2.4);
  const [high24h, setHigh24h] = useState<number>(0.58);
  const [low24h, setLow24h] = useState<number>(0.47);
  const [volume24h, setVolume24h] = useState<number>(843209);
  
  // Real-time order book mock states
  const [bids, setBids] = useState<{ price: number; size: number }[]>([]);
  const [asks, setAsks] = useState<{ price: number; size: number }[]>([]);

  // Dynamically sync spot price from pool reserves if available
  const mycPrice = reserves ? parseFloat(reserves.reserveB) / parseFloat(reserves.reserveA) : 0.50;
  const onyxPrice = onyxReserves ? parseFloat(onyxReserves.reserveB) / parseFloat(onyxReserves.reserveA) : 2.50;

  const getSpotPrice = () => {
    if (selectedPair === "MYC/USDC") return mycPrice;
    if (selectedPair === "ONYX/USDC") return onyxPrice;
    return 3500.00;
  };

  useEffect(() => {
    const spot = getSpotPrice();
    setTickerPrice(spot);
    
    // Seed price change percent based on user address
    const addressSeed = address ? parseInt(address.slice(2, 10), 16) : 42;
    if (selectedPair === "MYC/USDC") {
      const change = reserves ? ((mycPrice - 0.50) / 0.50) * 100 : 2.4 + (addressSeed % 50) / 10;
      setPriceChange(change);
      setHigh24h(0.50 * 1.15);
      setLow24h(0.50 * 0.92);
      setVolume24h(840000 + (addressSeed % 200000));
    } else if (selectedPair === "ONYX/USDC") {
      const change = onyxReserves ? ((onyxPrice - 2.50) / 2.50) * 100 : -1.5 + (addressSeed % 60) / 10;
      setPriceChange(change);
      setHigh24h(2.50 * 1.08);
      setLow24h(2.50 * 0.94);
      setVolume24h(320000 + (addressSeed % 100000));
    } else {
      setPriceChange(1.45);
      setHigh24h(3560.00);
      setLow24h(3420.00);
      setVolume24h(12900000 + (addressSeed % 5000000));
    }
  }, [selectedPair, mycPrice, onyxPrice, reserves, onyxReserves, address]);

  // Generate realistic order book simulation
  useEffect(() => {
    const generateOrderBook = () => {
      const base = tickerPrice;
      const step = selectedPair === "ETH/USDC" ? 1.50 : 0.0025;
      
      const newAsks = Array.from({ length: 6 }).map((_, i) => ({
        price: base + (i + 1) * step,
        size: Math.random() * (selectedPair === "ETH/USDC" ? 5 : 2000) + 10
      })).reverse(); // highest ask on top

      const newBids = Array.from({ length: 6 }).map((_, i) => ({
        price: base - (i + 1) * step,
        size: Math.random() * (selectedPair === "ETH/USDC" ? 5 : 2000) + 10
      }));

      setAsks(newAsks);
      setBids(newBids);
    };

    generateOrderBook();
    const interval = setInterval(generateOrderBook, 3000);
    return () => clearInterval(interval);
  }, [tickerPrice, selectedPair]);

  // SVG Candlestick layout data
  const candleCount = 18;
  const generateCandles = () => {
    const base = tickerPrice;
    
    // Seeded stable data points for charting
    return Array.from({ length: candleCount }).map((_, idx) => {
      const t = idx / (candleCount - 1);
      // Generate realistic price fluctuation curve
      let factor = 1.0;
      if (selectedPair === "MYC/USDC") {
        factor = 0.9 + Math.sin(t * Math.PI * 2) * 0.08 + Math.cos(t * Math.PI * 4) * 0.03;
      } else if (selectedPair === "ONYX/USDC") {
        factor = 0.95 + Math.cos(t * Math.PI * 2) * 0.05 + Math.sin(t * Math.PI * 3) * 0.02;
      } else {
        factor = 0.98 + Math.sin(t * Math.PI * 2.5) * 0.03;
      }
      
      const open = base * factor;
      // Make final candle match the real-time spot ticker price
      const close = idx === candleCount - 1 ? base : base * factor * (1 + (Math.random() - 0.5) * 0.04);
      const high = Math.max(open, close) * (1 + Math.random() * 0.015);
      const low = Math.min(open, close) * (1 - Math.random() * 0.015);
      
      return { open, close, high, low };
    });
  };

  const candles = generateCandles();

  // Find min/max values for layout scaling
  const allValues = candles.flatMap(c => [c.low, c.high]);
  const minVal = Math.min(...allValues) * 0.99;
  const maxVal = Math.max(...allValues) * 1.01;
  const valRange = maxVal - minVal;

  const chartHeight = 220;
  const getScaleY = (val: number) => {
    return chartHeight - ((val - minVal) / valRange) * chartHeight;
  };

  return (
    <div className="fade-in">
      {/* Ticker Row */}
      <div className="glass-panel" style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderRadius: "16px",
        marginBottom: "24px",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        {/* Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <select 
            value={selectedPair} 
            onChange={(e) => setSelectedPair(e.target.value as any)}
            className="form-input"
            style={{ 
              width: "160px", 
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
          <div>
            <h2 className="mono-text" style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-main)" }}>
              ${tickerPrice.toLocaleString(undefined, { minimumFractionDigits: selectedPair === "ETH/USDC" ? 2 : 4, maximumFractionDigits: selectedPair === "ETH/USDC" ? 2 : 4 })}
            </h2>
          </div>
        </div>

        {/* Live Metrics */}
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>24h Change</p>
            <p className="mono-text" style={{ 
              fontSize: "14px", 
              fontWeight: 700, 
              color: priceChange >= 0 ? "#4edea3" : "rgba(255, 0, 85, 0.85)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginTop: "2px"
            }}>
              {priceChange >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
            </p>
          </div>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>24h High</p>
            <p className="mono-text" style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginTop: "2px" }}>
              ${high24h.toLocaleString(undefined, { minimumFractionDigits: selectedPair === "ETH/USDC" ? 2 : 4, maximumFractionDigits: selectedPair === "ETH/USDC" ? 2 : 4 })}
            </p>
          </div>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>24h Low</p>
            <p className="mono-text" style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginTop: "2px" }}>
              ${low24h.toLocaleString(undefined, { minimumFractionDigits: selectedPair === "ETH/USDC" ? 2 : 4, maximumFractionDigits: selectedPair === "ETH/USDC" ? 2 : 4 })}
            </p>
          </div>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>24h Volume</p>
            <p className="mono-text" style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginTop: "2px" }}>
              ${volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Trade View Layout */}
      <div className="dashboard-grid">
        {/* Candlestick Chart View (col-span-8) */}
        <section className="glass-panel grid-col-8" style={{
          borderRadius: "16px",
          padding: "24px",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={16} style={{ color: "var(--color-primary)" }} />
              Live Interactive Candlestick Charts
            </h3>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              TIMEFRAME: 15M
            </span>
          </div>

          <div style={{ height: `${chartHeight}px`, width: "100%", position: "relative", marginTop: "12px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.03)" }}>
            {/* SVG Candles */}
            <svg width="100%" height="100%" viewBox={`0 0 800 ${chartHeight}`} preserveAspectRatio="none">
              {/* Horizontal Grid lines */}
              <line x1="0" y1={chartHeight * 0.25} x2="800" y2={chartHeight * 0.25} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <line x1="0" y1={chartHeight * 0.5} x2="800" y2={chartHeight * 0.5} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <line x1="0" y1={chartHeight * 0.75} x2="800" y2={chartHeight * 0.75} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              
              {candles.map((candle, idx) => {
                const w = 24;
                // spacing out the candles along the 800 width SVG
                const x = (idx / (candleCount)) * 760 + 20; 
                
                const yOpen = getScaleY(candle.open);
                const yClose = getScaleY(candle.close);
                const yHigh = getScaleY(candle.high);
                const yLow = getScaleY(candle.low);
                
                const isGreen = candle.close >= candle.open;
                const strokeColor = isGreen ? "#4edea3" : "rgba(255, 0, 85, 0.85)";
                const fillColor = isGreen ? "rgba(78, 222, 163, 0.35)" : "rgba(255, 0, 85, 0.35)";

                return (
                  <g key={idx}>
                    {/* Shadow line (high-low wick) */}
                    <line x1={x + w/2} y1={yHigh} x2={x + w/2} y2={yLow} stroke={strokeColor} strokeWidth="1.5" />
                    {/* Body rect */}
                    <rect 
                      x={x} 
                      y={Math.min(yOpen, yClose)} 
                      width={w} 
                      height={Math.max(1.5, Math.abs(yOpen - yClose))} 
                      fill={fillColor} 
                      stroke={strokeColor} 
                      strokeWidth="1.5" 
                      rx="2"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "10px", marginTop: "8px", fontFamily: "var(--font-mono)" }}>
            <span>22:00</span>
            <span>22:15</span>
            <span>22:30</span>
            <span>22:45</span>
            <span>23:00</span>
          </div>
        </section>

        {/* Order Book Card (col-span-4) */}
        <section className="glass-panel grid-col-4" style={{
          borderRadius: "16px",
          padding: "24px",
          display: "flex",
          flexDirection: "column"
        }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <TrendingUp size={16} style={{ color: "var(--color-primary)" }} />
            Order Book (USDC)
          </h3>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Headers */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>
              <span>Price</span>
              <span>Size ({selectedPair.split("/")[0]})</span>
            </div>

            {/* Asks (Sells) - Red */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {asks.map((ask, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span className="mono-text" style={{ color: "rgba(255, 0, 85, 0.85)", fontWeight: 600 }}>
                    {ask.price.toLocaleString(undefined, { minimumFractionDigits: selectedPair === "ETH/USDC" ? 2 : 4, maximumFractionDigits: selectedPair === "ETH/USDC" ? 2 : 4 })}
                  </span>
                  <span className="mono-text">{ask.size.toFixed(selectedPair === "ETH/USDC" ? 3 : 1)}</span>
                </div>
              ))}
            </div>

            {/* Mid Price Ticker */}
            <div style={{ 
              borderTop: "1px solid rgba(255,255,255,0.05)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              padding: "6px 0",
              textAlign: "center",
              fontWeight: 700,
              fontSize: "14px",
              color: priceChange >= 0 ? "#4edea3" : "rgba(255, 0, 85, 0.85)"
            }}>
              Spread: {selectedPair === "ETH/USDC" ? "$1.50" : "$0.0025"}
            </div>

            {/* Bids (Buys) - Green */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {bids.map((bid, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span className="mono-text" style={{ color: "#4edea3", fontWeight: 600 }}>
                    {bid.price.toLocaleString(undefined, { minimumFractionDigits: selectedPair === "ETH/USDC" ? 2 : 4, maximumFractionDigits: selectedPair === "ETH/USDC" ? 2 : 4 })}
                  </span>
                  <span className="mono-text">{bid.size.toFixed(selectedPair === "ETH/USDC" ? 3 : 1)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
