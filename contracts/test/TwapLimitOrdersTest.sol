// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '../TwapLimitOrder.sol';

contract TwapLimitOrderTest is TwapLimitOrder {
    event ShouldExecuteEvent(bool indexed result);

    uint256 public twapPrice;

    constructor(address _bot) TwapLimitOrder(_bot) {}

    function setTwapPrice(uint256 _p) external {
        twapPrice = _p;
    }

    function shouldExecute(uint256 orderId) public override returns (bool) {
        bool executable = super.shouldExecute(orderId);
        emit ShouldExecuteEvent(executable);
        return executable;
    }

    function _getTwapPrice(address pairAddress, uint32 twapInterval) internal view virtual override returns (uint256) {
        if (twapPrice > 0) {
            return twapPrice;
        } else {
            return super._getTwapPrice(pairAddress, twapInterval);
        }
    }
}
