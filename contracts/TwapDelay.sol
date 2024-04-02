// SPDX-License-Identifier: GPL-3.0-or-later
// Deployed with donations via Gitcoin GR9

pragma solidity 0.7.6;
pragma abicoder v2;

import './interfaces/ITwapPair.sol';
import './interfaces/ITwapDelay.sol';
import './interfaces/IWETH.sol';
import './libraries/SafeMath.sol';
import './libraries/Orders.sol';
import './libraries/TokenShares.sol';
import './libraries/AddLiquidity.sol';
import './libraries/WithdrawHelper.sol';
import './libraries/ExecutionHelper.sol';
import './interfaces/ITwapFactoryGovernor.sol';
import './libraries/Macros.sol';

contract TwapDelay is ITwapDelay {
    using SafeMath for uint256;
    using Orders for Orders.Data;
    using TokenShares for TokenShares.Data;

    Orders.Data internal orders;
    TokenShares.Data internal tokenShares;

    uint256 private constant ORDER_CANCEL_TIME = 24 hours;
    uint256 private constant BOT_EXECUTION_TIME = 20 minutes;

    address public override owner;
    address public override factoryGovernor;
    address public constant RELAYER_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F    /*__MACRO__GLOBAL.RELAYER_PROXY_ADDRESS*/; //prettier-ignore
    mapping(address => bool) public override isBot;

    constructor(address _factoryGovernor, address _bot) {
        _setOwner(msg.sender);
        _setFactoryGovernor(_factoryGovernor);
        _setBot(_bot, true);

        orders.gasPrice = tx.gasprice;
        _emitEventWithDefaults();
    }

    function getTransferGasCost(address token) external pure override returns (uint256 gasCost) {
        return Orders.getTransferGasCost(token);
    }

    function getDepositDisabled(address pair) external view override returns (bool) {
        return orders.getDepositDisabled(pair);
    }

    function getWithdrawDisabled(address pair) external view override returns (bool) {
        return orders.getWithdrawDisabled(pair);
    }

    function getBuyDisabled(address pair) external view override returns (bool) {
        return orders.getBuyDisabled(pair);
    }

    function getSellDisabled(address pair) external view override returns (bool) {
        return orders.getSellDisabled(pair);
    }

    function getOrderStatus(
        uint256 orderId,
        uint256 validAfterTimestamp
    ) external view override returns (Orders.OrderStatus) {
        return orders.getOrderStatus(orderId, validAfterTimestamp);
    }

    uint256 private locked = 1;
    modifier lock() {
        require(locked == 1, 'TD06');
        locked = 2;
        _;
        locked = 1;
    }

    function factory() external pure override returns (address) {
        return Orders.FACTORY_ADDRESS;
    }

    function totalShares(address token) external view override returns (uint256) {
        return tokenShares.totalShares[token];
    }

    // returns wrapped native currency for particular blockchain (WETH or WMATIC)
    function weth() external pure override returns (address) {
        return TokenShares.WETH_ADDRESS;
    }

    function relayer() external pure override returns (address) {
        return RELAYER_ADDRESS;
    }

    function isNonRebasingToken(address token) external pure override returns (bool) {
        return TokenShares.isNonRebasing(token);
    }

    function delay() external pure override returns (uint256) {
        return Orders.DELAY;
    }

    function lastProcessedOrderId() external view returns (uint256) {
        return orders.lastProcessedOrderId;
    }

    function newestOrderId() external view returns (uint256) {
        return orders.newestOrderId;
    }

    function isOrderCanceled(uint256 orderId) external view returns (bool) {
        return orders.canceled[orderId];
    }

    function maxGasLimit() external pure override returns (uint256) {
        return Orders.MAX_GAS_LIMIT;
    }

    function maxGasPriceImpact() external pure override returns (uint256) {
        return Orders.MAX_GAS_PRICE_IMPACT;
    }

    function gasPriceInertia() external pure override returns (uint256) {
        return Orders.GAS_PRICE_INERTIA;
    }

    function gasPrice() external view override returns (uint256) {
        return orders.gasPrice;
    }

    function setOrderTypesDisabled(
        address pair,
        Orders.OrderType[] calldata orderTypes,
        bool disabled
    ) external override {
        require(msg.sender == owner, 'TD00');
        orders.setOrderTypesDisabled(pair, orderTypes, disabled);
    }

    function setOwner(address _owner) external override {
        require(msg.sender == owner, 'TD00');
        _setOwner(_owner);
    }

    function _setOwner(address _owner) internal {
        require(_owner != owner, 'TD01');
        require(_owner != address(0), 'TD02');
        owner = _owner;
        emit OwnerSet(_owner);
    }

    function setFactoryGovernor(address _factoryGovernor) external override {
        require(msg.sender == owner, 'TD00');
        _setFactoryGovernor(_factoryGovernor);
    }

    function _setFactoryGovernor(address _factoryGovernor) internal {
        require(_factoryGovernor != factoryGovernor, 'TD01');
        require(_factoryGovernor != address(0), 'TD02');
        factoryGovernor = _factoryGovernor;
        emit FactoryGovernorSet(_factoryGovernor);
    }

    function setBot(address _bot, bool _isBot) external override {
        require(msg.sender == owner, 'TD00');
        _setBot(_bot, _isBot);
    }

    function _setBot(address _bot, bool _isBot) internal {
        require(_isBot != isBot[_bot], 'TD01');
        isBot[_bot] = _isBot;
        emit BotSet(_bot, _isBot);
    }

    function deposit(
        Orders.DepositParams calldata depositParams
    ) external payable override lock returns (uint256 orderId) {
        orders.deposit(depositParams, tokenShares);
        return orders.newestOrderId;
    }

    function withdraw(
        Orders.WithdrawParams calldata withdrawParams
    ) external payable override lock returns (uint256 orderId) {
        orders.withdraw(withdrawParams);
        return orders.newestOrderId;
    }

    function sell(Orders.SellParams calldata sellParams) external payable override lock returns (uint256 orderId) {
        orders.sell(sellParams, tokenShares);
        return orders.newestOrderId;
    }

    function relayerSell(
        Orders.SellParams calldata sellParams
    ) external payable override lock returns (uint256 orderId) {
        require(msg.sender == RELAYER_ADDRESS, 'TD00');
        orders.relayerSell(sellParams, tokenShares);
        return orders.newestOrderId;
    }

    function buy(Orders.BuyParams calldata buyParams) external payable override lock returns (uint256 orderId) {
        orders.buy(buyParams, tokenShares);
        return orders.newestOrderId;
    }

    /// @dev This implementation processes orders sequentially and skips orders that have already been executed.
    /// If it encounters an order that is not yet valid, it stops execution since subsequent orders will also be invalid
    /// at the time.
    function execute(Orders.Order[] calldata _orders) external payable override lock {
        uint256 ordersLength = _orders.length;
        uint256 gasBefore = gasleft();
        bool orderExecuted;
        bool senderCanExecute = isBot[msg.sender] || isBot[address(0)];
        for (uint256 i; i < ordersLength; ++i) {
            if (_orders[i].orderId <= orders.lastProcessedOrderId) {
                continue;
            }
            if (orders.canceled[_orders[i].orderId]) {
                orders.dequeueOrder(_orders[i].orderId);
                continue;
            }
            orders.verifyOrder(_orders[i]);
            uint256 validAfterTimestamp = _orders[i].validAfterTimestamp;
            if (validAfterTimestamp >= block.timestamp) {
                break;
            }
            require(senderCanExecute || block.timestamp >= validAfterTimestamp + BOT_EXECUTION_TIME, 'TD00');
            orderExecuted = true;
            if (_orders[i].orderType == Orders.OrderType.Deposit) {
                executeDeposit(_orders[i]);
            } else if (_orders[i].orderType == Orders.OrderType.Withdraw) {
                executeWithdraw(_orders[i]);
            } else if (_orders[i].orderType == Orders.OrderType.Sell) {
                executeSell(_orders[i]);
            } else if (_orders[i].orderType == Orders.OrderType.Buy) {
                executeBuy(_orders[i]);
            }
        }
        if (orderExecuted) {
            orders.updateGasPrice(gasBefore.sub(gasleft()));
        }
    }

    /// @dev The `order` must be verified by calling `Orders.verifyOrder` before calling this function.
    function executeDeposit(Orders.Order calldata order) internal {
        uint256 gasStart = gasleft();
        orders.dequeueOrder(order.orderId);

        (bool executionSuccess, bytes memory data) = address(this).call{
            gas: order.gasLimit.sub(
                Orders.DEPOSIT_ORDER_BASE_COST +
                    Orders.getTransferGasCost(order.token0) +
                    Orders.getTransferGasCost(order.token1)
            )
        }(abi.encodeWithSelector(this._executeDeposit.selector, order));

        bool refundSuccess = true;
        if (!executionSuccess) {
            refundSuccess = refundTokens(
                order.to,
                order.token0,
                order.value0,
                order.token1,
                order.value1,
                order.unwrap,
                false
            );
        }
        finalizeOrder(refundSuccess);
        (uint256 gasUsed, uint256 ethRefund) = refund(order.gasLimit, order.gasPrice, gasStart, order.to);
        emit OrderExecuted(orders.lastProcessedOrderId, executionSuccess, data, gasUsed, ethRefund);
    }

    /// @dev The `order` must be verified by calling `Orders.verifyOrder` before calling this function.
    function executeWithdraw(Orders.Order calldata order) internal {
        uint256 gasStart = gasleft();
        orders.dequeueOrder(order.orderId);

        (bool executionSuccess, bytes memory data) = address(this).call{
            gas: order.gasLimit.sub(Orders.WITHDRAW_ORDER_BASE_COST + Orders.PAIR_TRANSFER_COST)
        }(abi.encodeWithSelector(this._executeWithdraw.selector, order));

        bool refundSuccess = true;
        if (!executionSuccess) {
            (address pair, ) = Orders.getPair(order.token0, order.token1);
            refundSuccess = Orders.refundLiquidity(pair, order.to, order.liquidity, this._refundLiquidity.selector);
        }
        finalizeOrder(refundSuccess);
        (uint256 gasUsed, uint256 ethRefund) = refund(order.gasLimit, order.gasPrice, gasStart, order.to);
        emit OrderExecuted(orders.lastProcessedOrderId, executionSuccess, data, gasUsed, ethRefund);
    }

    /// @dev The `order` must be verified by calling `Orders.verifyOrder` before calling this function.
    function executeSell(Orders.Order calldata order) internal {
        uint256 gasStart = gasleft();
        orders.dequeueOrder(order.orderId);

        (bool executionSuccess, bytes memory data) = address(this).call{
            gas: order.gasLimit.sub(Orders.SELL_ORDER_BASE_COST + Orders.getTransferGasCost(order.token0))
        }(abi.encodeWithSelector(this._executeSell.selector, order));

        bool refundSuccess = true;
        if (!executionSuccess) {
            refundSuccess = refundToken(order.token0, order.to, order.value0, order.unwrap, false);
        }
        finalizeOrder(refundSuccess);
        (uint256 gasUsed, uint256 ethRefund) = refund(order.gasLimit, order.gasPrice, gasStart, order.to);
        emit OrderExecuted(orders.lastProcessedOrderId, executionSuccess, data, gasUsed, ethRefund);
    }

    /// @dev The `order` must be verified by calling `Orders.verifyOrder` before calling this function.
    function executeBuy(Orders.Order calldata order) internal {
        uint256 gasStart = gasleft();
        orders.dequeueOrder(order.orderId);

        (bool executionSuccess, bytes memory data) = address(this).call{
            gas: order.gasLimit.sub(Orders.BUY_ORDER_BASE_COST + Orders.getTransferGasCost(order.token0))
        }(abi.encodeWithSelector(this._executeBuy.selector, order));

        bool refundSuccess = true;
        if (!executionSuccess) {
            refundSuccess = refundToken(order.token0, order.to, order.value0, order.unwrap, false);
        }
        finalizeOrder(refundSuccess);
        (uint256 gasUsed, uint256 ethRefund) = refund(order.gasLimit, order.gasPrice, gasStart, order.to);
        emit OrderExecuted(orders.lastProcessedOrderId, executionSuccess, data, gasUsed, ethRefund);
    }

    function finalizeOrder(bool refundSuccess) private {
        if (!refundSuccess) {
            orders.markRefundFailed();
        } else {
            orders.forgetLastProcessedOrder();
        }
    }

    function refund(
        uint256 gasLimit,
        uint256 gasPriceInOrder,
        uint256 gasStart,
        address to
    ) private returns (uint256 gasUsed, uint256 leftOver) {
        uint256 feeCollected = gasLimit.mul(gasPriceInOrder);
        gasUsed = gasStart.sub(gasleft()).add(Orders.REFUND_BASE_COST);
        uint256 actualRefund = Math.min(feeCollected, gasUsed.mul(orders.gasPrice));
        leftOver = feeCollected.sub(actualRefund);
        require(refundEth(msg.sender, actualRefund), 'TD40');
        refundEth(payable(to), leftOver);
    }

    function refundEth(address payable to, uint256 value) internal returns (bool success) {
        if (value == 0) {
            return true;
        }
        success = TransferHelper.transferETH(to, value, Orders.getTransferGasCost(Orders.NATIVE_CURRENCY_SENTINEL));
        emit EthRefund(to, success, value);
    }

    function refundToken(
        address token,
        address to,
        uint256 share,
        bool unwrap,
        bool forwardAllGas
    ) private returns (bool) {
        if (share == 0) {
            return true;
        }
        (bool success, bytes memory data) = address(this).call{
            gas: forwardAllGas ? gasleft() : Orders.TOKEN_REFUND_BASE_COST + Orders.getTransferGasCost(token)
        }(abi.encodeWithSelector(this._refundToken.selector, token, to, share, unwrap));
        if (!success) {
            emit Orders.RefundFailed(to, token, share, data);
        }
        return success;
    }

    function refundTokens(
        address to,
        address token0,
        uint256 share0,
        address token1,
        uint256 share1,
        bool unwrap,
        bool forwardAllGas
    ) private returns (bool) {
        (bool success, bytes memory data) = address(this).call{
            gas: forwardAllGas
                ? gasleft()
                : 2 *
                    Orders.TOKEN_REFUND_BASE_COST +
                    Orders.getTransferGasCost(token0) +
                    Orders.getTransferGasCost(token1)
        }(abi.encodeWithSelector(this._refundTokens.selector, to, token0, share0, token1, share1, unwrap));
        if (!success) {
            emit Orders.RefundFailed(to, token0, share0, data);
            emit Orders.RefundFailed(to, token1, share1, data);
        }
        return success;
    }

    function _refundTokens(
        address to,
        address token0,
        uint256 share0,
        address token1,
        uint256 share1,
        bool unwrap
    ) external payable {
        // no need to check sender, because it is checked in _refundToken
        _refundToken(token0, to, share0, unwrap);
        _refundToken(token1, to, share1, unwrap);
    }

    function _refundToken(address token, address to, uint256 share, bool unwrap) public payable {
        require(msg.sender == address(this), 'TD00');
        if (token == TokenShares.WETH_ADDRESS && unwrap) {
            uint256 amount = tokenShares.sharesToAmount(token, share, 0, to);
            IWETH(TokenShares.WETH_ADDRESS).withdraw(amount);
            TransferHelper.safeTransferETH(to, amount, Orders.getTransferGasCost(Orders.NATIVE_CURRENCY_SENTINEL));
        } else {
            TransferHelper.safeTransfer(token, to, tokenShares.sharesToAmount(token, share, 0, to));
        }
    }

    function _refundLiquidity(address pair, address to, uint256 liquidity) external payable {
        require(msg.sender == address(this), 'TD00');
        return TransferHelper.safeTransfer(pair, to, liquidity);
    }

    function _executeDeposit(Orders.Order calldata order) external payable {
        require(msg.sender == address(this), 'TD00');

        (address pairAddress, ) = Orders.getPair(order.token0, order.token1);

        ITwapPair(pairAddress).sync();
        ITwapFactoryGovernor(factoryGovernor).distributeFees(order.token0, order.token1, pairAddress);
        ITwapPair(pairAddress).sync();
        ExecutionHelper.executeDeposit(order, pairAddress, getTolerance(pairAddress), tokenShares);
    }

    function _executeWithdraw(Orders.Order calldata order) external payable {
        require(msg.sender == address(this), 'TD00');

        (address pairAddress, ) = Orders.getPair(order.token0, order.token1);

        ITwapPair(pairAddress).sync();
        ITwapFactoryGovernor(factoryGovernor).distributeFees(order.token0, order.token1, pairAddress);
        ITwapPair(pairAddress).sync();
        ExecutionHelper.executeWithdraw(order);
    }

    function _executeBuy(Orders.Order calldata order) external payable {
        require(msg.sender == address(this), 'TD00');

        (address pairAddress, ) = Orders.getPair(order.token0, order.token1);
        ExecutionHelper.ExecuteBuySellParams memory orderParams;
        orderParams.order = order;
        orderParams.pairAddress = pairAddress;
        orderParams.pairTolerance = getTolerance(pairAddress);

        ITwapPair(pairAddress).sync();
        ExecutionHelper.executeBuy(orderParams, tokenShares);
    }

    function _executeSell(Orders.Order calldata order) external payable {
        require(msg.sender == address(this), 'TD00');

        (address pairAddress, ) = Orders.getPair(order.token0, order.token1);
        ExecutionHelper.ExecuteBuySellParams memory orderParams;
        orderParams.order = order;
        orderParams.pairAddress = pairAddress;
        orderParams.pairTolerance = getTolerance(pairAddress);

        ITwapPair(pairAddress).sync();
        ExecutionHelper.executeSell(orderParams, tokenShares);
    }

    /// @dev The `order` must be verified by calling `Orders.verifyOrder` before calling this function.
    function performRefund(Orders.Order calldata order, bool shouldRefundEth) internal {
        bool canOwnerRefund = order.validAfterTimestamp.add(365 days) < block.timestamp;

        if (order.orderType == Orders.OrderType.Deposit) {
            address to = canOwnerRefund ? owner : order.to;
            require(
                refundTokens(to, order.token0, order.value0, order.token1, order.value1, order.unwrap, true),
                'TD14'
            );
            if (shouldRefundEth) {
                require(refundEth(payable(to), order.gasPrice.mul(order.gasLimit)), 'TD40');
            }
        } else if (order.orderType == Orders.OrderType.Withdraw) {
            (address pair, ) = Orders.getPair(order.token0, order.token1);
            address to = canOwnerRefund ? owner : order.to;
            require(Orders.refundLiquidity(pair, to, order.liquidity, this._refundLiquidity.selector), 'TD14');
            if (shouldRefundEth) {
                require(refundEth(payable(to), order.gasPrice.mul(order.gasLimit)), 'TD40');
            }
        } else if (order.orderType == Orders.OrderType.Sell) {
            address to = canOwnerRefund ? owner : order.to;
            require(refundToken(order.token0, to, order.value0, order.unwrap, true), 'TD14');
            if (shouldRefundEth) {
                require(refundEth(payable(to), order.gasPrice.mul(order.gasLimit)), 'TD40');
            }
        } else if (order.orderType == Orders.OrderType.Buy) {
            address to = canOwnerRefund ? owner : order.to;
            require(refundToken(order.token0, to, order.value0, order.unwrap, true), 'TD14');
            if (shouldRefundEth) {
                require(refundEth(payable(to), order.gasPrice.mul(order.gasLimit)), 'TD40');
            }
        } else {
            return;
        }
        orders.forgetOrder(order.orderId);
    }

    function retryRefund(Orders.Order calldata order) external override lock {
        orders.verifyOrder(order);
        require(orders.refundFailed[order.orderId], 'TD21');
        performRefund(order, false);
    }

    function cancelOrder(Orders.Order calldata order) external override lock {
        orders.verifyOrder(order);
        require(
            orders.getOrderStatus(order.orderId, order.validAfterTimestamp) == Orders.OrderStatus.EnqueuedReady,
            'TD52'
        );
        require(order.validAfterTimestamp.sub(Orders.DELAY).add(ORDER_CANCEL_TIME) < block.timestamp, 'TD1C');
        orders.canceled[order.orderId] = true;
        performRefund(order, true);
    }

    function syncPair(address token0, address token1) external override returns (address pairAddress) {
        require(msg.sender == factoryGovernor, 'TD00');

        (pairAddress, ) = Orders.getPair(token0, token1);
        ITwapPair(pairAddress).sync();
    }

    // prettier-ignore
    function _emitEventWithDefaults() internal {
        emit MaxGasLimitSet(Orders.MAX_GAS_LIMIT);
        emit GasPriceInertiaSet(Orders.GAS_PRICE_INERTIA);
        emit MaxGasPriceImpactSet(Orders.MAX_GAS_PRICE_IMPACT);
        emit DelaySet(Orders.DELAY);
        emit RelayerSet(RELAYER_ADDRESS);

        // #if defined(TOLERANCE__PAIR_WETH_USDC)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_USDC);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_USDC_E)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_USDC_E);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_USDT)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_USDT);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_WBTC)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_WBTC);
        // #endif
        // #if defined(TOLERANCE__PAIR_USDC_USDT)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_USDC_USDT);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_CVX)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_CVX);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_SUSHI)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_SUSHI);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_STETH)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_STETH);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_WSTETH)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_WSTETH_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_WSTETH);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_DAI)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_DAI);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_RPL)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_RPL_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_RPL);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_SWISE)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_SWISE_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_SWISE);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_LDO)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_LDO_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_LDO);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_GMX)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_GMX_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_GMX);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_ARB)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_ARB_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_ARB);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_MKR)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_MKR_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_MKR);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_UNI)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_UNI_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_UNI);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_LINK)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_LINK_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_LINK);
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_MNT)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_MNT_ADDRESS, __MACRO__MAPPING.TOLERANCE__PAIR_WETH_MNT);
        // #endif

        emit TransferGasCostSet(Orders.NATIVE_CURRENCY_SENTINEL, Orders.ETHER_TRANSFER_CALL_COST);
        // #if defined(TRANSFER_GAS_COST__TOKEN_WETH)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_WETH_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_WETH);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_USDC)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_USDC_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_USDC);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_USDC_E)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_USDC_E_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_USDC_E);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_USDT)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_USDT_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_USDT);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_WBTC)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_WBTC_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_WBTC);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_CVX)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_CVX_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_CVX);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_SUSHI)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_SUSHI_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_SUSHI);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_STETH)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_STETH_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_STETH);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_WSTETH)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_WSTETH_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_WSTETH);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_DAI)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_DAI_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_DAI);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_RPL)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_RPL_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_RPL);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_SWISE)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_SWISE_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_SWISE);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_LDO)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_LDO_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_LDO);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_GMX)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_GMX_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_GMX);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_ARB)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_ARB_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_ARB);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_MKR)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_MKR_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_MKR);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_UNI)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_UNI_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_UNI);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_LINK)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_LINK_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_LINK);
        // #endif
        // #if defined(TRANSFER_GAS_COST__TOKEN_MNT)
        emit TransferGasCostSet(__MACRO__GLOBAL.TOKEN_MNT_ADDRESS, __MACRO__MAPPING.TRANSFER_GAS_COST__TOKEN_MNT);
        // #endif

        // #if defined(IS_NON_REBASING__TOKEN_WETH)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_WETH_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_WETH);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_USDC)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_USDC_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_USDC);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_USDC_E)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_USDC_E_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_USDC_E);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_USDT)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_USDT_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_USDT);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_WBTC)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_WBTC_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_WBTC);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_CVX)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_CVX_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_CVX);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_SUSHI)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_SUSHI_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_SUSHI);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_STETH)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_STETH_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_STETH);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_WSTETH)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_WSTETH_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_WSTETH);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_DAI)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_DAI_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_DAI);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_RPL)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_RPL_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_RPL);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_SWISE)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_SWISE_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_SWISE);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_LDO)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_LDO_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_LDO);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_GMX)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_GMX_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_GMX);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_ARB)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_ARB_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_ARB);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_MKR)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_MKR_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_MKR);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_UNI)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_UNI_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_UNI);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_LINK)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_LINK_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_LINK);
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_MNT)
        emit NonRebasingTokenSet(__MACRO__GLOBAL.TOKEN_MNT_ADDRESS, __MACRO__MAPPING.IS_NON_REBASING__TOKEN_MNT);
        // #endif
    }

    // prettier-ignore
    // constant mapping for tolerance
    function getTolerance(address/* #if !bool(TOLERANCE) */ pair/* #endif */) public virtual view override returns (uint16 tolerance) {
        // #if defined(TOLERANCE__PAIR_WETH_USDC) && (uint(TOLERANCE__PAIR_WETH_USDC) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_USDC;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_USDC_E) && (uint(TOLERANCE__PAIR_WETH_USDC_E) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_USDC_E;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_USDT) && (uint(TOLERANCE__PAIR_WETH_USDT) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_USDT;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_WBTC) && (uint(TOLERANCE__PAIR_WETH_WBTC) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_WBTC;
        // #endif
        // #if defined(TOLERANCE__PAIR_USDC_USDT) && (uint(TOLERANCE__PAIR_USDC_USDT) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_USDC_USDT;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_CVX) && (uint(TOLERANCE__PAIR_WETH_CVX) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_CVX;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_SUSHI) && (uint(TOLERANCE__PAIR_WETH_SUSHI) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_SUSHI;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_STETH) && (uint(TOLERANCE__PAIR_WETH_STETH) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_STETH;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_WSTETH) && (uint(TOLERANCE__PAIR_WETH_WSTETH) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_WSTETH_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_WSTETH;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_DAI) && (uint(TOLERANCE__PAIR_WETH_DAI) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_DAI;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_RPL) && (uint(TOLERANCE__PAIR_WETH_RPL) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_RPL_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_RPL;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_SWISE) && (uint(TOLERANCE__PAIR_WETH_SWISE) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_SWISE_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_SWISE;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_LDO) && (uint(TOLERANCE__PAIR_WETH_LDO) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_LDO_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_LDO;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_GMX) && (uint(TOLERANCE__PAIR_WETH_GMX) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_GMX_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_GMX;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_ARB) && (uint(TOLERANCE__PAIR_WETH_ARB) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_ARB_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_ARB;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_MKR) && (uint(TOLERANCE__PAIR_WETH_MKR) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_MKR_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_MKR;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_UNI) && (uint(TOLERANCE__PAIR_WETH_UNI) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_UNI_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_UNI;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_LINK) && (uint(TOLERANCE__PAIR_WETH_LINK) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_LINK_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_LINK;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_MNT) && (uint(TOLERANCE__PAIR_WETH_MNT) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_MNT_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_MNT;
        // #endif
        return __MACRO__MAPPING.TOLERANCE__DEFAULT;
    }

    receive() external payable {}
}
