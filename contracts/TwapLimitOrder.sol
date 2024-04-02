// SPDX-License-Identifier: GPL-3.0-or-later
// Deployed with donations via Gitcoin GR9

pragma solidity 0.7.6;
pragma abicoder v2;

import './libraries/TokenShares.sol';
import './interfaces/ITwapLimitOrder.sol';
import './libraries/SafeMath.sol';
import './interfaces/ITwapOracle.sol';
import './interfaces/ITwapDelay.sol';

import '@uniswap/v3-core/contracts/libraries/FixedPoint96.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol';

contract TwapLimitOrder is ITwapLimitOrder {
    using SafeMath for uint256;
    using TokenShares for TokenShares.Data;

    uint256 private constant PRICE_TOLERANCE_PRECISION = 1000;

    uint32 private constant EXPIRATION_UPPER_LIMIT = 90 days;
    uint32 private constant EXPIRATION_LOWER_LIMIT = 30 minutes;

    uint256 private constant GAS_PRECISION = 10 ** 18;

    address public override owner;
    address public constant DELAY_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F      /*__MACRO__GLOBAL.DELAY_ADDRESS*/; //prettier-ignore
    uint256 public constant GAS_MULTIPLIER = 0x0F0F0F                                       /*__MACRO__CONSTANT.GAS_MULTIPLIER*/; //prettier-ignore
    uint256 public constant SECONDS_PER_BLOCK = 0x0F0F0F                                    /*__MACRO__CONSTANT.SECONDS_PER_BLOCK*/; //prettier-ignore

    uint256 public override newestOrderId;
    bool public override enqueueDisabled;

    TokenShares.Data internal tokenShares;

    mapping(address => bool) public override isPairEnabled;
    mapping(address => bool) public override isBot;
    mapping(uint256 => StoredOrder) private limitOrders;
    mapping(uint32 => PairInfo) private pairs;

    uint256 private locked = 1;

    constructor(address _bot) {
        owner = msg.sender;
        isBot[_bot] = true;
        emit OwnerSet(msg.sender);
        emit BotSet(_bot, true);
        _emitEventWithDefaults();
    }

    modifier lock() {
        require(locked == 1, 'TL06');
        locked = 2;
        _;
        locked = 1;
    }

    function factory() external pure override returns (address) {
        return Orders.FACTORY_ADDRESS;
    }

    function weth() external pure override returns (address) {
        return TokenShares.WETH_ADDRESS;
    }

    function gasPrice() public view override returns (uint256) {
        return ITwapDelay(DELAY_ADDRESS).gasPrice();
    }

    function maxGasLimit() external pure override returns (uint256) {
        return Orders.MAX_GAS_LIMIT;
    }

    function gasMultiplier() external pure override returns (uint256) {
        return GAS_MULTIPLIER;
    }

    function secondsPerBlock() external pure override returns (uint256) {
        return SECONDS_PER_BLOCK;
    }

    function getOrderStatus(uint256 orderId) external view override returns (LimitOrderStatus) {
        return limitOrders[orderId].status;
    }

    function getOrder(uint256 orderId) external view override returns (StoredOrder memory order) {
        require(limitOrders[orderId].status != LimitOrderStatus.NonExistent, 'TL62');
        return limitOrders[orderId];
    }

    function getDelayOrderId(uint256 orderId) external view override returns (uint256) {
        require(limitOrders[orderId].status != LimitOrderStatus.NonExistent, 'TL62');
        return limitOrders[orderId].delayOrderId;
    }

    function setOwner(address _owner) external override {
        require(msg.sender == owner, 'TL00');
        require(_owner != owner, 'TL01');
        require(_owner != address(0), 'TL02');
        owner = _owner;
        emit OwnerSet(_owner);
    }

    function setBot(address _bot, bool _isBot) external override {
        require(msg.sender == owner, 'TL00');
        require(_isBot != isBot[_bot], 'TL01');
        isBot[_bot] = _isBot;
        emit BotSet(_bot, _isBot);
    }

    function setPairEnabled(address pair, bool enabled) external override {
        require(msg.sender == owner, 'TL00');
        require(enabled != isPairEnabled[pair], 'TL01');
        isPairEnabled[pair] = enabled;
        emit PairEnabledSet(pair, enabled);
    }

    function setEnqueueDisabled(bool _enqueueDisabled) external override {
        require(msg.sender == owner, 'TL00');
        require(_enqueueDisabled != enqueueDisabled, 'TL01');
        enqueueDisabled = _enqueueDisabled;
        emit EnqueueDisabledSet(_enqueueDisabled);
    }

    function approve(address token, uint256 amount, address to) external override lock {
        require(msg.sender == owner, 'TL00');
        require(to != address(0), 'TL02');
        TransferHelper.safeApprove(token, to, amount);
        emit Approve(token, to, amount);
    }

    function shouldExecute(uint256 orderId) public virtual override returns (bool) {
        StoredOrder memory order = limitOrders[orderId];
        if (order.status == LimitOrderStatus.NonExistent) {
            return false;
        }
        (bool executable, ) = address(this).call(abi.encodeWithSelector(this._shouldExecute.selector, order));
        return executable;
    }

    function _shouldExecute(StoredOrder calldata order) external view {
        require(msg.sender == address(this), 'TL00');
        _validateOrder(order);
    }

    function isOrderExpired(uint256 orderId) external view override returns (bool) {
        require(limitOrders[orderId].status != LimitOrderStatus.NonExistent, 'TL62');
        return limitOrders[orderId].expiration < block.timestamp;
    }

    function sell(
        Orders.SellParams calldata sellParams,
        uint256 price,
        uint32 twapInterval
    ) external payable override returns (uint256 orderId) {
        return sellWithExpiration(sellParams, price, twapInterval, EXPIRATION_UPPER_LIMIT);
    }

    function buy(
        Orders.BuyParams calldata buyParams,
        uint256 price,
        uint32 twapInterval
    ) external payable override returns (uint256 orderId) {
        return buyWithExpiration(buyParams, price, twapInterval, EXPIRATION_UPPER_LIMIT);
    }

    function sellWithExpiration(
        Orders.SellParams calldata sellParams,
        uint256 price,
        uint32 twapInterval,
        uint32 expiration
    ) public payable override lock returns (uint256) {
        require(!enqueueDisabled, 'TL61');
        require(expiration >= EXPIRATION_LOWER_LIMIT, 'TL64');
        require(expiration <= EXPIRATION_UPPER_LIMIT, 'TL65');
        require(sellParams.tokens.length == 2, 'TL35');
        require(_isTwapIntervalValid(sellParams.tokens[0], sellParams.tokens[1], twapInterval), 'TL66');
        return _sellLimitOrder(sellParams, block.timestamp.add(expiration).toUint32(), twapInterval, price);
    }

    function buyWithExpiration(
        Orders.BuyParams calldata buyParams,
        uint256 price,
        uint32 twapInterval,
        uint32 expiration
    ) public payable override lock returns (uint256) {
        require(!enqueueDisabled, 'TL61');
        require(expiration >= EXPIRATION_LOWER_LIMIT, 'TL64');
        require(expiration <= EXPIRATION_UPPER_LIMIT, 'TL65');
        require(buyParams.tokens.length == 2, 'TL35');
        require(_isTwapIntervalValid(buyParams.tokens[0], buyParams.tokens[1], twapInterval), 'TL66');
        return _buyLimitOrder(buyParams, block.timestamp.add(expiration).toUint32(), twapInterval, price);
    }

    function executeOrders(uint256[] calldata orderIds) external override lock {
        require(isBot[msg.sender] || isBot[address(0)], 'TL00');
        uint256 len = orderIds.length;
        for (uint256 i; i < len; ++i) {
            uint256 orderId = orderIds[i];
            StoredOrder memory order = limitOrders[orderId];
            (bool executionSuccess, bytes memory data) = address(this).call{ gas: order.gasLimit }(
                abi.encodeWithSelector(this._executeOrder.selector, order, orderId, msg.sender)
            );
            emit OrderExecuted(orderId, executionSuccess, data);
        }
    }

    function _executeOrder(StoredOrder calldata order, uint256 orderId, address orderExecutor) external {
        uint256 gasStart = gasleft();
        require(msg.sender == address(this), 'TL00');
        _validateOrder(order);
        uint256 latestGasPrice = gasPrice();
        require(latestGasPrice <= order.gasPrice, 'TL60');
        (bool executionSuccess, bytes memory data) = address(this).call{ gas: order.gasLimit }(
            abi.encodeWithSelector(this._submitOrder.selector, order, orderId)
        );
        if (!executionSuccess) {
            (, address tokenIn, ) = _getPairInfo(order.pairId, order.inverted);
            if (!_refundToken(tokenIn, order.to, order.shares, order.wrapUnwrap, false)) {
                limitOrders[orderId].status = LimitOrderStatus.RefundFailed;
            } else {
                limitOrders[orderId].status = LimitOrderStatus.Failed;
            }
        }
        (uint256 gasUsed, uint256 leftOver) = _refundPrepaidGas(
            executionSuccess,
            latestGasPrice,
            order.gasLimit,
            order.gasPrice,
            gasStart,
            order.to,
            orderExecutor
        );
        emit OrderSubmitted(
            orderId,
            executionSuccess,
            limitOrders[orderId].delayOrderId,
            order.orderType,
            data,
            latestGasPrice,
            gasUsed,
            leftOver
        );
    }

    function _submitOrder(StoredOrder calldata order, uint256 orderId) external {
        require(msg.sender == address(this), 'TL00');

        uint256 delayOrderId;
        uint256 _gasPrice = gasPrice();
        uint256 value = _gasPrice.mul(order.gasLimit);
        (, address tokenIn, address tokenOut) = _getPairInfo(order.pairId, order.inverted);
        uint256 amountIn = tokenShares.sharesToAmount(tokenIn, order.shares, 0, order.to);
        address[] memory tokens = new address[](2);
        tokens[0] = tokenIn;
        tokens[1] = tokenOut;

        if (order.orderType == LimitOrderType.Buy) {
            delayOrderId = ITwapDelay(DELAY_ADDRESS).buy{ value: value }(
                Orders.BuyParams(
                    tokens,
                    amountIn,
                    order.amountOut,
                    false,
                    order.to,
                    order.gasLimit,
                    block.timestamp.add(order.submitDeadline).toUint32()
                )
            );
        } else {
            delayOrderId = ITwapDelay(DELAY_ADDRESS).sell{ value: value }(
                Orders.SellParams(
                    tokens,
                    amountIn,
                    order.amountOut,
                    false,
                    order.to,
                    order.gasLimit,
                    block.timestamp.add(order.submitDeadline).toUint32()
                )
            );
        }
        limitOrders[orderId].status = LimitOrderStatus.Submitted;
        limitOrders[orderId].delayOrderId = delayOrderId;
    }

    function retryRefund(uint256 orderId) external override lock {
        StoredOrder memory order = limitOrders[orderId];
        require(
            order.status == LimitOrderStatus.RefundFailed || order.status == LimitOrderStatus.RefundAndGasFailed,
            'TL21'
        );
        (bool success, ) = address(this).call(
            abi.encodeWithSelector(
                this._performRefund.selector,
                order,
                msg.sender,
                order.status == LimitOrderStatus.RefundAndGasFailed
            )
        );
        require(success, 'TL14');
        _forgetOrder(orderId);
    }

    function _transferRefundToken(address token, address to, uint256 share, bool unwrap) external {
        require(msg.sender == address(this), 'TL00');
        if (token == TokenShares.WETH_ADDRESS && unwrap) {
            uint256 amount = tokenShares.sharesToAmount(token, share, 0, to);
            IWETH(TokenShares.WETH_ADDRESS).withdraw(amount);
            TransferHelper.safeTransferETH(to, amount, Orders.getTransferGasCost(Orders.NATIVE_CURRENCY_SENTINEL));
        } else {
            TransferHelper.safeTransfer(token, to, tokenShares.sharesToAmount(token, share, 0, to));
        }
    }

    function cancelOrder(uint256 orderId) external override lock returns (bool) {
        StoredOrder memory order = limitOrders[orderId];
        require(isBot[msg.sender] || order.submitter == msg.sender, 'TL00');
        require(order.status == LimitOrderStatus.Waiting, 'TL52');
        (bool success, ) = address(this).call(
            abi.encodeWithSelector(this._performRefund.selector, order, msg.sender, true)
        );
        if (!success) {
            limitOrders[orderId].status = LimitOrderStatus.RefundAndGasFailed;
        } else {
            _forgetOrder(orderId);
        }
        emit OrderCancelled(orderId, success);
        return success;
    }

    function _performRefund(StoredOrder calldata order, address executor, bool shouldRefundPrepaidGas) external {
        require(msg.sender == address(this), 'TL00');
        (, address tokenIn, ) = _getPairInfo(order.pairId, order.inverted);

        bool canOwnerRefund = order.expiration < block.timestamp.sub(365 days) && executor == owner;
        address to = canOwnerRefund ? owner : order.to;

        require(_refundToken(tokenIn, to, order.shares, order.wrapUnwrap, true), 'TL14');
        if (shouldRefundPrepaidGas) {
            uint256 value = order.gasPrice.mul(order.gasLimit);
            require(_refundEth(payable(to), value), 'TL40');
        }
    }

    function _buyLimitOrder(
        Orders.BuyParams calldata buyParams,
        uint32 expiration,
        uint32 twapInterval,
        uint256 price
    ) internal returns (uint256 orderId) {
        require(buyParams.amountOut != 0, 'TL23');
        _checkOrderParams(
            buyParams.to,
            buyParams.gasLimit,
            buyParams.submitDeadline,
            expiration,
            Orders.BUY_ORDER_BASE_COST.add(
                Orders.getTransferGasCost(buyParams.tokens[0]).mul(GAS_MULTIPLIER).div(GAS_PRECISION)
            )
        );

        uint256 value = msg.value;
        // allocate gas refund
        if (buyParams.tokens[0] == TokenShares.WETH_ADDRESS && buyParams.wrapUnwrap) {
            value = value.sub(buyParams.amountInMax, 'TL1E');
        }

        uint256 _gasPrice = gasPrice();
        _allocateGasRefund(value, buyParams.gasLimit, _gasPrice);
        uint256 shares = tokenShares.amountToShares(buyParams.tokens[0], buyParams.amountInMax, buyParams.wrapUnwrap);
        (address pairAddress, uint32 pairId, bool inverted) = _getPair(buyParams.tokens[0], buyParams.tokens[1]);
        require(isPairEnabled[pairAddress], 'TL5A');
        StoredOrder memory buyOrder;
        buyOrder.orderType = LimitOrderType.Buy;
        buyOrder.status = LimitOrderStatus.Waiting;
        buyOrder.submitDeadline = buyParams.submitDeadline;
        buyOrder.expiration = expiration;
        buyOrder.gasLimit = buyParams.gasLimit.toUint32();
        buyOrder.gasPrice = _gasPrice.mul(GAS_MULTIPLIER).div(GAS_PRECISION);
        buyOrder.amountOut = buyParams.amountOut.toUint112();

        buyOrder.twapInterval = twapInterval;
        buyOrder.shares = shares;
        buyOrder.pairId = pairId;
        buyOrder.inverted = inverted;

        buyOrder.wrapUnwrap = buyParams.wrapUnwrap;
        buyOrder.to = buyParams.to;
        buyOrder.price = price;
        buyOrder.submitter = msg.sender;

        orderId = _enqueueOrder(buyOrder);
        emit BuyLimitOrderEnqueued(
            orderId,
            buyParams.amountInMax.toUint112(),
            buyOrder.amountOut,
            buyOrder.inverted,
            buyOrder.wrapUnwrap,
            buyOrder.pairId,
            GAS_MULTIPLIER.mul(buyOrder.gasLimit).div(GAS_PRECISION).toUint32(),
            buyOrder.gasPrice,
            buyOrder.expiration,
            buyOrder.twapInterval,
            buyOrder.submitter,
            buyOrder.to,
            buyOrder.price
        );
    }

    function _sellLimitOrder(
        Orders.SellParams calldata sellParams,
        uint32 expiration,
        uint32 twapInterval,
        uint256 price
    ) internal returns (uint256 orderId) {
        require(sellParams.amountIn != 0, 'TL24');
        _checkOrderParams(
            sellParams.to,
            sellParams.gasLimit,
            sellParams.submitDeadline,
            expiration,
            Orders.SELL_ORDER_BASE_COST.add(
                Orders.getTransferGasCost(sellParams.tokens[0]).mul(GAS_MULTIPLIER).div(GAS_PRECISION)
            )
        );

        uint256 value = msg.value;
        // allocate gas refund
        if (sellParams.tokens[0] == TokenShares.WETH_ADDRESS && sellParams.wrapUnwrap) {
            value = value.sub(sellParams.amountIn, 'TL1E');
        }

        uint256 _gasPrice = gasPrice();
        _allocateGasRefund(value, sellParams.gasLimit, _gasPrice);
        uint256 shares = tokenShares.amountToShares(sellParams.tokens[0], sellParams.amountIn, sellParams.wrapUnwrap);
        (address pairAddress, uint32 pairId, bool inverted) = _getPair(sellParams.tokens[0], sellParams.tokens[1]);
        require(isPairEnabled[pairAddress], 'TL5A');

        StoredOrder memory sellOrder;
        sellOrder.orderType = LimitOrderType.Sell;
        sellOrder.status = LimitOrderStatus.Waiting;
        sellOrder.submitDeadline = sellParams.submitDeadline;
        sellOrder.expiration = expiration;
        sellOrder.gasLimit = sellParams.gasLimit.toUint32();
        sellOrder.gasPrice = _gasPrice.mul(GAS_MULTIPLIER).div(GAS_PRECISION);
        sellOrder.amountOut = sellParams.amountOutMin.toUint112();

        sellOrder.twapInterval = twapInterval;
        sellOrder.shares = shares;
        sellOrder.pairId = pairId;
        sellOrder.inverted = inverted;

        sellOrder.wrapUnwrap = sellParams.wrapUnwrap;
        sellOrder.to = sellParams.to;
        sellOrder.price = price;
        sellOrder.submitter = msg.sender;

        orderId = _enqueueOrder(sellOrder);
        emit SellLimitOrderEnqueued(
            orderId,
            sellParams.amountIn.toUint112(),
            sellOrder.amountOut,
            sellOrder.inverted,
            sellOrder.wrapUnwrap,
            sellOrder.pairId,
            GAS_MULTIPLIER.mul(sellOrder.gasLimit).div(GAS_PRECISION).toUint32(),
            sellOrder.gasPrice,
            sellOrder.expiration,
            sellOrder.twapInterval,
            sellOrder.submitter,
            sellOrder.to,
            sellOrder.price
        );
    }

    function _enqueueOrder(StoredOrder memory order) internal returns (uint256) {
        ++newestOrderId;
        limitOrders[newestOrderId] = order;
        return newestOrderId;
    }

    function _validateOrder(StoredOrder memory order) internal view {
        require(order.expiration >= block.timestamp, 'TL04');
        require(order.status == LimitOrderStatus.Waiting, 'TL67');
        (address pairAddress, , ) = _getPairInfo(order.pairId, order.inverted);
        uint256 currentPrice = _getTwapPrice(pairAddress, order.twapInterval);
        if (order.inverted) {
            require(currentPrice <= _getPriceWithTolerance(order.price, pairAddress), 'TL63');
        } else {
            require(_getPriceWithTolerance(currentPrice, pairAddress) >= order.price, 'TL63');
        }
    }

    function _isTwapIntervalValid(
        address tokenIn,
        address tokenOut,
        uint32 twapInterval
    ) internal virtual returns (bool) {
        require(twapInterval > 0, 'TL56');

        uint256 desiredCardinality = (twapInterval - 1) / SECONDS_PER_BLOCK + 1;
        (address pairAddress, , ) = _getPair(tokenIn, tokenOut);
        address twapPairOracle = ITwapPair(pairAddress).oracle();
        address uniswapPair = ITwapOracle(twapPairOracle).uniswapPair();

        (
            ,
            ,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            ,

        ) = IUniswapV3Pool(uniswapPair).slot0();
        if (observationCardinalityNext < desiredCardinality) {
            return false;
        }
        (uint32 blockTimestamp, , , bool initialized) = IUniswapV3Pool(uniswapPair).observations(
            (observationIndex + 1) % observationCardinality
        );
        if (!initialized) (blockTimestamp, , , ) = IUniswapV3Pool(uniswapPair).observations(0);
        return block.timestamp.sub(twapInterval) >= blockTimestamp;
    }

    function _getTwapPrice(address pairAddress, uint32 twapInterval) internal view virtual returns (uint256) {
        address twapPairOracle = ITwapPair(pairAddress).oracle();
        address uniswapPair = ITwapOracle(twapPairOracle).uniswapPair();
        int256 decimalsConverter = ITwapOracle(twapPairOracle).decimalsConverter();

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapInterval;
        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(uniswapPair).observe(secondsAgos);

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 arithmeticMeanTick = int24(tickCumulativesDelta / twapInterval);
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % twapInterval != 0)) --arithmeticMeanTick;

        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(arithmeticMeanTick);

        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            return FullMath.mulDiv(ratioX192, uint256(decimalsConverter), 2 ** 192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 2 ** 64);
            return FullMath.mulDiv(ratioX128, uint256(decimalsConverter), 2 ** 128);
        }
    }

    function _forgetOrder(uint256 orderId) private {
        delete limitOrders[orderId];
    }

    function _getPriceWithTolerance(uint256 price, address pair) private pure returns (uint256) {
        return PRICE_TOLERANCE_PRECISION.add(getPriceTolerance(pair)).mul(price).div(PRICE_TOLERANCE_PRECISION);
    }

    function _checkOrderParams(
        address to,
        uint256 gasLimit,
        uint32 submitDeadline,
        uint32 expiration,
        uint256 minGasLimit
    ) private view {
        require(block.timestamp.add(submitDeadline).add(expiration) <= type(uint32).max, 'TL54');
        require(gasLimit <= Orders.MAX_GAS_LIMIT, 'TL3E');
        require(gasLimit >= minGasLimit, 'TL3D');
        require(to != address(0), 'TL26');
    }

    function _allocateGasRefund(
        uint256 value,
        uint256 gasLimit,
        uint256 _gasPrice
    ) private returns (uint256 futureFee) {
        futureFee = _gasPrice.mul(gasLimit).mul(GAS_MULTIPLIER).div(GAS_PRECISION);
        require(value >= futureFee, 'TL1E');
        if (value > futureFee) {
            TransferHelper.safeTransferETH(
                msg.sender,
                value.sub(futureFee),
                Orders.getTransferGasCost(Orders.NATIVE_CURRENCY_SENTINEL)
            );
        }
    }

    function _refundPrepaidGas(
        bool executionSuccess,
        uint256 latestGasPrice,
        uint32 gasLimit,
        uint256 gasPriceInOrder,
        uint256 gasStart,
        address to,
        address orderExecutor
    ) private returns (uint256 gasUsed, uint256 leftOver) {
        uint256 gasPrepayRemaining = executionSuccess
            ? (gasPriceInOrder.sub(latestGasPrice)).mul(gasLimit)
            : gasPriceInOrder.mul(gasLimit);

        gasUsed = gasStart.sub(gasleft()).add(Orders.REFUND_BASE_COST);
        uint256 actualRefund = Math.min(gasPrepayRemaining, gasUsed.mul(latestGasPrice));
        leftOver = gasPrepayRemaining.sub(actualRefund);
        require(_refundEth(payable(orderExecutor), actualRefund), 'TL40');
        _refundEth(payable(to), leftOver);
    }

    function _refundEth(address payable to, uint256 value) private returns (bool success) {
        if (value == 0) {
            return true;
        }
        success = TransferHelper.transferETH(to, value, Orders.getTransferGasCost(Orders.NATIVE_CURRENCY_SENTINEL));
        emit EthRefund(to, success, value);
    }

    function _refundToken(
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
        }(abi.encodeWithSelector(this._transferRefundToken.selector, token, to, share, unwrap));
        if (!success) {
            emit RefundFailed(to, token, share, data);
        }
        return success;
    }

    function _getPair(address tokenA, address tokenB) private returns (address pair, uint32 pairId, bool inverted) {
        inverted = tokenA > tokenB;
        pair = ITwapFactory(Orders.FACTORY_ADDRESS).getPair(tokenA, tokenB);
        require(pair != address(0), 'TL17');
        pairId = uint32(bytes4(keccak256(abi.encodePacked(pair))));
        if (pairs[pairId].pair == address(0)) {
            (address token0, address token1) = inverted ? (tokenB, tokenA) : (tokenA, tokenB);
            pairs[pairId] = PairInfo(pair, token0, token1);
        }
    }

    function _getPairInfo(
        uint32 pairId,
        bool inverted
    ) private view returns (address pair, address tokenIn, address tokenOut) {
        PairInfo storage info = pairs[pairId];
        pair = info.pair;
        (tokenIn, tokenOut) = inverted ? (info.token1, info.token0) : (info.token0, info.token1);
    }

    // prettier-ignore
    function _emitEventWithDefaults() internal {
        emit MaxGasLimitSet(Orders.MAX_GAS_LIMIT);
        emit DelaySet(DELAY_ADDRESS);
        emit FactorySet(Orders.FACTORY_ADDRESS);
        emit GasMultiplierSet(GAS_MULTIPLIER);
        emit SecondsPerBlockSet(SECONDS_PER_BLOCK);

        // #if defined(PRICE_TOLERANCE__PAIR_WETH_USDC)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_USDC);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_USDC_E)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_USDC_E);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_USDT)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_USDT);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_WBTC)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_WBTC);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_USDC_USDT)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_USDC_USDT);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_CVX)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_CVX);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_SUSHI)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_SUSHI);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_STETH)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_STETH);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_WSTETH)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_WSTETH_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_WSTETH);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_DAI)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_DAI);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_RPL)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_RPL_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_RPL);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_SWISE)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_SWISE_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_SWISE);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_LDO)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_LDO_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_LDO);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_GMX)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_GMX_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_GMX);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_ARB)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_ARB_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_ARB);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_MKR)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_MKR_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_MKR);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_UNI)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_UNI_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_UNI);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_LINK)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_LINK_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_LINK);
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_MNT)
        emit PriceToleranceSet(__MACRO__GLOBAL.PAIR_WETH_MNT_ADDRESS, __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_MNT);
        // #endif
    }

    // prettier-ignore
    // constant mapping for priceTolerance
    function getPriceTolerance(address/* #if !bool(PRICE_TOLERANCE) */ pair/* #endif */) public pure override returns (uint32 tolerance) {
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_USDC) && (uint(PRICE_TOLERANCE__PAIR_WETH_USDC) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_USDC;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_USDC_E) && (uint(PRICE_TOLERANCE__PAIR_WETH_USDC_E) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_USDC_E;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_USDT) && (uint(PRICE_TOLERANCE__PAIR_WETH_USDT) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_USDT;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_WBTC) && (uint(PRICE_TOLERANCE__PAIR_WETH_WBTC) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_WBTC;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_USDC_USDT) && (uint(PRICE_TOLERANCE__PAIR_USDC_USDT) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_USDC_USDT;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_CVX) && (uint(PRICE_TOLERANCE__PAIR_WETH_CVX) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_CVX;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_SUSHI) && (uint(PRICE_TOLERANCE__PAIR_WETH_SUSHI) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_SUSHI;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_STETH) && (uint(PRICE_TOLERANCE__PAIR_WETH_STETH) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_STETH;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_WSTETH) && (uint(PRICE_TOLERANCE__PAIR_WETH_WSTETH) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_WSTETH_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_WSTETH;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_DAI) && (uint(PRICE_TOLERANCE__PAIR_WETH_DAI) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_DAI;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_RPL) && (uint(PRICE_TOLERANCE__PAIR_WETH_RPL) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_RPL_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_RPL;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_SWISE) && (uint(PRICE_TOLERANCE__PAIR_WETH_SWISE) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_SWISE_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_SWISE;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_LDO) && (uint(PRICE_TOLERANCE__PAIR_WETH_LDO) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_LDO_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_LDO;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_GMX) && (uint(PRICE_TOLERANCE__PAIR_WETH_GMX) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_GMX_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_GMX;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_ARB) && (uint(PRICE_TOLERANCE__PAIR_WETH_ARB) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_ARB_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_ARB;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_MKR) && (uint(PRICE_TOLERANCE__PAIR_WETH_MKR) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_MKR_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_MKR;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_UNI) && (uint(PRICE_TOLERANCE__PAIR_WETH_UNI) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_UNI_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_UNI;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_LINK) && (uint(PRICE_TOLERANCE__PAIR_WETH_LINK) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_LINK_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_LINK;
        // #endif
        // #if defined(PRICE_TOLERANCE__PAIR_WETH_MNT) && (uint(PRICE_TOLERANCE__PAIR_WETH_MNT) != uint(PRICE_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_MNT_ADDRESS) return __MACRO__MAPPING.PRICE_TOLERANCE__PAIR_WETH_MNT;
        // #endif
        return __MACRO__MAPPING.PRICE_TOLERANCE__DEFAULT;
    }

    receive() external payable {}
}
