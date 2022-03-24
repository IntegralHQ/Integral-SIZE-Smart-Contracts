// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../TwapLPToken.sol';

contract ERC20 is TwapLPToken {
    constructor(uint256 _totalSupply) {
        _mint(msg.sender, _totalSupply);
    }
}
