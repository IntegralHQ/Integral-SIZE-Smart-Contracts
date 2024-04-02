// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '../libraries/Orders.sol';
import '../libraries/SafeMath.sol';

contract OrdersTest {
    using SafeMath for uint256;
    using Orders for Orders.Data;
    Orders.Data orders;

    event DepositEnqueued(uint256 indexed orderId, Orders.Order order);
    event WithdrawEnqueued(uint256 indexed orderId, Orders.Order order);
    event SellEnqueued(uint256 indexed orderId, Orders.Order order);
    event BuyEnqueued(uint256 indexed orderId, Orders.Order order);

    uint256 public constant DELAY = 1 weeks;

    struct Order {
        uint256 validAfterTimestamp;
        bool unwrap;
        uint256 timestamp;
        uint256 gasLimit;
        uint256 gasPrice;
        uint256 liquidity;
        uint256 value0;
        uint256 value1;
        address[] tokens;
        address to;
        uint256 minSwapPrice;
        uint256 maxSwapPrice;
        bool swap;
    }

    function delay() external pure returns (uint256) {
        return DELAY;
    }

    function lastProcessedOrderId() external view returns (uint256) {
        return orders.lastProcessedOrderId;
    }

    function newestOrderId() external view returns (uint256) {
        return orders.newestOrderId;
    }

    function getOrderHash(uint256 orderId) external view returns (bytes32) {
        return orders.orderQueue[orderId];
    }

    function _enqueueDepositOrder(Order calldata orderInfo) external {
        Orders.Order memory order = Orders.Order(
            0,
            Orders.OrderType.Deposit,
            orderInfo.validAfterTimestamp,
            orderInfo.unwrap,
            0,
            orderInfo.gasLimit,
            orderInfo.gasPrice,
            0,
            orderInfo.value0,
            orderInfo.value1,
            orderInfo.tokens,
            orderInfo.to,
            orderInfo.minSwapPrice,
            orderInfo.maxSwapPrice,
            orderInfo.swap,
            0,
            0
        );
        orders.enqueueOrder(order);

        emit DepositEnqueued(order.orderId, order);
    }

    function _enqueueWithdrawOrder(Order calldata orderInfo) external {
        Orders.Order memory order = Orders.Order(
            0,
            Orders.OrderType.Withdraw,
            orderInfo.validAfterTimestamp,
            orderInfo.unwrap,
            0,
            orderInfo.gasLimit,
            orderInfo.gasPrice,
            orderInfo.liquidity,
            orderInfo.value0,
            orderInfo.value1,
            orderInfo.tokens,
            orderInfo.to,
            0, // minSwapPrice
            0, // maxSwapPrice
            false, // swap
            0, // amountLimit0
            0 // amountLimit1
        );
        orders.enqueueOrder(order);

        emit WithdrawEnqueued(order.orderId, order);
    }

    function _enqueueSellOrder(Order calldata orderInfo) external {
        Orders.Order memory order = Orders.Order(
            0,
            Orders.OrderType.Sell,
            orderInfo.validAfterTimestamp,
            orderInfo.unwrap,
            orderInfo.timestamp,
            orderInfo.gasLimit,
            orderInfo.gasPrice,
            0, // liquidity
            orderInfo.value0,
            orderInfo.value1,
            orderInfo.tokens,
            orderInfo.to,
            0, // minSwapPrice
            0, // maxSwapPrice
            false, // swap
            0, // amountLimit0
            0 // amountLimit1
        );
        orders.enqueueOrder(order);

        emit SellEnqueued(order.orderId, order);
    }

    function _enqueueBuyOrder(Order calldata orderInfo) external {
        Orders.Order memory order = Orders.Order(
            0,
            Orders.OrderType.Buy,
            orderInfo.validAfterTimestamp,
            orderInfo.unwrap,
            orderInfo.timestamp,
            orderInfo.gasLimit,
            orderInfo.gasPrice,
            0, // liquidity
            orderInfo.value0,
            orderInfo.value1,
            orderInfo.tokens,
            orderInfo.to,
            0, // minSwapPrice
            0, // maxSwapPrice
            false, // swap
            0, // amountLimit0
            0 // amountLimit1
        );
        orders.enqueueOrder(order);

        emit BuyEnqueued(order.orderId, order);
    }

    function _dequeueOrder(uint256 orderId) external {
        orders.dequeueOrder(orderId);
    }

    function forgetLastProcessedOrder() external {
        orders.forgetLastProcessedOrder();
    }
}
