// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyCoin
 * @dev ERC20 token with a capped supply and owner-only minting.
 */
contract MyCoin is ERC20Capped, Ownable {
    /**
     * @dev Constructor that sets the cap and initial owner.
     * @param cap_ The maximum supply of the token.
     * @param initialOwner The address that will own the contract.
     */
    constructor(uint256 cap_, address initialOwner)
        ERC20("MyCoin", "MYC")
        ERC20Capped(cap_)
        Ownable(initialOwner)
    {}

    /**
     * @dev Mints new tokens. Only callable by the owner.
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

}
