// SPDX-License-Identifier: GPL-3.0-or-later
// Deployed with donations via Gitcoin GR9

pragma solidity 0.7.6;
pragma abicoder v2;

import './interfaces/ITwapFactory.sol';
import './interfaces/ITwapDelay.sol';
import './interfaces/ITwapPair.sol';
import './interfaces/ITwapOracleV3.sol';
import './interfaces/ITwapRelayer.sol';
import './interfaces/ITwapRelayerInitializable.sol';
import './interfaces/IWETH.sol';
import './libraries/SafeMath.sol';
import './libraries/Orders.sol';
import './libraries/TransferHelper.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol';
import './libraries/Macros.sol';

contract TwapRelayer is ITwapRelayer, ITwapRelayerInitializable {
    using SafeMath for uint256;

    uint256 private constant PRECISION = 10**18;
    address public constant FACTORY_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F    /*__MACRO__GLOBAL.FACTORY_ADDRESS*/; //prettier-ignore
    address public constant WETH_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F       /*__MACRO__GLOBAL.TOKEN_WETH_ADDRESS*/; //prettier-ignore
    address public constant DELAY_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F      /*__MACRO__GLOBAL.DELAY_ADDRESS*/; //prettier-ignore
    uint256 public constant EXECUTION_GAS_LIMIT = 0x0F0F0F                                  /*__MACRO__CONSTANT.EXECUTION_GAS_LIMIT*/; //prettier-ignore

    /*
     * DO NOT CHANGE THE BELOW STATE VARIABLES.
     * REMOVING, REORDERING OR INSERTING STATE VARIABLES WILL CAUSE STORAGE COLLISION.
     * NEW VARIABLES SHOULD BE ADDED BELOW THESE VARIABLES TO AVOID STORAGE COLLISION.
     */
    uint8 public initialized;
    uint8 private __RESERVED__OLD_LOCKED;
    address public override owner;
    address public __RESERVED__OLD_FACTORY;
    address public __RESERVED__OLD_WETH;
    address public __RESERVED__OLD_DELAY;
    uint256 public __RESERVED__OLD_ETH_TRANSFER_GAS_COST;
    uint256 public __RESERVED__OLD_EXECUTION_GAS_LIMIT;
    uint256 public __RESERVED__SLOT_6_USED_IN_PREVIOUS_VERSIONS;

    mapping(address => uint256) public override swapFee;
    mapping(address => uint32) public __RESERVED__OLD_TWAP_INTERVAL;
    mapping(address => bool) public override isPairEnabled;
    mapping(address => uint256) public __RESERVED__OLD_TOKEN_LIMIT_MIN;
    mapping(address => uint256) public __RESERVED__OLD_TOKEN_LIMIT_MAX_MULTIPLIER;
    mapping(address => uint16) public __RESERVED__OLD_TOLERANCE;

    address public override rebalancer;
    mapping(address => bool) public override isOneInchRouterWhitelisted;

    uint256 private locked;

    /*
     * DO NOT CHANGE THE ABOVE STATE VARIABLES.
     * REMOVING, REORDERING OR INSERTING STATE VARIABLES WILL CAUSE STORAGE COLLISION.
     * NEW VARIABLES SHOULD BE ADDED BELOW THESE VARIABLES TO AVOID STORAGE COLLISION.
     */

    modifier lock() {
        require(locked == 0, 'TR06');
        locked = 1;
        _;
        locked = 0;
    }

    // This contract implements a proxy pattern.
    // The constructor is to set to prevent abuse of this implementation contract.
    // Setting locked = 1 forces core features, e.g. buy(), to always revert.
    constructor() {
        owner = msg.sender;
        initialized = 1;
        locked = 1;
    }

    // This function should be called through the proxy contract to initialize the proxy contract's storage.
    function initialize() external override {
        require(initialized == 0, 'TR5B');

        initialized = 1;
        owner = msg.sender;

        emit Initialized(FACTORY_ADDRESS, DELAY_ADDRESS, WETH_ADDRESS);
        emit OwnerSet(msg.sender);
        _emitEventWithDefaults();
    }

    function setOwner(address _owner) external override {
        require(msg.sender == owner, 'TR00');
        require(_owner != owner, 'TR01');
        require(_owner != address(0), 'TR02');
        owner = _owner;
        emit OwnerSet(_owner);
    }

    function setSwapFee(address pair, uint256 fee) external override {
        require(msg.sender == owner, 'TR00');
        require(fee != swapFee[pair], 'TR01');
        swapFee[pair] = fee;
        emit SwapFeeSet(pair, fee);
    }

    function setPairEnabled(address pair, bool enabled) external override {
        require(msg.sender == owner, 'TR00');
        require(enabled != isPairEnabled[pair], 'TR01');
        isPairEnabled[pair] = enabled;
        emit PairEnabledSet(pair, enabled);
    }

    function setRebalancer(address _rebalancer) external override {
        require(msg.sender == owner, 'TR00');
        require(_rebalancer != rebalancer, 'TR01');
        require(_rebalancer != msg.sender, 'TR5D');
        rebalancer = _rebalancer;
        emit RebalancerSet(_rebalancer);
    }

    function whitelistOneInchRouter(address oneInchRouter, bool whitelisted) external override {
        require(msg.sender == owner, 'TR00');
        require(oneInchRouter != address(0), 'TR02');
        require(whitelisted != isOneInchRouterWhitelisted[oneInchRouter], 'TR01');
        isOneInchRouterWhitelisted[oneInchRouter] = whitelisted;
        emit OneInchRouterWhitelisted(oneInchRouter, whitelisted);
    }

    function sell(SellParams calldata sellParams) external payable override lock returns (uint256 orderId) {
        require(
            sellParams.to != sellParams.tokenIn && sellParams.to != sellParams.tokenOut && sellParams.to != address(0),
            'TR26'
        );
        // Duplicate checks in Orders.sell
        // require(sellParams.amountIn != 0, 'TR24');

        uint256 ethValue = calculatePrepay();

        if (sellParams.wrapUnwrap && sellParams.tokenIn == WETH_ADDRESS) {
            require(msg.value == sellParams.amountIn, 'TR59');
            ethValue = ethValue.add(msg.value);
        } else {
            require(msg.value == 0, 'TR58');
        }

        (uint256 amountIn, uint256 amountOut, uint256 fee) = swapExactIn(
            sellParams.tokenIn,
            sellParams.tokenOut,
            sellParams.amountIn,
            sellParams.wrapUnwrap,
            sellParams.to
        );
        require(amountOut >= sellParams.amountOutMin, 'TR37');

        orderId = ITwapDelay(DELAY_ADDRESS).relayerSell{ value: ethValue }(
            Orders.SellParams(
                sellParams.tokenIn,
                sellParams.tokenOut,
                amountIn,
                0, // Relax slippage constraints
                sellParams.wrapUnwrap,
                address(this),
                EXECUTION_GAS_LIMIT,
                sellParams.submitDeadline
            )
        );

        emit Sell(
            msg.sender,
            sellParams.tokenIn,
            sellParams.tokenOut,
            amountIn,
            amountOut,
            sellParams.amountOutMin,
            sellParams.wrapUnwrap,
            fee,
            sellParams.to,
            DELAY_ADDRESS,
            orderId
        );
    }

    function buy(BuyParams calldata buyParams) external payable override lock returns (uint256 orderId) {
        require(
            buyParams.to != buyParams.tokenIn && buyParams.to != buyParams.tokenOut && buyParams.to != address(0),
            'TR26'
        );
        // Duplicate checks in Orders.sell
        // require(buyParams.amountOut != 0, 'TR23');

        uint256 balanceBefore = address(this).balance.sub(msg.value);

        (uint256 amountIn, uint256 amountOut, uint256 fee) = swapExactOut(
            buyParams.tokenIn,
            buyParams.tokenOut,
            buyParams.amountOut,
            buyParams.wrapUnwrap,
            buyParams.to
        );
        require(amountIn <= buyParams.amountInMax, 'TR08');

        // Used to avoid the 'stack too deep' error.
        {
            bool wrapUnwrapWeth = buyParams.wrapUnwrap && buyParams.tokenIn == WETH_ADDRESS;
            uint256 prepay = calculatePrepay();
            uint256 ethValue = prepay;

            if (wrapUnwrapWeth) {
                require(msg.value >= amountIn, 'TR59');
                ethValue = ethValue.add(amountIn);
            } else {
                require(msg.value == 0, 'TR58');
            }

            orderId = ITwapDelay(DELAY_ADDRESS).relayerSell{ value: ethValue }(
                Orders.SellParams(
                    buyParams.tokenIn,
                    buyParams.tokenOut,
                    amountIn,
                    0, // Relax slippage constraints
                    buyParams.wrapUnwrap,
                    address(this),
                    EXECUTION_GAS_LIMIT,
                    buyParams.submitDeadline
                )
            );

            // refund remaining ETH
            if (wrapUnwrapWeth) {
                uint256 balanceAfter = address(this).balance + prepay;
                if (balanceAfter > balanceBefore) {
                    TransferHelper.safeTransferETH(
                        msg.sender,
                        balanceAfter - balanceBefore,
                        Orders.ETHER_TRANSFER_COST
                    );
                }
            }
        }

        emit Buy(
            msg.sender,
            buyParams.tokenIn,
            buyParams.tokenOut,
            amountIn,
            buyParams.amountInMax,
            amountOut,
            buyParams.wrapUnwrap,
            fee,
            buyParams.to,
            DELAY_ADDRESS,
            orderId
        );
    }

    function getPair(address tokenA, address tokenB) internal view returns (address pair, bool inverted) {
        inverted = tokenA > tokenB;
        pair = ITwapFactory(FACTORY_ADDRESS).getPair(tokenA, tokenB);

        require(pair != address(0), 'TR17');
    }

    function calculatePrepay() internal view returns (uint256) {
        return ITwapDelay(DELAY_ADDRESS).gasPrice().mul(EXECUTION_GAS_LIMIT);
    }

    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bool wrapUnwrap,
        address to
    )
        internal
        returns (
            uint256 _amountIn,
            uint256 _amountOut,
            uint256 fee
        )
    {
        (address pair, bool inverted) = getPair(tokenIn, tokenOut);
        require(isPairEnabled[pair], 'TR5A');

        _amountIn = transferIn(tokenIn, amountIn, wrapUnwrap);

        fee = _amountIn.mul(swapFee[pair]).div(PRECISION);
        uint256 calculatedAmountOut = calculateAmountOut(pair, inverted, _amountIn.sub(fee));
        _amountOut = transferOut(to, tokenOut, calculatedAmountOut, wrapUnwrap);

        require(_amountOut <= calculatedAmountOut.add(getTolerance(pair)), 'TR2E');
    }

    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        bool wrapUnwrap,
        address to
    )
        internal
        returns (
            uint256 _amountIn,
            uint256 _amountOut,
            uint256 fee
        )
    {
        (address pair, bool inverted) = getPair(tokenIn, tokenOut);
        require(isPairEnabled[pair], 'TR5A');

        _amountOut = transferOut(to, tokenOut, amountOut, wrapUnwrap);
        uint256 calculatedAmountIn = calculateAmountIn(pair, inverted, _amountOut);

        uint256 amountInPlusFee = calculatedAmountIn.mul(PRECISION).ceil_div(PRECISION.sub(swapFee[pair]));
        fee = amountInPlusFee.sub(calculatedAmountIn);
        _amountIn = transferIn(tokenIn, amountInPlusFee, wrapUnwrap);

        require(_amountIn >= amountInPlusFee.sub(getTolerance(pair)), 'TR2E');
    }

    function calculateAmountIn(
        address pair,
        bool inverted,
        uint256 amountOut
    ) internal view returns (uint256 amountIn) {
        (uint8 xDecimals, uint8 yDecimals, uint256 price) = getPriceByPairAddress(pair, inverted);
        uint256 decimalsConverter = getDecimalsConverter(xDecimals, yDecimals, inverted);
        amountIn = amountOut.mul(decimalsConverter).ceil_div(price);
    }

    function calculateAmountOut(
        address pair,
        bool inverted,
        uint256 amountIn
    ) internal view returns (uint256 amountOut) {
        (uint8 xDecimals, uint8 yDecimals, uint256 price) = getPriceByPairAddress(pair, inverted);
        uint256 decimalsConverter = getDecimalsConverter(xDecimals, yDecimals, inverted);
        amountOut = amountIn.mul(price).div(decimalsConverter);
    }

    function getDecimalsConverter(
        uint8 xDecimals,
        uint8 yDecimals,
        bool inverted
    ) internal pure returns (uint256 decimalsConverter) {
        decimalsConverter = 10**(18 + (inverted ? yDecimals - xDecimals : xDecimals - yDecimals));
    }

    function getPriceByPairAddress(address pair, bool inverted)
        public
        view
        override
        returns (
            uint8 xDecimals,
            uint8 yDecimals,
            uint256 price
        )
    {
        uint256 spotPrice;
        uint256 averagePrice;
        (spotPrice, averagePrice, xDecimals, yDecimals) = getPricesFromOracle(pair);

        if (inverted) {
            price = uint256(10**36).div(spotPrice > averagePrice ? spotPrice : averagePrice);
        } else {
            price = spotPrice < averagePrice ? spotPrice : averagePrice;
        }
    }

    function getPriceByTokenAddresses(address tokenIn, address tokenOut) public view override returns (uint256 price) {
        (address pair, bool inverted) = getPair(tokenIn, tokenOut);
        (, , price) = getPriceByPairAddress(pair, inverted);
    }

    function getPoolState(address token0, address token1)
        external
        view
        override
        returns (
            uint256 price,
            uint256 fee,
            uint256 limitMin0,
            uint256 limitMax0,
            uint256 limitMin1,
            uint256 limitMax1
        )
    {
        (address pair, ) = getPair(token0, token1);
        require(isPairEnabled[pair], 'TR5A');

        fee = swapFee[pair];

        price = getPriceByTokenAddresses(token0, token1);

        limitMin0 = getTokenLimitMin(token0);
        limitMax0 = IERC20(token0).balanceOf(address(this)).mul(getTokenLimitMaxMultiplier(token0)).div(PRECISION);
        limitMin1 = getTokenLimitMin(token1);
        limitMax1 = IERC20(token1).balanceOf(address(this)).mul(getTokenLimitMaxMultiplier(token1)).div(PRECISION);
    }

    function quoteSell(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 amountOut) {
        require(amountIn > 0, 'TR24');

        (address pair, bool inverted) = getPair(tokenIn, tokenOut);

        uint256 fee = amountIn.mul(swapFee[pair]).div(PRECISION);
        uint256 amountInMinusFee = amountIn.sub(fee);
        amountOut = calculateAmountOut(pair, inverted, amountInMinusFee);
        checkLimits(tokenOut, amountOut);
    }

    function quoteBuy(
        address tokenIn,
        address tokenOut,
        uint256 amountOut
    ) external view override returns (uint256 amountIn) {
        require(amountOut > 0, 'TR23');

        (address pair, bool inverted) = getPair(tokenIn, tokenOut);

        checkLimits(tokenOut, amountOut);
        uint256 calculatedAmountIn = calculateAmountIn(pair, inverted, amountOut);
        amountIn = calculatedAmountIn.mul(PRECISION).ceil_div(PRECISION.sub(swapFee[pair]));
    }

    function getPricesFromOracle(address pair)
        internal
        view
        returns (
            uint256 spotPrice,
            uint256 averagePrice,
            uint8 xDecimals,
            uint8 yDecimals
        )
    {
        ITwapOracleV3 oracle = ITwapOracleV3(ITwapPair(pair).oracle());

        xDecimals = oracle.xDecimals();
        yDecimals = oracle.yDecimals();

        spotPrice = oracle.getSpotPrice();

        address uniswapPair = oracle.uniswapPair();
        averagePrice = getAveragePrice(pair, uniswapPair, getDecimalsConverter(xDecimals, yDecimals, false));
    }

    function getAveragePrice(
        address pair,
        address uniswapPair,
        uint256 decimalsConverter
    ) internal view returns (uint256) {
        uint32 secondsAgo = getTwapInterval(pair);
        require(secondsAgo > 0, 'TR55');
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(uniswapPair).observe(secondsAgos);

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 arithmeticMeanTick = int24(tickCumulativesDelta / secondsAgo);
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % secondsAgo != 0)) --arithmeticMeanTick;

        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(arithmeticMeanTick);

        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            return FullMath.mulDiv(ratioX192, decimalsConverter, 2**192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 2**64);
            return FullMath.mulDiv(ratioX128, decimalsConverter, 2**128);
        }
    }

    function transferIn(
        address token,
        uint256 amount,
        bool wrap
    ) internal returns (uint256) {
        if (amount == 0) {
            return 0;
        }
        if (token == WETH_ADDRESS) {
            // eth is transferred directly to the delay in sell / buy function
            if (!wrap) {
                TransferHelper.safeTransferFrom(token, msg.sender, DELAY_ADDRESS, amount);
            }
            return amount;
        } else {
            uint256 balanceBefore = IERC20(token).balanceOf(DELAY_ADDRESS);
            TransferHelper.safeTransferFrom(token, msg.sender, DELAY_ADDRESS, amount);
            uint256 balanceAfter = IERC20(token).balanceOf(DELAY_ADDRESS);
            require(balanceAfter > balanceBefore, 'TR2C');
            return balanceAfter - balanceBefore;
        }
    }

    function transferOut(
        address to,
        address token,
        uint256 amount,
        bool unwrap
    ) internal returns (uint256) {
        if (amount == 0) {
            return 0;
        }
        checkLimits(token, amount);

        if (token == WETH_ADDRESS) {
            if (unwrap) {
                IWETH(token).withdraw(amount);
                TransferHelper.safeTransferETH(to, amount, Orders.ETHER_TRANSFER_COST);
            } else {
                TransferHelper.safeTransfer(token, to, amount);
            }
            return amount;
        } else {
            uint256 balanceBefore = IERC20(token).balanceOf(address(this));
            TransferHelper.safeTransfer(token, to, amount);
            uint256 balanceAfter = IERC20(token).balanceOf(address(this));
            require(balanceBefore > balanceAfter, 'TR2C');
            return balanceBefore - balanceAfter;
        }
    }

    function checkLimits(address token, uint256 amount) internal view {
        require(amount >= getTokenLimitMin(token), 'TR03');
        require(
            amount <= IERC20(token).balanceOf(address(this)).mul(getTokenLimitMaxMultiplier(token)).div(PRECISION),
            'TR3A'
        );
    }

    function approve(
        address token,
        uint256 amount,
        address to
    ) external override lock {
        require(msg.sender == owner, 'TR00');
        require(to != address(0), 'TR02');

        TransferHelper.safeApprove(token, to, amount);

        emit Approve(token, to, amount);
    }

    function withdraw(
        address token,
        uint256 amount,
        address to
    ) external override lock {
        require(msg.sender == owner, 'TR00');
        require(to != address(0), 'TR02');
        if (token == Orders.NATIVE_CURRENCY_SENTINEL) {
            TransferHelper.safeTransferETH(to, amount, Orders.ETHER_TRANSFER_COST);
        } else {
            TransferHelper.safeTransfer(token, to, amount);
        }
        emit Withdraw(token, to, amount);
    }

    function rebalanceSellWithDelay(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external override lock {
        require(msg.sender == rebalancer, 'TR00');

        uint256 delayOrderId = ITwapDelay(DELAY_ADDRESS).sell{ value: calculatePrepay() }(
            Orders.SellParams(
                tokenIn,
                tokenOut,
                amountIn,
                0, // Relax slippage constraints
                false, // Never wrap/unwrap
                address(this),
                EXECUTION_GAS_LIMIT,
                uint32(block.timestamp)
            )
        );

        emit RebalanceSellWithDelay(msg.sender, tokenIn, tokenOut, amountIn, delayOrderId);
    }

    function rebalanceSellWithOneInch(
        address tokenIn,
        uint256 amountIn,
        address oneInchRouter,
        uint256 _gas,
        bytes calldata data
    ) external override lock {
        require(msg.sender == rebalancer, 'TR00');
        require(isOneInchRouterWhitelisted[oneInchRouter], 'TR5F');

        TransferHelper.safeApprove(tokenIn, oneInchRouter, amountIn);

        (bool success, ) = oneInchRouter.call{ gas: _gas }(data);
        require(success, 'TR5E');

        emit Approve(tokenIn, oneInchRouter, amountIn);
        emit RebalanceSellWithOneInch(oneInchRouter, _gas, data);
    }

    // prettier-ignore
    function _emitEventWithDefaults() internal {
        emit DelaySet(DELAY_ADDRESS);
        emit EthTransferGasCostSet(Orders.ETHER_TRANSFER_COST);
        emit ExecutionGasLimitSet(EXECUTION_GAS_LIMIT);

        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_USDC)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_USDC);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_USDT)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_USDT);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_WBTC)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_WBTC);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_USDC_USDT)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_USDC_USDT);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_CVX)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_CVX);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_SUSHI)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_SUSHI);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_STETH)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_STETH);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_DAI)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_DAI);
        // #endif

        // #if defined(TOKEN_LIMIT_MIN__TOKEN_WETH)
        emit TokenLimitMinSet(__MACRO__GLOBAL.TOKEN_WETH_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_WETH);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_USDC)
        emit TokenLimitMinSet(__MACRO__GLOBAL.TOKEN_USDC_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_USDC);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_USDT)
        emit TokenLimitMinSet(__MACRO__GLOBAL.TOKEN_USDT_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_USDT);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_WBTC)
        emit TokenLimitMinSet(__MACRO__GLOBAL.TOKEN_WBTC_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_WBTC);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_CVX)
        emit TokenLimitMinSet(__MACRO__GLOBAL.TOKEN_CVX_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_CVX);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_SUSHI)
        emit TokenLimitMinSet(__MACRO__GLOBAL.TOKEN_SUSHI_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_SUSHI);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_STETH)
        emit TokenLimitMinSet(__MACRO__GLOBAL.TOKEN_STETH_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_STETH);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_DAI)
        emit TokenLimitMinSet(__MACRO__GLOBAL.TOKEN_DAI_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_DAI);
        // #endif

        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WETH)
        emit TokenLimitMaxMultiplierSet(__MACRO__GLOBAL.TOKEN_WETH_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WETH);
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDC)
        emit TokenLimitMaxMultiplierSet(__MACRO__GLOBAL.TOKEN_USDC_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDC);
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDT)
        emit TokenLimitMaxMultiplierSet(__MACRO__GLOBAL.TOKEN_USDT_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDT);
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WBTC)
        emit TokenLimitMaxMultiplierSet(__MACRO__GLOBAL.TOKEN_WBTC_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WBTC);
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_CVX)
        emit TokenLimitMaxMultiplierSet(__MACRO__GLOBAL.TOKEN_CVX_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_CVX);
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_SUSHI)
        emit TokenLimitMaxMultiplierSet(__MACRO__GLOBAL.TOKEN_SUSHI_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_SUSHI);
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_STETH)
        emit TokenLimitMaxMultiplierSet(__MACRO__GLOBAL.TOKEN_STETH_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_STETH);
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_DAI)
        emit TokenLimitMaxMultiplierSet(__MACRO__GLOBAL.TOKEN_DAI_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_DAI);
        // #endif

        // #if defined(TWAP_INTERVAL__PAIR_WETH_USDC)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_USDC);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_USDT)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_USDT);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_WBTC)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_WBTC);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_USDC_USDT)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_USDC_USDT);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_CVX)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_CVX);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_SUSHI)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_SUSHI);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_STETH)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_STETH);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_DAI)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_DAI);
        // #endif
    }

    // prettier-ignore
    // constant mapping for tolerance
    function getTolerance(address/* #if !bool(RELAYER_TOLERANCE) */ pair/* #endif */) public pure override returns (uint16) {
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_USDC) && (uint(RELAYER_TOLERANCE__PAIR_WETH_USDC) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_USDC;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_USDT) && (uint(RELAYER_TOLERANCE__PAIR_WETH_USDT) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_USDT;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_WBTC) && (uint(RELAYER_TOLERANCE__PAIR_WETH_WBTC) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_WBTC;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_USDC_USDT) && (uint(RELAYER_TOLERANCE__PAIR_USDC_USDT) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_USDC_USDT;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_CVX) && (uint(RELAYER_TOLERANCE__PAIR_WETH_CVX) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_CVX;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_SUSHI) && (uint(RELAYER_TOLERANCE__PAIR_WETH_SUSHI) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_SUSHI;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_STETH) && (uint(RELAYER_TOLERANCE__PAIR_WETH_STETH) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_STETH;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_DAI) && (uint(RELAYER_TOLERANCE__PAIR_WETH_DAI) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_DAI;
        // #endif
        return __MACRO__MAPPING.RELAYER_TOLERANCE__DEFAULT;
    }

    // prettier-ignore
    // constant mapping for tokenLimitMin
    function getTokenLimitMin(address/* #if !bool(TOKEN_LIMIT_MIN) */ token/* #endif */) public pure override returns (uint256) {
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_WETH) && (uint(TOKEN_LIMIT_MIN__TOKEN_WETH) != uint(TOKEN_LIMIT_MIN__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_WETH_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_WETH;
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_USDC) && (uint(TOKEN_LIMIT_MIN__TOKEN_USDC) != uint(TOKEN_LIMIT_MIN__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_USDC_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_USDC;
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_USDT) && (uint(TOKEN_LIMIT_MIN__TOKEN_USDT) != uint(TOKEN_LIMIT_MIN__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_USDT_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_USDT;
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_WBTC) && (uint(TOKEN_LIMIT_MIN__TOKEN_WBTC) != uint(TOKEN_LIMIT_MIN__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_WBTC_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_WBTC;
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_CVX) && (uint(TOKEN_LIMIT_MIN__TOKEN_CVX) != uint(TOKEN_LIMIT_MIN__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_CVX_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_CVX;
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_SUSHI) && (uint(TOKEN_LIMIT_MIN__TOKEN_SUSHI) != uint(TOKEN_LIMIT_MIN__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_SUSHI_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_SUSHI;
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_STETH) && (uint(TOKEN_LIMIT_MIN__TOKEN_STETH) != uint(TOKEN_LIMIT_MIN__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_STETH_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_STETH;
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_DAI) && (uint(TOKEN_LIMIT_MIN__TOKEN_DAI) != uint(TOKEN_LIMIT_MIN__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_DAI_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_DAI;
        // #endif
        return __MACRO__MAPPING.TOKEN_LIMIT_MIN__DEFAULT;
    }

    // prettier-ignore
    // constant mapping for tokenLimitMaxMultiplier
    function getTokenLimitMaxMultiplier(address/* #if !bool(TOKEN_LIMIT_MAX_MULTIPLIER) */ token/* #endif */) public pure override returns (uint256) {
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WETH) && (uint(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WETH) != uint(TOKEN_LIMIT_MAX_MULTIPLIER__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_WETH_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WETH;
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDC) && (uint(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDC) != uint(TOKEN_LIMIT_MAX_MULTIPLIER__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_USDC_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDC;
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDT) && (uint(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDT) != uint(TOKEN_LIMIT_MAX_MULTIPLIER__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_USDT_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDT;
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WBTC) && (uint(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WBTC) != uint(TOKEN_LIMIT_MAX_MULTIPLIER__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_WBTC_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WBTC;
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_CVX) && (uint(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_CVX) != uint(TOKEN_LIMIT_MAX_MULTIPLIER__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_CVX_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_CVX;
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_SUSHI) && (uint(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_SUSHI) != uint(TOKEN_LIMIT_MAX_MULTIPLIER__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_SUSHI_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_SUSHI;
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_STETH) && (uint(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_STETH) != uint(TOKEN_LIMIT_MAX_MULTIPLIER__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_STETH_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_STETH;
        // #endif
        // #if defined(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_DAI) && (uint(TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_DAI) != uint(TOKEN_LIMIT_MAX_MULTIPLIER__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_DAI_ADDRESS) return __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_DAI;
        // #endif
        return __MACRO__MAPPING.TOKEN_LIMIT_MAX_MULTIPLIER__DEFAULT;
    }

    // prettier-ignore
    // constant mapping for twapInterval
    function getTwapInterval(address/* #if !bool(TWAP_INTERVAL) */ pair/* #endif */) public pure override returns (uint32) {
        // #if defined(TWAP_INTERVAL__PAIR_WETH_USDC) && (uint(TWAP_INTERVAL__PAIR_WETH_USDC) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_USDC;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_USDT) && (uint(TWAP_INTERVAL__PAIR_WETH_USDT) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_USDT;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_WBTC) && (uint(TWAP_INTERVAL__PAIR_WETH_WBTC) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_WBTC;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_USDC_USDT) && (uint(TWAP_INTERVAL__PAIR_USDC_USDT) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_USDC_USDT;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_CVX) && (uint(TWAP_INTERVAL__PAIR_WETH_CVX) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_CVX;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_SUSHI) && (uint(TWAP_INTERVAL__PAIR_WETH_SUSHI) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_SUSHI;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_STETH) && (uint(TWAP_INTERVAL__PAIR_WETH_STETH) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_STETH;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_DAI) && (uint(TWAP_INTERVAL__PAIR_WETH_DAI) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_DAI;
        // #endif
        return __MACRO__MAPPING.TWAP_INTERVAL__DEFAULT;
    }

    /*
     * Methods for backward compatibility
     */

    function factory() external pure override returns (address) {
        return FACTORY_ADDRESS;
    }

    function delay() external pure override returns (address) {
        return DELAY_ADDRESS;
    }

    function weth() external pure override returns (address) {
        return WETH_ADDRESS;
    }

    function twapInterval(address pair) external pure override returns (uint32) {
        return getTwapInterval(pair);
    }

    function ethTransferGasCost() external pure override returns (uint256) {
        return Orders.ETHER_TRANSFER_COST;
    }

    function executionGasLimit() external pure override returns (uint256) {
        return EXECUTION_GAS_LIMIT;
    }

    function tokenLimitMin(address token) external pure override returns (uint256) {
        return getTokenLimitMin(token);
    }

    function tokenLimitMaxMultiplier(address token) external pure override returns (uint256) {
        return getTokenLimitMaxMultiplier(token);
    }

    function tolerance(address pair) external pure override returns (uint16) {
        return getTolerance(pair);
    }

    receive() external payable {}
}
