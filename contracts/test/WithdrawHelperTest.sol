// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../libraries/WithdrawHelper.sol';

contract WithdrawHelperTest {
    constructor() {}

    function transferToken(
        uint256 balanceBefore,
        address token,
        address to
    ) public {
        return WithdrawHelper._transferToken(balanceBefore, token, to);
    }
}
