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
import './libraries/RelayerMacros.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol';
import './libraries/Macros.sol';

contract TwapRelayer is ITwapRelayer, ITwapRelayerInitializable {
    using SafeMath for uint256;

    uint256 private constant PRECISION = 10 ** 18;
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
    mapping(address => uint256) public __RESERVED__OLD_TOKEN_LIMIT_MAX;
    mapping(address => uint16) public __RESERVED__OLD_TOLERANCE;

    address public override rebalancer;
    mapping(address => bool) public override isOneInchRouterWhitelisted;

    uint256 private locked = 1;

    /*
     * DO NOT CHANGE THE ABOVE STATE VARIABLES.
     * REMOVING, REORDERING OR INSERTING STATE VARIABLES WILL CAUSE STORAGE COLLISION.
     * NEW VARIABLES SHOULD BE ADDED BELOW THESE VARIABLES TO AVOID STORAGE COLLISION.
     */

    modifier lock() {
        require(locked == 1, 'TR06');
        locked = 2;
        _;
        locked = 1;
    }

    // This contract implements a proxy pattern.
    // The constructor is to set to prevent abuse of this implementation contract.
    // Setting locked = 2 forces core features, e.g. buy(), to always revert.
    constructor() {
        owner = msg.sender;
        initialized = 1;
        locked = 2;
    }

    // This function should be called through the proxy contract to initialize the proxy contract's storage.
    function initialize() external override {
        require(initialized == 0, 'TR5B');

        initialized = 1;
        owner = msg.sender;
        locked = 1;

        emit Initialized(FACTORY_ADDRESS, DELAY_ADDRESS, WETH_ADDRESS);
        emit OwnerSet(msg.sender);
        _emitEventWithDefaults();
    }

    // This function should be called through the proxy contract to update lock
    function initializeLock() external {
        require(msg.sender == owner, 'TR00');
        require(locked == 0, 'TR5B');
        locked = 1;
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

        (uint256 amountIn, uint256 amountOut, uint256 fee, address[] memory tokens) = swapExactIn(
            sellParams.tokenIn,
            sellParams.tokenOut,
            sellParams.amountIn,
            sellParams.wrapUnwrap,
            sellParams.to
        );
        require(amountOut >= sellParams.amountOutMin, 'TR37');

        orderId = ITwapDelay(DELAY_ADDRESS).relayerSell{ value: ethValue }(
            Orders.SellParams(
                tokens,
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

        (uint256 amountIn, uint256 fee, address[] memory tokens) = swapExactOut(
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
                    tokens,
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
            buyParams.amountOut,
            buyParams.wrapUnwrap,
            fee,
            buyParams.to,
            DELAY_ADDRESS,
            orderId
        );
    }

    // prettier-ignore
    function getPath(address tokenIn, address tokenOut) public view returns (RelayerMacros.Node[] memory) {
        // #if `${NETWORK}` == 'test' && defined(PAIR_WETH_USDC_ADDRESS) && defined(PAIR_USDC_USDT_ADDRESS)
        if (tokenIn == __MACRO__GLOBAL.TOKEN_WETH_ADDRESS && tokenOut == __MACRO__GLOBAL.TOKEN_USDT_ADDRESS) {
            RelayerMacros.Node[] memory path = new RelayerMacros.Node[](2);
            path[0] = RelayerMacros.Node(
                __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN1_ADDRESS
            );
            path[1] = RelayerMacros.Node(
                __MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS,
                __MACRO__GLOBAL.PAIR_USDC_USDT_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_USDC_USDT_TOKEN1_ADDRESS
            );
            return path;
        }
        // #endif
        // #if `${NETWORK}` == 'test' && defined(PAIR_WETH_USDC_ADDRESS) && defined(PAIR_USDC_USDT_ADDRESS)
        if (tokenIn == __MACRO__GLOBAL.TOKEN_USDT_ADDRESS && tokenOut == __MACRO__GLOBAL.TOKEN_WETH_ADDRESS) {
            RelayerMacros.Node[] memory path = new RelayerMacros.Node[](2);
            path[0] = RelayerMacros.Node(
                __MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS,
                __MACRO__GLOBAL.PAIR_USDC_USDT_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_USDC_USDT_TOKEN1_ADDRESS
            );
            path[1] = RelayerMacros.Node(
                __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN1_ADDRESS
            );
            return path;
        }

        // #endif
        address pair = ITwapFactory(FACTORY_ADDRESS).getPair(tokenIn, tokenOut);
        if (pair != address(0)) {
            (address token0, address token1) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
            RelayerMacros.Node[] memory path = new RelayerMacros.Node[](1);
            path[0] = RelayerMacros.Node(pair, token0, token1);
            return path;
        }

        return RelayerMacros.getPath(tokenIn, tokenOut);
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
    ) internal returns (uint256 _amountIn, uint256 _amountOut, uint256 fee, address[] memory tokens) {
        RelayerMacros.Node[] memory path = getPath(tokenIn, tokenOut);

        uint256 delayBalanceAfter;
        (_amountIn, delayBalanceAfter) = transferIn(tokenIn, amountIn, wrapUnwrap);
        checkLimits(tokenIn, _amountIn, delayBalanceAfter);

        (_amountOut, fee, tokens) = _swapExactInHelper(path, tokenIn, tokenOut, _amountIn);

        transferOut(to, tokenOut, _amountOut, wrapUnwrap);
    }

    function _swapExactInHelper(
        RelayerMacros.Node[] memory path,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256 amountOut, uint256 fee, address[] memory tokens) {
        uint256 length = path.length;

        tokens = new address[](length + 1);
        if (length == 1) {
            address pair = path[0].pair;
            require(isPairEnabled[pair], 'TR5A');

            fee = amountIn.mul(swapFee[pair]).div(PRECISION);
            amountOut = calculateAmountOut(pair, path[0].token0 != tokenIn, amountIn.sub(fee));

            tokens[0] = tokenIn;
            tokens[1] = tokenOut;
        } else {
            fee = amountIn.mul(_computeFee(path)).div(PRECISION);

            bool inverted;
            amountOut = amountIn.sub(fee);
            for (uint256 i; i < length; ++i) {
                inverted = i == 0
                    ? path[i].token0 != tokenIn
                    : (path[i].token0 != (inverted ? path[i - 1].token0 : path[i - 1].token1));
                amountOut = calculateAmountOut(path[i].pair, inverted, amountOut);

                tokens[i] = inverted ? path[i].token1 : path[i].token0;
            }

            tokens[length] = tokenOut;
        }
    }

    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        bool wrapUnwrap,
        address to
    ) internal returns (uint256 _amountIn, uint256 fee, address[] memory tokens) {
        RelayerMacros.Node[] memory path = getPath(tokenIn, tokenOut);

        transferOut(to, tokenOut, amountOut, wrapUnwrap);

        uint256 amountIn;
        (amountIn, fee, tokens) = _swapExactOutHelper(path, tokenIn, tokenOut, amountOut);

        uint256 delayBalanceAfter;
        (_amountIn, delayBalanceAfter) = transferIn(tokenIn, amountIn, wrapUnwrap);
        checkLimits(tokenIn, _amountIn, delayBalanceAfter);

        require(_amountIn >= amountIn.sub(getTolerance(path[0].pair)), 'TR2E');
    }

    function _swapExactOutHelper(
        RelayerMacros.Node[] memory path,
        address tokenIn,
        address tokenOut,
        uint256 amountOut
    ) internal view returns (uint256 amountIn, uint256 fee, address[] memory tokens) {
        uint256 length = path.length;

        uint256 calculatedAmountIn;
        tokens = new address[](length + 1);
        if (length == 1) {
            address pair = path[0].pair;
            require(isPairEnabled[pair], 'TR5A');

            calculatedAmountIn = calculateAmountIn(pair, path[0].token0 != tokenIn, amountOut);

            amountIn = calculatedAmountIn.mul(PRECISION).ceil_div(PRECISION.sub(swapFee[pair]));

            tokens[0] = tokenIn;
            tokens[1] = tokenOut;
        } else {
            bool inverted;
            calculatedAmountIn = amountOut;
            uint256 lastIndex = length - 1;
            for (uint256 i = lastIndex; i != type(uint256).max; --i) {
                address pair = path[i].pair;
                require(isPairEnabled[pair], 'TR5A');

                if (i == lastIndex) {
                    fee = PRECISION.sub(swapFee[pair]);
                    inverted = path[i].token1 != tokenOut;
                } else {
                    fee = fee.mul(PRECISION.sub(swapFee[pair])).div(PRECISION);
                    inverted = (path[i].token1 != (inverted ? path[i + 1].token1 : path[i + 1].token0));
                }
                calculatedAmountIn = calculateAmountIn(pair, inverted, calculatedAmountIn);

                tokens[i + 1] = inverted ? path[i].token0 : path[i].token1;
            }

            amountIn = calculatedAmountIn.mul(PRECISION).ceil_div(fee);

            tokens[0] = tokenIn;
        }

        fee = amountIn.sub(calculatedAmountIn);
    }

    function calculateAmountIn(
        address pair,
        bool inverted,
        uint256 amountOut
    ) internal view returns (uint256 amountIn) {
        (uint8 xDecimals, uint8 yDecimals, uint256 price) = _getPriceByPairAddress(pair, inverted);
        uint256 decimalsConverter = getDecimalsConverter(xDecimals, yDecimals, inverted);
        amountIn = amountOut.mul(decimalsConverter).ceil_div(price);
    }

    function calculateAmountOut(
        address pair,
        bool inverted,
        uint256 amountIn
    ) internal view returns (uint256 amountOut) {
        (uint8 xDecimals, uint8 yDecimals, uint256 price) = _getPriceByPairAddress(pair, inverted);
        uint256 decimalsConverter = getDecimalsConverter(xDecimals, yDecimals, inverted);
        amountOut = amountIn.mul(price).div(decimalsConverter);
    }

    function getDecimalsConverter(
        uint8 xDecimals,
        uint8 yDecimals,
        bool inverted
    ) internal pure returns (uint256 decimalsConverter) {
        decimalsConverter = 10 ** (18 + (inverted ? yDecimals - xDecimals : xDecimals - yDecimals));
    }

    function getPriceByPairAddress(
        address pair,
        bool inverted
    ) external view override returns (uint8 xDecimals, uint8 yDecimals, uint256 price) {
        require(isPairEnabled[pair], 'TR5A');
        (xDecimals, yDecimals, price) = _getPriceByPairAddress(pair, inverted);
    }

    /**
     * @dev Ensure that the `pair` is enabled before invoking this function.
     */
    function _getPriceByPairAddress(
        address pair,
        bool inverted
    ) internal view returns (uint8 xDecimals, uint8 yDecimals, uint256 price) {
        uint256 spotPrice;
        uint256 averagePrice;
        (spotPrice, averagePrice, xDecimals, yDecimals) = getPricesFromOracle(pair);

        if (inverted) {
            price = uint256(10 ** 36).div(spotPrice > averagePrice ? spotPrice : averagePrice);
        } else {
            price = spotPrice < averagePrice ? spotPrice : averagePrice;
        }
    }

    function getPriceByTokenAddresses(
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256 price) {
        RelayerMacros.Node[] memory path = getPath(tokenIn, tokenOut);
        uint256 length = path.length;

        for (uint256 i; i < length; ++i) {
            require(isPairEnabled[path[i].pair], 'TR5A');
        }

        return _getPriceByTokenAddresses(tokenIn, path);
    }

    /**
     * @dev Ensure that the pair for 'tokenIn' and 'tokenOut' is enabled before invoking this function.
     */
    function _getPriceByTokenAddresses(
        address tokenIn,
        RelayerMacros.Node[] memory path
    ) internal view returns (uint256 price) {
        uint256 length = path.length;

        if (length == 1) {
            (, , price) = _getPriceByPairAddress(path[0].pair, path[0].token0 != tokenIn);
        } else {
            bool inverted;
            for (uint256 i; i < length; ++i) {
                if (i == 0) {
                    inverted = path[i].token0 != tokenIn;
                    (, , price) = _getPriceByPairAddress(path[i].pair, inverted);
                } else {
                    inverted = (path[i].token0 != (inverted ? path[i - 1].token0 : path[i - 1].token1));
                    uint256 _price;
                    (, , _price) = _getPriceByPairAddress(path[i].pair, inverted);
                    price = price.mul(_price).div(PRECISION);
                }
            }
        }
    }

    function isPathEnabled(address tokenIn, address tokenOut) external view override returns (bool) {
        (bool executionSuccess, bytes memory data) = address(this).staticcall(
            abi.encodeWithSelector(this.getPath.selector, tokenIn, tokenOut)
        );
        if (!executionSuccess) {
            return false;
        }

        RelayerMacros.Node[] memory path = abi.decode(data, (RelayerMacros.Node[]));
        uint256 length = path.length;

        for (uint256 i; i < length; ++i) {
            if (!isPairEnabled[path[i].pair]) {
                return false;
            }
        }

        return true;
    }

    function getPoolState(
        address token0,
        address token1
    )
        external
        view
        override
        returns (uint256 price, uint256 fee, uint256 limitMin0, uint256 limitMax0, uint256 limitMin1, uint256 limitMax1)
    {
        RelayerMacros.Node[] memory path = getPath(token0, token1);

        fee = _computeFee(path);

        price = _getPriceByTokenAddresses(token0, path);

        (limitMin0, limitMax0) = getTokenLimits(token0);
        if (limitMax0 != type(uint256).max) {
            uint256 balance = IERC20(token0).balanceOf(address(this)).add(IERC20(token0).balanceOf(DELAY_ADDRESS));
            limitMax0 = balance > limitMax0 ? 0 : limitMax0 - balance;
        }

        (limitMin1, limitMax1) = getTokenLimits(token1);
        if (limitMax1 != type(uint256).max) {
            uint256 balance = IERC20(token1).balanceOf(address(this)).add(IERC20(token1).balanceOf(DELAY_ADDRESS));
            limitMax1 = balance > limitMax1 ? 0 : limitMax1 - balance;
        }
    }

    function quoteSell(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 amountOut) {
        require(amountIn > 0, 'TR24');
        quoteCheckLimits(tokenIn, amountIn);

        RelayerMacros.Node[] memory path = getPath(tokenIn, tokenOut);
        (amountOut, , ) = _swapExactInHelper(path, tokenIn, tokenOut, amountIn);
    }

    function quoteBuy(
        address tokenIn,
        address tokenOut,
        uint256 amountOut
    ) external view override returns (uint256 amountIn) {
        require(amountOut > 0, 'TR23');

        RelayerMacros.Node[] memory path = getPath(tokenIn, tokenOut);
        (amountIn, , ) = _swapExactOutHelper(path, tokenIn, tokenOut, amountOut);
        quoteCheckLimits(tokenIn, amountIn);
    }

    function _computeFee(RelayerMacros.Node[] memory path) internal view returns (uint256 fee) {
        uint256 length = path.length;
        for (uint256 i; i < length; ++i) {
            address pair = path[i].pair;
            require(isPairEnabled[pair], 'TR5A');
            if (i == 0) {
                fee = PRECISION.sub(swapFee[pair]);
            } else {
                fee = fee.mul(PRECISION.sub(swapFee[pair])).div(PRECISION);
            }
        }
        fee = PRECISION.sub(fee);
    }

    function getPricesFromOracle(
        address pair
    ) internal view returns (uint256 spotPrice, uint256 averagePrice, uint8 xDecimals, uint8 yDecimals) {
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
            return FullMath.mulDiv(ratioX192, decimalsConverter, 2 ** 192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 2 ** 64);
            return FullMath.mulDiv(ratioX128, decimalsConverter, 2 ** 128);
        }
    }

    function transferIn(
        address token,
        uint256 amount,
        bool wrap
    ) internal returns (uint256 amountIn, uint256 delayBalanceAfter) {
        if (amount == 0) {
            delayBalanceAfter = IERC20(token).balanceOf(DELAY_ADDRESS);
            amountIn = 0;
        } else if (token == WETH_ADDRESS) {
            delayBalanceAfter = IERC20(token).balanceOf(DELAY_ADDRESS).add(amount);
            amountIn = amount;
            // eth is transferred directly to the delay in sell / buy function
            if (!wrap) {
                TransferHelper.safeTransferFrom(token, msg.sender, DELAY_ADDRESS, amount);
            }
        } else {
            uint256 delayBalanceBefore = IERC20(token).balanceOf(DELAY_ADDRESS);
            TransferHelper.safeTransferFrom(token, msg.sender, DELAY_ADDRESS, amount);
            delayBalanceAfter = IERC20(token).balanceOf(DELAY_ADDRESS);
            require(delayBalanceAfter > delayBalanceBefore, 'TR2C');
            amountIn = delayBalanceAfter - delayBalanceBefore;
        }
    }

    function transferOut(address to, address token, uint256 amount, bool unwrap) internal {
        if (amount > 0) {
            if (token == WETH_ADDRESS) {
                if (unwrap) {
                    IWETH(token).withdraw(amount);
                    TransferHelper.safeTransferETH(to, amount, Orders.ETHER_TRANSFER_COST);
                } else {
                    TransferHelper.safeTransfer(token, to, amount);
                }
            } else {
                TransferHelper.safeTransfer(token, to, amount);
            }
        }
    }

    function checkLimits(address tokenIn, uint256 amountIn, uint256 delayBalanceTokenIn) internal view {
        (uint256 min, uint256 max) = getTokenLimits(tokenIn);
        require(amountIn >= min, 'TR03');

        if (max != type(uint256).max) {
            uint256 balance = IERC20(tokenIn).balanceOf(address(this)).add(delayBalanceTokenIn);
            require(max >= balance, 'TR3A');
        }
    }

    function quoteCheckLimits(address tokenIn, uint256 amountIn) internal view {
        (uint256 min, uint256 max) = getTokenLimits(tokenIn);
        require(amountIn >= min, 'TR03');

        if (max != type(uint256).max) {
            uint256 balance = IERC20(tokenIn).balanceOf(address(this)).add(IERC20(tokenIn).balanceOf(DELAY_ADDRESS));
            require(max >= balance && amountIn <= max - balance, 'TR3A');
        }
    }

    function approve(address token, uint256 amount, address to) external override lock {
        require(msg.sender == owner, 'TR00');
        require(to != address(0), 'TR02');

        TransferHelper.safeApprove(token, to, amount);

        emit Approve(token, to, amount);
    }

    function withdraw(address token, uint256 amount, address to) external override lock {
        require(msg.sender == owner, 'TR00');
        require(to != address(0), 'TR02');
        if (token == Orders.NATIVE_CURRENCY_SENTINEL) {
            TransferHelper.safeTransferETH(to, amount, Orders.ETHER_TRANSFER_COST);
        } else {
            TransferHelper.safeTransfer(token, to, amount);
        }
        emit Withdraw(token, to, amount);
    }

    function rebalanceSellWithDelay(address tokenIn, address tokenOut, uint256 amountIn) external override lock {
        require(msg.sender == rebalancer, 'TR00');

        address[] memory tokens = new address[](2);
        tokens[0] = tokenIn;
        tokens[1] = tokenOut;

        uint256 delayOrderId = ITwapDelay(DELAY_ADDRESS).sell{ value: calculatePrepay() }(
            Orders.SellParams(
                tokens,
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

    function wrapEth(uint256 amount) external override lock {
        require(msg.sender == owner, 'TR00');
        IWETH(WETH_ADDRESS).deposit{ value: amount }();
        emit WrapEth(amount);
    }

    function unwrapWeth(uint256 amount) external override lock {
        require(msg.sender == owner, 'TR00');
        IWETH(WETH_ADDRESS).withdraw(amount);
        emit UnwrapWeth(amount);
    }

    function _emitEventWithDefaults() internal {
        emit DelaySet(DELAY_ADDRESS);
        emit ExecutionGasLimitSet(EXECUTION_GAS_LIMIT);

        RelayerMacros._emitEventWithDefaults();
    }

    // prettier-ignore
    // constant mapping for tolerance
    function getTolerance(address/* #if !bool(RELAYER_TOLERANCE) */ pair/* #endif */) public pure override returns (uint16) {
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_USDC) && (uint(RELAYER_TOLERANCE__PAIR_WETH_USDC) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_USDC;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_USDC_E) && (uint(RELAYER_TOLERANCE__PAIR_WETH_USDC_E) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_USDC_E;
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
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_WSTETH) && (uint(RELAYER_TOLERANCE__PAIR_WETH_WSTETH) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_WSTETH_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_WSTETH;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_DAI) && (uint(RELAYER_TOLERANCE__PAIR_WETH_DAI) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_DAI;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_RPL) && (uint(RELAYER_TOLERANCE__PAIR_WETH_RPL) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_RPL_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_RPL;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_SWISE) && (uint(RELAYER_TOLERANCE__PAIR_WETH_SWISE) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_SWISE_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_SWISE;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_LDO) && (uint(RELAYER_TOLERANCE__PAIR_WETH_LDO) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_LDO_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_LDO;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_GMX) && (uint(RELAYER_TOLERANCE__PAIR_WETH_GMX) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_GMX_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_GMX;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_ARB) && (uint(RELAYER_TOLERANCE__PAIR_WETH_ARB) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_ARB_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_ARB;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_MKR) && (uint(RELAYER_TOLERANCE__PAIR_WETH_MKR) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_MKR_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_MKR;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_UNI) && (uint(RELAYER_TOLERANCE__PAIR_WETH_UNI) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_UNI_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_UNI;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_LINK) && (uint(RELAYER_TOLERANCE__PAIR_WETH_LINK) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_LINK_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_LINK;
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_MNT) && (uint(RELAYER_TOLERANCE__PAIR_WETH_MNT) != uint(RELAYER_TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_MNT_ADDRESS) return __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_MNT;
        // #endif
        return __MACRO__MAPPING.RELAYER_TOLERANCE__DEFAULT;
    }

    // prettier-ignore
    // constant mapping for tokenLimits
    function getTokenLimits(address/* #if !bool(TOKEN_LIMITS) */ token/* #endif */) public pure override returns (uint256 min, uint256 max) {
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_WETH) && defined(TOKEN_LIMIT_MAX__TOKEN_WETH) && ((uint(TOKEN_LIMIT_MIN__TOKEN_WETH) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_WETH) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_WETH_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_WETH, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_WETH);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_USDC) && defined(TOKEN_LIMIT_MAX__TOKEN_USDC) && ((uint(TOKEN_LIMIT_MIN__TOKEN_USDC) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_USDC) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_USDC_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_USDC, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_USDC);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_USDC_E) && defined(TOKEN_LIMIT_MAX__TOKEN_USDC_E) && ((uint(TOKEN_LIMIT_MIN__TOKEN_USDC_E) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_USDC_E) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_USDC_E_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_USDC_E, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_USDC_E);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_USDT) && defined(TOKEN_LIMIT_MAX__TOKEN_USDT) && ((uint(TOKEN_LIMIT_MIN__TOKEN_USDT) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_USDT) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_USDT_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_USDT, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_USDT);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_WBTC) && defined(TOKEN_LIMIT_MAX__TOKEN_WBTC) && ((uint(TOKEN_LIMIT_MIN__TOKEN_WBTC) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_WBTC) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_WBTC_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_WBTC, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_WBTC);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_CVX) &&  defined(TOKEN_LIMIT_MAX__TOKEN_CVX) && ((uint(TOKEN_LIMIT_MIN__TOKEN_CVX) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_CVX) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_CVX_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_CVX, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_CVX);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_SUSHI) && defined(TOKEN_LIMIT_MAX__TOKEN_SUSHI) && ((uint(TOKEN_LIMIT_MIN__TOKEN_SUSHI) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_SUSHI) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_SUSHI_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_SUSHI. __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_SUSHI);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_STETH) && defined(TOKEN_LIMIT_MAX__TOKEN_STETH) && ((uint(TOKEN_LIMIT_MIN__TOKEN_STETH) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_STETH) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_STETH_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_STETH, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_STETH);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_WSTETH) && defined(TOKEN_LIMIT_MAX__TOKEN_WSTETH) && ((uint(TOKEN_LIMIT_MIN__TOKEN_WSTETH) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_WSTETH) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_WSTETH_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_WSTETH, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_WSTETH);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_DAI) && defined(TOKEN_LIMIT_MAX__TOKEN_DAI) && ((uint(TOKEN_LIMIT_MIN__TOKEN_DAI) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_DAI) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_DAI_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_DAI, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_DAI);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_RPL) && defined(TOKEN_LIMIT_MAX__TOKEN_RPL) && ((uint(TOKEN_LIMIT_MIN__TOKEN_RPL) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_RPL) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_RPL_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_RPL, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_RPL);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_SWISE) && defined(TOKEN_LIMIT_MAX__TOKEN_SWISE) && ((uint(TOKEN_LIMIT_MIN__TOKEN_SWISE) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_SWISE) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_SWISE_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_SWISE, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_SWISE);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_LDO) && defined(TOKEN_LIMIT_MAX__TOKEN_LDO) && ((uint(TOKEN_LIMIT_MIN__TOKEN_LDO) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_LDO) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_LDO_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_LDO, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_LDO);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_GMX) && defined(TOKEN_LIMIT_MAX__TOKEN_GMX) && ((uint(TOKEN_LIMIT_MIN__TOKEN_GMX) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_GMX) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_GMX_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_GMX, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_GMX);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_ARB) && defined(TOKEN_LIMIT_MAX__TOKEN_ARB) && ((uint(TOKEN_LIMIT_MIN__TOKEN_ARB) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_ARB) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_ARB_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_ARB, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_ARB);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_MKR) && defined(TOKEN_LIMIT_MAX__TOKEN_MKR) && ((uint(TOKEN_LIMIT_MIN__TOKEN_MKR) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_MKR) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_MKR_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_MKR, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_MKR);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_UNI) && defined(TOKEN_LIMIT_MAX__TOKEN_UNI) && ((uint(TOKEN_LIMIT_MIN__TOKEN_UNI) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_UNI) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_UNI_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_UNI, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_UNI);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_LINK) && defined(TOKEN_LIMIT_MAX__TOKEN_LINK) && ((uint(TOKEN_LIMIT_MIN__TOKEN_LINK) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_LINK) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_LINK_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_LINK, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_LINK);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_MNT) && defined(TOKEN_LIMIT_MAX__TOKEN_MNT) && ((uint(TOKEN_LIMIT_MIN__TOKEN_MNT) != uint(TOKEN_LIMIT_MIN__DEFAULT)) || (uint(TOKEN_LIMIT_MAX__TOKEN_MNT) != uint(TOKEN_LIMIT_MAX__DEFAULT)))
        if (token == __MACRO__GLOBAL.TOKEN_MNT_ADDRESS) return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_MNT, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_MNT);
        // #endif
        return (__MACRO__MAPPING.TOKEN_LIMIT_MIN__DEFAULT, __MACRO__MAPPING.TOKEN_LIMIT_MAX__DEFAULT);
    }

    // prettier-ignore
    // constant mapping for twapInterval
    function getTwapInterval(address/* #if !bool(TWAP_INTERVAL) */ pair/* #endif */) public pure override returns (uint32) {
        // #if defined(TWAP_INTERVAL__PAIR_WETH_USDC) && (uint(TWAP_INTERVAL__PAIR_WETH_USDC) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_USDC;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_USDC_E) && (uint(TWAP_INTERVAL__PAIR_WETH_USDC_E) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_USDC_E;
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
        // #if defined(TWAP_INTERVAL__PAIR_WETH_WSTETH) && (uint(TWAP_INTERVAL__PAIR_WETH_WSTETH) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_WSTETH_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_WSTETH;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_DAI) && (uint(TWAP_INTERVAL__PAIR_WETH_DAI) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_DAI;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_RPL) && (uint(TWAP_INTERVAL__PAIR_WETH_RPL) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_RPL_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_RPL;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_SWISE) && (uint(TWAP_INTERVAL__PAIR_WETH_SWISE) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_SWISE_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_SWISE;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_LDO) && (uint(TWAP_INTERVAL__PAIR_WETH_LDO) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_LDO_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_LDO;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_GMX) && (uint(TWAP_INTERVAL__PAIR_WETH_GMX) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_GMX_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_GMX;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_ARB) && (uint(TWAP_INTERVAL__PAIR_WETH_ARB) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_ARB_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_ARB;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_MKR) && (uint(TWAP_INTERVAL__PAIR_WETH_MKR) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_MKR_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_MKR;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_UNI) && (uint(TWAP_INTERVAL__PAIR_WETH_UNI) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_UNI_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_UNI;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_LINK) && (uint(TWAP_INTERVAL__PAIR_WETH_LINK) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_LINK_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_LINK;
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_MNT) && (uint(TWAP_INTERVAL__PAIR_WETH_MNT) != uint(TWAP_INTERVAL__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_MNT_ADDRESS) return __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_MNT;
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

    function tolerance(address pair) external pure override returns (uint16) {
        return getTolerance(pair);
    }

    receive() external payable {}
}
