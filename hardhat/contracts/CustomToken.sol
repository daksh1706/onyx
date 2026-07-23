// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title CustomToken
 * @dev Standard ERC20 token deployed with configurable name and symbol.
 */
contract CustomToken is ERC20 {
    /**
     * @dev Constructor that mints the total initial supply to the deployer.
     * @param name The name of the token.
     * @param symbol The symbol of the token.
     * @param initialSupply The initial token supply in base units.
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }
}
