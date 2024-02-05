// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/ITwapDelay.sol';
import '../interfaces/IERC20.sol';

contract OrderIdTest {
    event OrderId(uint256 orderId);

    address delay;

    constructor(address _delay) {
        delay = _delay;
    }

    function deposit(Orders.DepositParams calldata depositParams) public payable {
        uint256 orderId = ITwapDelay(delay).deposit{ value: msg.value }(depositParams);
        emit OrderId(orderId);
    }

    function withdraw(Orders.WithdrawParams calldata withdrawParams) public payable {
        uint256 orderId = ITwapDelay(delay).withdraw{ value: msg.value }(withdrawParams);
        emit OrderId(orderId);
    }

    function sell(Orders.SellParams calldata sellParams) public payable {
        uint256 orderId = ITwapDelay(delay).sell{ value: msg.value }(sellParams);
        emit OrderId(orderId);
    }

    function buy(Orders.BuyParams calldata buyParams) public payable {
        uint256 orderId = ITwapDelay(delay).buy{ value: msg.value }(buyParams);
        emit OrderId(orderId);
    }

    function approve(address token, address beneficiary, uint256 value) public {
        IERC20(token).approve(beneficiary, value);
    }
}
