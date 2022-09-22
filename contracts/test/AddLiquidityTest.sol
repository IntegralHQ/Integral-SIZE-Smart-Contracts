// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '../libraries/AddLiquidity.sol';

contract AddLiquidityTest {
    constructor() {}

    function addLiquidity(
        address pair,
        uint256 amount0Desired,
        uint256 amount1Desired
    )
        public
        view
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 swapToken
        )
    {
        return AddLiquidity.addLiquidity(pair, amount0Desired, amount1Desired);
    }
}
