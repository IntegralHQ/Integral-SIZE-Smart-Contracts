// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../libraries/TokenShares.sol';

contract TokenSharesTest {
    using TokenShares for TokenShares.Data;
    TokenShares.Data tokenShares;

    event Result(uint256 value);

    constructor(address weth) {
        tokenShares.setWeth(weth);
    }

    function totalShares(address token) public view returns (uint256) {
        return tokenShares.totalShares[token];
    }

    function sharesToAmount(address token, uint256 shares) public {
        uint256 result = tokenShares.sharesToAmount(token, shares);
        emit Result(result);
    }

    function amountToShares(
        address token,
        uint256 amount,
        bool wrap
    ) public payable {
        uint256 result = tokenShares.amountToShares(token, amount, wrap);
        emit Result(result);
    }
}
