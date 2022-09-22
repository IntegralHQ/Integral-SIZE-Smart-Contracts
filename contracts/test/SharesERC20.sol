// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../libraries/AbstractERC20.sol';
import '../libraries/SafeMath.sol';

contract SharesERC20 is AbstractERC20 {
    using SafeMath for uint256;

    uint256 public variance;

    constructor(uint256 _totalSupply) {
        name = 'Share Mechanics Token';
        symbol = 'SMT';
        decimals = 18;
        _mint(msg.sender, _totalSupply);
    }

    function setVariance(uint256 v) external {
        variance = v;
    }

    function transfer(address to, uint256 value) external override returns (bool) {
        _transfer(msg.sender, to, value.sub(variance));
        return true;
    }
}
