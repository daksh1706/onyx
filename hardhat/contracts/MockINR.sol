// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockINR
 * @dev Mock INR token with 6 decimals for testing swaps.
 * Anyone can mint MockINR for testing purposes.
 */
contract MockINR is ERC20 {
    constructor() ERC20("Mock INR", "INR") {
        _mint(msg.sender, 1_000_000 * 10**decimals());
    }

    /**
     * @dev Custom decimals to match 6 decimals.
     */
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    /**
     * @dev Public mint function allowing anyone to mint mock INR.
     * @param to The address receiving the tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
