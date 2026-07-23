// Contract configurations for the MyCoin and SimpleSwap frontend

export const CONTRACT_ADDRESSES = {
  MyCoin: import.meta.env.VITE_MYCOIN_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  MockUSDC: import.meta.env.VITE_USDC_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  CustomToken: import.meta.env.VITE_ONYX_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  Faucet: import.meta.env.VITE_FAUCET_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  SimpleSwap: import.meta.env.VITE_SWAP_ADDRESS || "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
};

export const MYCOIN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function mint(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

export const MOCKUSDC_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function mint(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

export const FAUCET_ABI = [
  "function requestTokens() external",
  "function nextAccessTime(address user) view returns (uint256)",
  "function FAUCET_AMOUNT_MYC() view returns (uint256)",
  "function FAUCET_AMOUNT_USDC() view returns (uint256)",
  "function FAUCET_AMOUNT_CUSTOM() view returns (uint256)",
  "function myCoin() view returns (address)",
  "function mockUsdc() view returns (address)",
  "function customToken() view returns (address)",
  "event TokensDispensed(address indexed receiver, uint256 amountMyc, uint256 amountUsdc, uint256 amountCustom)"
];

export const SIMPLESWAP_ABI = [
  "function tokenA() view returns (address)",
  "function tokenB() view returns (address)",
  "function reserveA() view returns (uint256)",
  "function reserveB() view returns (uint256)",
  "function scaleFactor() view returns (uint256)",
  "function getAmountOut(address tokenIn, uint256 amountIn) view returns (uint256)",
  "function addLiquidity(uint256 amountADesired, uint256 amountBDesired) external returns (uint256, uint256, uint256)",
  "function removeLiquidity(uint256 lpAmount) external returns (uint256, uint256)",
  "function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) external returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Swapped(address indexed swapper, address indexed tokenIn, uint256 amountIn, uint256 amountOut)"
];
