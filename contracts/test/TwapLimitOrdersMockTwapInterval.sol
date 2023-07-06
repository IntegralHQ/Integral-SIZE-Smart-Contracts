// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '../TwapLimitOrder.sol';

contract TwapLimitOrderMockTwapInterval is TwapLimitOrder {
    // using LimitOrders for LimitOrders.Data;

    uint256 public twapPrice;

    constructor(
        address _delay,
        address _factory,
        address _weth,
        address _bot
    ) TwapLimitOrder(_delay, _factory, _weth, _bot) {}

    function setTwapPrice(uint256 _p) external {
        twapPrice = _p;
    }

    function _isTwapIntervalValid(
        address tokenIn,
        address tokenOut,
        uint32 twapInterval
    ) internal override returns (bool) {
        if (false) {
            return super._isTwapIntervalValid(tokenIn, tokenOut, twapInterval);
        }
        return true;
    }

    function _getTwapPrice(address pairAddress, uint32 twapInterval) internal view virtual override returns (uint256) {
        if (twapPrice > 0) {
            return twapPrice;
        } else {
            return super._getTwapPrice(pairAddress, twapInterval);
        }
    }
}
