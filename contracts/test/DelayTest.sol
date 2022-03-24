// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '../TwapDelay.sol';

contract DelayTest is TwapDelay {
    using Orders for Orders.Data;

    constructor(
        address _factory,
        address _weth,
        address _bot
    ) TwapDelay(_factory, _weth, _bot) {}

    function setGasPrice(uint256 _gasPrice) public {
        orders.gasPrice = _gasPrice;
    }

    function testUpdateGasPrice(uint256 gasUsed) public {
        orders.updateGasPrice(gasUsed);
    }

    function testPerformRefund(
        Orders.OrderType orderType,
        uint256 validAfterTimestamp,
        uint256 orderId,
        bool shouldRefundEth
    ) public {
        performRefund(orderType, validAfterTimestamp, orderId, shouldRefundEth);
    }
}
