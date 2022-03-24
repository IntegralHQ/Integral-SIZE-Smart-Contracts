// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../libraries/AbstractERC20.sol';

contract AdjustableERC20 is AbstractERC20 {
    constructor(uint256 _totalSupply) {
        name = 'AdjustableERC20';
        symbol = 'ADJ';
        decimals = 18;
        _mint(msg.sender, _totalSupply);
    }

    function setBalance(address account, uint256 value) public {
        balanceOf[account] = value;
    }
}
