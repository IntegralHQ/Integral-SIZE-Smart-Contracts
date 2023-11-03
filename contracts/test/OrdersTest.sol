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

    function _enqueueDepositOrder(
        address[2] calldata tokens,
        uint256 share0,
        uint256 share1,
        uint256 minSwapPrice,
        uint256 maxSwapPrice,
        bool unwrap,
        bool swap,
        address to,
        uint256 gasPrice,
        uint256 gasLimit,
        uint32 validAfterTimestamp,
        uint256 priceAccumulator
    ) external {
        Orders.Order memory order = Orders.Order(
            0,
            Orders.OrderType.Deposit,
            false,
            validAfterTimestamp,
            unwrap,
            0,
            gasLimit,
            gasPrice,
            0,
            share0,
            share1,
            tokens[0],
            tokens[1],
            to,
            minSwapPrice,
            maxSwapPrice,
            swap,
            priceAccumulator,
            0,
            0
        );
        orders.enqueueOrder(order);

        emit DepositEnqueued(order.orderId, order);
    }

    function _enqueueWithdrawOrder(
        address[2] calldata tokens,
        uint256 amount,
        uint256 amountAMin,
        uint256 amountBMin,
        bool unwrap,
        address to,
        uint256 gasPrice,
        uint256 gasLimit,
        uint32 validAfterTimestamp
    ) external {
        Orders.Order memory order = Orders.Order(
            0,
            Orders.OrderType.Withdraw,
            false,
            validAfterTimestamp,
            unwrap,
            0,
            gasLimit,
            gasPrice,
            amount,
            amountAMin,
            amountBMin,
            tokens[0],
            tokens[1],
            to,
            0, // minSwapPrice
            0, // maxSwapPrice
            false, // swap
            0, // priceAccumulator
            0, // amountLimit0
            0 // amountLimit1
        );
        orders.enqueueOrder(order);

        emit WithdrawEnqueued(order.orderId, order);
    }

    function _enqueueSellOrder(
        address[2] calldata tokens,
        bool inverse,
        uint256 shareIn,
        uint256 amountOutMin,
        bool unwrap,
        address to,
        uint256 gasPrice,
        uint256 gasLimit,
        uint32 validAfterTimestamp,
        uint256 priceAccumulator,
        uint32 timestamp
    ) external {
        Orders.Order memory order = Orders.Order(
            0,
            Orders.OrderType.Sell,
            inverse,
            validAfterTimestamp,
            unwrap,
            timestamp,
            gasLimit,
            gasPrice,
            0, // liquidity
            shareIn,
            amountOutMin,
            tokens[0],
            tokens[1],
            to,
            0, // minSwapPrice
            0, // maxSwapPrice
            false, // swap
            priceAccumulator,
            0, // amountLimit0
            0 // amountLimit1
        );
        orders.enqueueOrder(order);

        emit SellEnqueued(order.orderId, order);
    }

    function _enqueueBuyOrder(
        address[2] calldata tokens,
        bool inverse,
        uint256 shareInMax,
        uint256 amountOut,
        bool unwrap,
        address to,
        uint256 gasPrice,
        uint256 gasLimit,
        uint32 validAfterTimestamp,
        uint256 priceAccumulator,
        uint32 timestamp
    ) external {
        Orders.Order memory order = Orders.Order(
            0,
            Orders.OrderType.Buy,
            inverse,
            validAfterTimestamp,
            unwrap,
            timestamp,
            gasLimit,
            gasPrice,
            0, // liquidity
            shareInMax,
            amountOut,
            tokens[0],
            tokens[1],
            to,
            0, // minSwapPrice
            0, // maxSwapPrice
            false, // swap
            priceAccumulator,
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
