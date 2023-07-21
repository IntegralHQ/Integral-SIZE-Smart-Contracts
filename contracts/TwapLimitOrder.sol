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
    uint256 private constant DEFAULT_PRICE_TOLERANCE = 5;

    uint32 private constant EXPIRATION_UPPER_LIMIT = 90 days;
    uint32 private constant EXPIRATION_LOWER_LIMIT = 30 minutes;

    uint256 private constant DEFAULT_SECONDS_PER_BLOCK = 10 seconds;
    uint256 private constant DEFAULT_MAX_GAS_LIMIT = 5_000_000;
    uint256 private constant MAX_GAS_LIMIT_UPPER_BOUND = 10_000_000;
    uint256 private constant GAS_PRECISION = 10**18;
    uint256 private constant DEFAULT_GAS_MULTIPLIER = 2 * GAS_PRECISION;

    address public override owner;
    address public override delay;
    address public override factory;

    uint256 public override maxGasLimit;
    uint256 public override newestOrderId;
    uint256 public override gasMultiplier;
    uint256 public override secondsPerBlock;
    bool public override enqueueDisabled;

    TokenShares.Data internal tokenShares;

    mapping(address => bool) public override isBot;
    mapping(address => uint32) public override priceTolerance;
    mapping(uint256 => StoredOrder) private limitOrders;
    mapping(uint32 => PairInfo) private pairs;

    uint256 private locked;

    constructor(
        address _delay,
        address _factory,
        address _weth,
        address _bot
    ) {
        require(_delay != address(0) && _factory != address(0) && _weth != address(0), 'TL02');
        owner = msg.sender;
        tokenShares.weth = _weth;
        isBot[_bot] = true;
        delay = _delay;
        factory = _factory;
        gasMultiplier = DEFAULT_GAS_MULTIPLIER;
        maxGasLimit = DEFAULT_MAX_GAS_LIMIT;
        secondsPerBlock = DEFAULT_SECONDS_PER_BLOCK;
        emit OwnerSet(msg.sender);
        emit DelaySet(_delay);
        emit FactorySet(_factory);
        emit MaxGasLimitSet(DEFAULT_MAX_GAS_LIMIT);
        emit BotSet(_bot, true);
        emit GasMultiplierSet(gasMultiplier);
        emit SecondsPerBlockSet(secondsPerBlock);
    }

    modifier lock() {
        require(locked == 0, 'TL06');
        locked = 1;
        _;
        locked = 0;
    }

    function weth() external view override returns (address) {
        return tokenShares.weth;
    }

    function gasPrice() public view override returns (uint256) {
        return ITwapDelay(delay).gasPrice();
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

    function setSecondsPerBlock(uint256 _secondsPerBlock) external override {
        require(msg.sender == owner, 'TL00');
        require(_secondsPerBlock != secondsPerBlock, 'TL01');
        secondsPerBlock = _secondsPerBlock;
        emit SecondsPerBlockSet(_secondsPerBlock);
    }

    function setGasMultiplier(uint256 _gasMultiplier) external override {
        require(msg.sender == owner, 'TL00');
        require(_gasMultiplier != gasMultiplier, 'TL01');
        gasMultiplier = _gasMultiplier;
        emit GasMultiplierSet(_gasMultiplier);
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

    function setPriceTolerance(address _pair, uint32 _tolerance) external override {
        require(msg.sender == owner, 'TL00');
        require(_tolerance != priceTolerance[_pair], 'TL01');
        require(_tolerance <= PRICE_TOLERANCE_PRECISION, 'TL54');
        priceTolerance[_pair] = _tolerance;
        emit PriceToleranceSet(_pair, _tolerance);
    }

    function setMaxGasLimit(uint256 _maxGasLimit) external override {
        require(msg.sender == owner, 'TL00');
        require(_maxGasLimit != maxGasLimit, 'TL01');
        require(_maxGasLimit <= MAX_GAS_LIMIT_UPPER_BOUND, 'TL2B');
        maxGasLimit = _maxGasLimit;
        emit MaxGasLimitSet(_maxGasLimit);
    }

    function setEnqueueDisabled(bool _enqueueDisabled) external override {
        require(msg.sender == owner, 'TL00');
        require(_enqueueDisabled != enqueueDisabled, 'TL01');
        enqueueDisabled = _enqueueDisabled;
        emit EnqueueDisabledSet(_enqueueDisabled);
    }

    function approve(
        address token,
        uint256 amount,
        address to
    ) external override lock {
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
        require(_isTwapIntervalValid(sellParams.tokenIn, sellParams.tokenOut, twapInterval), 'TL66');
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
        require(_isTwapIntervalValid(buyParams.tokenIn, buyParams.tokenOut, twapInterval), 'TL66');
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

    function _executeOrder(
        StoredOrder calldata order,
        uint256 orderId,
        address orderExecutor
    ) external {
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
            if (!_refundToken(tokenIn, order.to, order.shares, order.wrapUnwrap)) {
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

        if (order.orderType == LimitOrderType.Buy) {
            delayOrderId = ITwapDelay(delay).buy{ value: value }(
                Orders.BuyParams(
                    tokenIn,
                    tokenOut,
                    amountIn,
                    order.amountOut,
                    false,
                    order.to,
                    order.gasLimit,
                    block.timestamp.add(order.submitDeadline).toUint32()
                )
            );
        } else {
            delayOrderId = ITwapDelay(delay).sell{ value: value }(
                Orders.SellParams(
                    tokenIn,
                    tokenOut,
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

    function _transferRefundToken(
        address token,
        address to,
        uint256 share,
        bool unwrap
    ) external {
        require(msg.sender == address(this), 'TL00');
        if (token == tokenShares.weth && unwrap) {
            uint256 amount = tokenShares.sharesToAmount(token, share, 0, to);
            IWETH(tokenShares.weth).withdraw(amount);
            TransferHelper.safeTransferETH(to, amount, ITwapDelay(delay).getTransferGasCost(address(0)));
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

    function _performRefund(
        StoredOrder calldata order,
        address executor,
        bool shouldRefundPrepaidGas
    ) external {
        require(msg.sender == address(this), 'TL00');
        (, address tokenIn, ) = _getPairInfo(order.pairId, order.inverted);

        bool canOwnerRefund = order.expiration < block.timestamp.sub(365 days) && executor == owner;
        address to = canOwnerRefund ? owner : order.to;

        require(_refundToken(tokenIn, to, order.shares, order.wrapUnwrap), 'TL14');
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
        uint256 tokenTransferCost = ITwapDelay(delay).getTransferGasCost(buyParams.tokenIn);
        require(tokenTransferCost != 0, 'TL0F');
        require(buyParams.amountOut != 0, 'TL23');
        _checkOrderParams(
            buyParams.to,
            buyParams.gasLimit,
            buyParams.submitDeadline,
            expiration,
            Orders.ORDER_BASE_COST.add(tokenTransferCost.mul(gasMultiplier).div(GAS_PRECISION))
        );

        uint256 value = msg.value;
        // allocate gas refund
        if (buyParams.tokenIn == tokenShares.weth && buyParams.wrapUnwrap) {
            value = value.sub(buyParams.amountInMax, 'TL1E');
        }

        uint256 _gasPrice = gasPrice();
        _allocateGasRefund(value, buyParams.gasLimit, _gasPrice);
        uint256 shares = tokenShares.amountToShares(buyParams.tokenIn, buyParams.amountInMax, buyParams.wrapUnwrap);
        (, uint32 pairId, bool inverted) = _getPair(buyParams.tokenIn, buyParams.tokenOut);

        StoredOrder memory buyOrder;
        buyOrder.orderType = LimitOrderType.Buy;
        buyOrder.status = LimitOrderStatus.Waiting;
        buyOrder.submitDeadline = buyParams.submitDeadline;
        buyOrder.expiration = expiration;
        buyOrder.gasLimit = buyParams.gasLimit.toUint32();
        buyOrder.gasPrice = _gasPrice.mul(gasMultiplier).div(GAS_PRECISION);
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
            buyParams.amountInMax,
            buyOrder.amountOut,
            buyOrder.inverted,
            buyOrder.wrapUnwrap,
            buyOrder.pairId,
            gasMultiplier.mul(buyOrder.gasLimit).div(GAS_PRECISION).toUint32(),
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
        uint256 tokenTransferCost = ITwapDelay(delay).getTransferGasCost(sellParams.tokenIn);
        require(tokenTransferCost != 0, 'TL0F');
        require(sellParams.amountIn != 0, 'TL24');
        _checkOrderParams(
            sellParams.to,
            sellParams.gasLimit,
            sellParams.submitDeadline,
            expiration,
            Orders.ORDER_BASE_COST.add(tokenTransferCost.mul(gasMultiplier).div(GAS_PRECISION))
        );

        uint256 value = msg.value;
        // allocate gas refund
        if (sellParams.tokenIn == tokenShares.weth && sellParams.wrapUnwrap) {
            value = value.sub(sellParams.amountIn, 'TL1E');
        }

        uint256 _gasPrice = gasPrice();
        _allocateGasRefund(value, sellParams.gasLimit, _gasPrice);
        uint256 shares = tokenShares.amountToShares(sellParams.tokenIn, sellParams.amountIn, sellParams.wrapUnwrap);
        (, uint32 pairId, bool inverted) = _getPair(sellParams.tokenIn, sellParams.tokenOut);

        StoredOrder memory sellOrder;
        sellOrder.orderType = LimitOrderType.Sell;
        sellOrder.status = LimitOrderStatus.Waiting;
        sellOrder.submitDeadline = sellParams.submitDeadline;
        sellOrder.expiration = expiration;
        sellOrder.gasLimit = sellParams.gasLimit.toUint32();
        sellOrder.gasPrice = _gasPrice.mul(gasMultiplier).div(GAS_PRECISION);
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
            sellParams.amountIn,
            sellOrder.amountOut,
            sellOrder.inverted,
            sellOrder.wrapUnwrap,
            sellOrder.pairId,
            gasMultiplier.mul(sellOrder.gasLimit).div(GAS_PRECISION).toUint32(),
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

        uint256 desiredCardinality = (twapInterval - 1) / secondsPerBlock + 1;
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
            return FullMath.mulDiv(ratioX192, uint256(decimalsConverter), 2**192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 2**64);
            return FullMath.mulDiv(ratioX128, uint256(decimalsConverter), 2**128);
        }
    }

    function _forgetOrder(uint256 orderId) private {
        delete limitOrders[orderId];
    }

    function _getPriceWithTolerance(uint256 price, address pair) private view returns (uint256) {
        uint256 tolerance = priceTolerance[pair] == 0 ? DEFAULT_PRICE_TOLERANCE : priceTolerance[pair];
        return PRICE_TOLERANCE_PRECISION.add(tolerance).mul(price).div(PRICE_TOLERANCE_PRECISION);
    }

    function _checkOrderParams(
        address to,
        uint256 gasLimit,
        uint32 submitDeadline,
        uint32 expiration,
        uint256 minGasLimit
    ) private view {
        require(block.timestamp.add(submitDeadline).add(expiration) <= type(uint32).max, 'TL54');
        require(gasLimit <= maxGasLimit, 'TL3E');
        require(gasLimit >= minGasLimit, 'TL3D');
        require(to != address(0), 'TL26');
    }

    function _allocateGasRefund(
        uint256 value,
        uint256 gasLimit,
        uint256 _gasPrice
    ) private returns (uint256 futureFee) {
        futureFee = _gasPrice.mul(gasLimit).mul(gasMultiplier).div(GAS_PRECISION);
        require(value >= futureFee, 'TL1E');
        if (value > futureFee) {
            TransferHelper.safeTransferETH(
                msg.sender,
                value.sub(futureFee),
                ITwapDelay(delay).getTransferGasCost(address(0))
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
        success = TransferHelper.transferETH(to, value, ITwapDelay(delay).getTransferGasCost(address(0)));
        emit EthRefund(to, success, value);
    }

    function _refundToken(
        address token,
        address to,
        uint256 share,
        bool unwrap
    ) private returns (bool) {
        if (share == 0) {
            return true;
        }
        (bool success, bytes memory data) = address(this).call{ gas: ITwapDelay(delay).getTransferGasCost(token) }(
            abi.encodeWithSelector(this._transferRefundToken.selector, token, to, share, unwrap)
        );
        if (!success) {
            emit RefundFailed(to, token, share, data);
        }
        return success;
    }

    function _getPair(address tokenA, address tokenB)
        private
        returns (
            address pair,
            uint32 pairId,
            bool inverted
        )
    {
        inverted = tokenA > tokenB;
        pair = ITwapFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), 'TL17');
        pairId = uint32(bytes4(keccak256(abi.encodePacked(pair))));
        if (pairs[pairId].pair == address(0)) {
            (address token0, address token1) = inverted ? (tokenB, tokenA) : (tokenA, tokenB);
            pairs[pairId] = PairInfo(pair, token0, token1);
        }
    }

    function _getPairInfo(uint32 pairId, bool inverted)
        private
        view
        returns (
            address pair,
            address tokenIn,
            address tokenOut
        )
    {
        PairInfo storage info = pairs[pairId];
        pair = info.pair;
        (tokenIn, tokenOut) = inverted ? (info.token1, info.token0) : (info.token0, info.token1);
    }

    receive() external payable {}
}
