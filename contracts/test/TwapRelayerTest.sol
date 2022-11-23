// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '../TwapRelayer.sol';
import '../interfaces/ITwapPair.sol';

contract TwapRelayerTest is TwapRelayer {
    using SafeMath for uint256;

    uint256 private constant PRECISION = 10**18;

    constructor(
        address _factory,
        address _delay,
        address _weth
    ) TwapRelayer(_factory, _delay, _weth) {}

    function testSwapExactIn(
        address pair,
        bool inverted,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bool wrapUnwrap,
        address to
    )
        external
        returns (
            uint256 _amountIn,
            uint256 _amountOut,
            uint256 fee
        )
    {
        return swapExactIn(pair, inverted, tokenIn, tokenOut, amountIn, wrapUnwrap, to);
    }

    function testSwapExactOut(
        address pair,
        bool inverted,
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        bool wrapUnwrap,
        address to
    )
        external
        returns (
            uint256 _amountIn,
            uint256 _amountOut,
            uint256 fee
        )
    {
        return swapExactOut(pair, inverted, tokenIn, tokenOut, amountOut, wrapUnwrap, to);
    }

    function testGetAveragePrice(
        address pair,
        address uniswapPair,
        uint256 decimalsConverter
    ) external view returns (uint256) {
        return getAveragePrice(pair, uniswapPair, decimalsConverter);
    }
}
