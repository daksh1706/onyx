# MyCoin PortWallet & AMM Swap

A professional-grade, self-custody portfolio wallet and constant-product AMM trading pool built for the **Ethereum Sepolia** testnet. This project is optimized to run entirely on **free infrastructure** (free RPC tiers, free testnet ETH, and client-side key derivation).

---

## Architecture Diagram

The diagram below illustrates the relationship between the client-side wallet, the JSON-RPC provider, and the deployed smart contracts on the blockchain network:

```mermaid
graph TD
    subgraph Browser / Client
        FE[React Frontend]
        KM[In-Memory Key Manager]
        MM[MetaMask Browser Extension]
    end

    subgraph Infrastructure
        RPC[Alchemy / Infura RPC Provider]
    end

    subgraph Ethereum Sepolia Testnet
        MYC[MyCoin.sol ERC-20]
        USDC[MockUSDC.sol ERC-20]
        FAU[Faucet.sol]
        AMM[SimpleSwap.sol AMM]
    end

    FE -->|Derives Keys & Signs| KM
    FE -->|Requests Signs| MM
    FE -->|JSON-RPC Calls| RPC
    RPC -->|Read / Write State| Ethereum Sepolia Testnet
```

---

## How Trading Works: The AMM Math

SimpleSwap uses a **Constant-Product Automated Market Maker (AMM)** model, matching the core mathematics of Uniswap V2. 

### The Core Formula
The pool holds reserves of two tokens: **MyCoin (token $x$)** and **Mock USDC (token $y$)**. It enforces that the product of the reserves remains constant:
$$x \times y = k$$

When a user swaps an input amount $dx$ for an output amount $dy$, the pool charges a **0.3% trading fee** to reward liquidity providers (LP). The fee is subtracted from the input, leaving $dx \times 0.997$ for the swap. The math to determine the output $dy$ is:
$$(x + dx \times 0.997) \times (y - dy) = k$$

Solving for $dy$ yields the execution formula:
$$dy = \frac{dx \times 0.997 \times y}{x + dx \times 0.997}$$

### Price Impact & Slippage
* **Price Impact**: When you execute a swap, the pool's ratio shifts. The larger your swap relative to the reserves ($x$ or $y$), the worse your execution rate becomes compared to the marginal price ($y / x$). Our UI calculates and displays this **Price Impact** before you sign the transaction:
  $$\text{Price Impact} \% = \left(1 - \frac{\text{Execution Rate}}{\text{Marginal Rate}}\right) \times 100$$
* **Slippage Protection**: SimpleSwap includes a `minAmountOut` slippage parameter. If block congestion or frontrunning shifts the reserve ratio beyond your tolerance (e.g. 0.5%), the smart contract reverts the swap to protect your funds.

---

## Security Highlights

1. **Secure Key Derivation**: Uses standard BIP-39 mnemonics and BIP-32 HD derivation paths. Private keys are derived and maintained strictly in React state (in-memory). Plaintext keys are **never** written to localStorage or transmitted over any network request.
2. **Reentrancy Protection**: The `Faucet` and `SimpleSwap` AMM contracts inherit OpenZeppelin's `ReentrancyGuard` and apply the `nonReentrant` modifier to all state-changing functions.
3. **Decimals Agility**: Supports trading tokens with asymmetric decimals (MYC has 18 decimals, while mock USDC has 6 decimals). The LP share calculations are dynamically scaled to 18 decimals in the constructor, preventing division-precision roundoffs.

---

## Setup & Local Installation

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [npm](https://www.npmjs.com/)

### 1. Smart Contract Setup & Compilation
1. Navigate to the contract folder:
   ```bash
   cd hardhat
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the Solidity contracts:
   ```bash
   npx hardhat compile
   ```
4. Run the full Chai unit test suite (compiles coverage as well):
   ```bash
   npx hardhat test
   ```

### 2. Local Blockchain Deployment (Optional)
To test locally without waiting for testnet blocks:
1. Start a local Hardhat node:
   ```bash
   npx hardhat node
   ```
2. In a separate terminal, deploy the contracts locally:
   ```bash
   npx hardhat run scripts/deploy.ts --network localhost
   ```

### 3. Public Sepolia Network Deployment
To deploy contracts to the public Ethereum Sepolia network for free:
1. Create a free account on [Alchemy](https://www.alchemy.com/) or [Infura](https://www.infura.io/) and get a **Sepolia RPC URL**.
2. Get some free Sepolia Test ETH from a faucet:
   * [Google Cloud Sepolia Faucet](https://cloud.google.com/application-integration/docs/faucets/sepolia) (0.05 ETH/day, free)
   * [Sepolia PoW Faucet](https://sepolia-faucet.pk910.de/) (free)
   * [Alchemy Sepolia Faucet](https://sepoliafaucet.com/) (0.5 ETH/day, requires Alchemy account)
3. Copy `hardhat/.env.example` to `hardhat/.env` and configure:
   ```env
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-api-key
   PRIVATE_KEY=your-sepolia-private-key-with-test-eth
   ETHERSCAN_API_KEY=your-etherscan-key-for-verification
   ```
4. Deploy the contracts to Sepolia (this script automatically funds the faucet, adds initial reserves to the AMM pool, and verifies the contracts on Etherscan):
   ```bash
   npx hardhat run scripts/deploy.ts --network sepolia
   ```

---

### 4. Frontend Wallet Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install client dependencies:
   ```bash
   npm install
   ```
3. Create `frontend/.env` to point to your deployed contracts:
   ```env
   # Public Sepolia RPC URL (or Alchemy/Infura URL)
   VITE_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
   
   # Deployed Contract Addresses from deploy.ts output
   VITE_MYCOIN_ADDRESS=0x...
   VITE_USDC_ADDRESS=0x...
   VITE_FAUCET_ADDRESS=0x...
   VITE_SWAP_ADDRESS=0x...
   ```
4. Run the development server locally:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:5173](http://localhost:5173) in your browser. You can generate a new wallet, claim test tokens from the faucet, and execute swap trades immediately.
