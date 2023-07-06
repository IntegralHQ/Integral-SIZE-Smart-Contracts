// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/ITwapDelay.sol';

contract EtherHater {
    function callExecute(ITwapDelay delay, Orders.Order[] calldata orders) external {
        delay.execute(orders);
    }

    receive() external payable {
        revert('EtherHater: NOPE_SORRY');
    }

    fallback() external payable {
        revert('EtherHater fallback: NOPE_SORRY');
    }
}
