// SPDX-License-Identifier: GPL-3.0-or-later
// Deployed with donations via Gitcoin GR9

pragma solidity 0.7.6;
pragma abicoder v2;

import '../libraries/Orders.sol';

interface ITwapLimitOrder {
    event OwnerSet(address owner);
    event BotSet(address bot, bool isBot);
    event PairEnabledSet(address pair, bool enabled);
    event PriceToleranceSet(address pair, uint32 value);
    event DelaySet(address delay);
    event Approve(address token, address to, uint256 amount);
    event RefundFailed(address indexed to, address indexed token, uint256 amount, bytes data);
    event OrderSubmitted(
        uint256 indexed id,
        bool indexed success,
        uint256 indexed delayOrderId,
        ITwapLimitOrder.LimitOrderType orderType,
        bytes data,
        uint256 gasPrice,
        uint256 gasSpent,
        uint256 ethRefunded
    );
    event OrderExecuted(uint256 indexed id, bool indexed success, bytes data);
    event EthRefund(address indexed to, bool indexed success, uint256 value);
    event FactorySet(address factory);
    event MaxGasLimitSet(uint256 maxGasLimit);
    event EnqueueDisabledSet(bool enqueueDisabled);
    event SecondsPerBlockSet(uint256 blockTime);
    event GasMultiplierSet(uint256 multiplier);
    event OrderCancelled(uint256 indexed orderId, bool indexed success);

    event BuyLimitOrderEnqueued(
        uint256 indexed orderId,
        uint256 amountIn,
        uint112 amountOut,
        bool inverse,
        bool wrapUnwrap,
        uint32 pairId,
        uint32 gasLimit,
        uint256 gasPrice,
        uint32 expiration,
        uint32 twapInterval,
        address from,
        address to,
        uint256 price
    );

    event SellLimitOrderEnqueued(
        uint256 indexed orderId,
        uint256 amountIn,
        uint112 amountOut,
        bool inverse,
        bool wrapUnwrap,
        uint32 pairId,
        uint32 gasLimit,
        uint256 gasPrice,
        uint32 expiration,
        uint32 twapInterval,
        address from,
        address to,
        uint256 price
    );

    enum LimitOrderType {
        Empty,
        Sell,
        Buy
    }

    enum LimitOrderStatus {
        NonExistent,
        Waiting,
        Submitted,
        Failed,
        RefundFailed,
        RefundAndGasFailed
    }

    struct PairInfo {
        address pair;
        address token0;
        address token1;
    }

    struct StoredOrder {
        // slot 0
        LimitOrderType orderType;
        LimitOrderStatus status;
        uint32 submitDeadline;
        uint32 twapInterval;
        uint32 gasLimit;
        uint112 amountOut;
        bool wrapUnwrap;
        bool inverted;
        // slot 1
        uint256 shares;
        // slot 2
        uint32 pairId;
        uint32 expiration;
        address to;
        // slot 3
        address submitter;
        // slot 4
        uint256 price;
        // slot 5
        uint256 delayOrderId;
        // slot 6
        uint256 gasPrice;
    }

    function weth() external returns (address);

    function factory() external returns (address);

    function owner() external returns (address);

    function getPriceTolerance(address pair) external pure returns (uint32);

    function isPairEnabled(address pair) external view returns (bool);

    function gasMultiplier() external returns (uint256);

    function enqueueDisabled() external returns (bool);

    function secondsPerBlock() external returns (uint256);

    function setOwner(address _owner) external;

    function setPairEnabled(address pair, bool enabled) external;

    function isBot(address bot) external returns (bool);

    function setBot(address _bot, bool _isBot) external;

    function gasPrice() external returns (uint256);

    function newestOrderId() external returns (uint256);

    function maxGasLimit() external returns (uint256);

    function setEnqueueDisabled(bool _flag) external;

    function sell(
        Orders.SellParams memory sellParams,
        uint256 price,
        uint32 twapInterval
    ) external payable returns (uint256 orderId);

    function sellWithExpiration(
        Orders.SellParams memory sellParams,
        uint256 price,
        uint32 twapInterval,
        uint32 expiration
    ) external payable returns (uint256 orderId);

    function buy(
        Orders.BuyParams memory buyParams,
        uint256 price,
        uint32 twapInterval
    ) external payable returns (uint256 orderId);

    function buyWithExpiration(
        Orders.BuyParams memory buyParams,
        uint256 price,
        uint32 twapInterval,
        uint32 expiration
    ) external payable returns (uint256 orderId);

    function isOrderExpired(uint256 orderId) external view returns (bool);

    function cancelOrder(uint256 orderId) external returns (bool);

    function executeOrders(uint256[] calldata orderId) external;

    function retryRefund(uint256 orderId) external;

    function getOrderStatus(uint256 _orderId) external returns (LimitOrderStatus);

    function getOrder(uint256 orderId) external view returns (StoredOrder memory order);

    function getDelayOrderId(uint256 orderId) external view returns (uint256);

    function shouldExecute(uint256 orderId) external returns (bool);

    function approve(address token, uint256 amount, address to) external;
}
