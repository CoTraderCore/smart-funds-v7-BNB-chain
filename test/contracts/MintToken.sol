// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "./openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/ERC20Burnable.sol";
import "./openzeppelin-contracts/contracts/access/Ownable.sol";

contract MintToken is ERC20, ERC20Burnable, Ownable {
    constructor(uint256 _initSupply) public ERC20("COT", "COT") {
        _mint(msg.sender, _initSupply);
    }

    function mint(address to, uint256 amount) public onlyOwner {
      _mint(to, amount);
    }
}
