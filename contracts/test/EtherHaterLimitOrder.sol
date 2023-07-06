// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../interfaces/ITwapLimitOrder.sol';

contract EtherHaterLimitOrder {
    function callExecute(ITwapLimitOrder limitOrder, uint256 orderId) external {
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        limitOrder.executeOrders(orderIds);
    }

    receive() external payable {
        revert('EtherHaterLimitOrder: NOPE_SORRY');
    }

    fallback() external payable {
        revert('EtherHaterLimitOrder fallback: NOPE_SORRY');
    }
}
