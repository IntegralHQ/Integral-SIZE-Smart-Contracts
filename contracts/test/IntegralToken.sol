// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../interfaces/IIntegralToken.sol';
import '../abstracts/AbstractERC20.sol';

contract IntegralToken is IIntegralToken, AbstractERC20 {
    address public owner;
    mapping(address => bool) public isMinter;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalSupply
    ) {
        owner = msg.sender;
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        _mint(msg.sender, _totalSupply);
    }

    function mint(address to, uint256 amount) external override {
        _mint(to, amount);
    }

    function setMinter(address account, bool _isMinter) external {}
}
