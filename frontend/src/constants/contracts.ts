// Contract configurations for the MyCoin and SimpleSwap frontend

export const CONTRACT_ADDRESSES = {
  MyCoin: import.meta.env.VITE_MYCOIN_ADDRESS || "0x1d8686F4915beD4b621e568199f2E37A2653b031",
  MockINR: import.meta.env.VITE_USDC_ADDRESS || "0x8a1468102B2ED21eD1f91C38F87009519703967d",
  CustomToken: import.meta.env.VITE_ONYX_ADDRESS || "0xAC5139b73cE32D3D24a4Dad10bAF9a1D3d11FDe2",
  Faucet: import.meta.env.VITE_FAUCET_ADDRESS || "0x903dbDA83a87d6Bb7EAcc9Be88c133e2Ae2Ccbc3",
  SimpleSwap: import.meta.env.VITE_SWAP_ADDRESS || "0xCCD633f8237AadBBa54846A73204448A8d6a726b",
  OnyxSwap: import.meta.env.VITE_ONYX_SWAP_ADDRESS || "0x9587872bB3dD4993D4C3AD4279a2E218Dcb3C863",
  MycOnyxSwap: import.meta.env.VITE_MYC_ONYX_SWAP_ADDRESS || "0xB587872bB3dD4993D4C3AD4279a2E218Dcb3C863",
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

export const MOCKINR_ABI = [
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
  "function FAUCET_AMOUNT_INR() view returns (uint256)",
  "function FAUCET_AMOUNT_CUSTOM() view returns (uint256)",
  "function myCoin() view returns (address)",
  "function mockInr() view returns (address)",
  "function customToken() view returns (address)",
  "event TokensDispensed(address indexed receiver, uint256 amountMyc, uint256 amountInr, uint256 amountCustom)"
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
