// SPDX-License-Identifier: GPL-3.0-or-later
// Deployed with donations via Gitcoin GR9

pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/ITwapOracle.sol';
import '../interfaces/ITwapPair.sol';
import '../interfaces/IWETH.sol';
import '../libraries/SafeMath.sol';
import '../libraries/Orders.sol';
import '../libraries/TokenShares.sol';
import '../libraries/AddLiquidity.sol';
import '../libraries/WithdrawHelper.sol';

library ExecutionHelper {
    using SafeMath for uint256;
    using TransferHelper for address;

    using Orders for Orders.Data;
    using TokenShares for TokenShares.Data;

    uint256 private constant ORDER_LIFESPAN = 48 hours;

    struct ExecuteBuySellParams {
        Orders.Order order;
        HopParams[] hopParams;
    }

    struct HopParams {
        uint256 amountIn;
        uint256 amountOut;
        uint256 swapFee;
        uint256 pairTolerance;
        bytes priceInfo;
        address pairAddress;
        address oracle;
        bool inverted;
    }

    function executeDeposit(
        Orders.Order calldata order,
        address pairAddress,
        uint16 pairTolerance,
        TokenShares.Data storage tokenShares
    ) external {
        require(order.validAfterTimestamp + ORDER_LIFESPAN >= block.timestamp, 'EH04');

        (uint256 amount0Left, uint256 amount1Left, uint256 swapToken) = _initialDeposit(
            order,
            pairAddress,
            tokenShares
        );

        if (order.swap && swapToken != 0) {
            (bytes memory data, ) = encodePriceInfo(pairAddress);
            if (amount0Left != 0 && swapToken == 1) {
                uint256 extraAmount1;
                (amount0Left, extraAmount1) = AddLiquidity.swapDeposit0(
                    pairAddress,
                    order.tokens[0],
                    amount0Left,
                    order.minSwapPrice,
                    pairTolerance,
                    data
                );
                amount1Left = amount1Left.add(extraAmount1);
            } else if (amount1Left != 0 && swapToken == 2) {
                uint256 extraAmount0;
                (extraAmount0, amount1Left) = AddLiquidity.swapDeposit1(
                    pairAddress,
                    order.tokens[1],
                    amount1Left,
                    order.maxSwapPrice,
                    pairTolerance,
                    data
                );
                amount0Left = amount0Left.add(extraAmount0);
            }
        }

        if (amount0Left != 0 && amount1Left != 0) {
            (amount0Left, amount1Left, ) = AddLiquidity.addLiquidityAndMint(
                pairAddress,
                order.to,
                order.tokens[0],
                order.tokens[1],
                amount0Left,
                amount1Left
            );
        }

        AddLiquidity._refundDeposit(order.to, order.tokens[0], order.tokens[1], amount0Left, amount1Left);
    }

    function _initialDeposit(
        Orders.Order calldata order,
        address pairAddress,
        TokenShares.Data storage tokenShares
    ) private returns (uint256 amount0Left, uint256 amount1Left, uint256 swapToken) {
        uint256 amount0Desired = tokenShares.sharesToAmount(
            order.tokens[0],
            order.value0,
            order.amountLimit0,
            order.to
        );
        uint256 amount1Desired = tokenShares.sharesToAmount(
            order.tokens[1],
            order.value1,
            order.amountLimit1,
            order.to
        );
        (amount0Left, amount1Left, swapToken) = AddLiquidity.addLiquidityAndMint(
            pairAddress,
            order.to,
            order.tokens[0],
            order.tokens[1],
            amount0Desired,
            amount1Desired
        );
    }

    function executeWithdraw(Orders.Order calldata order) external {
        require(order.validAfterTimestamp + ORDER_LIFESPAN >= block.timestamp, 'EH04');
        (address pairAddress, ) = Orders.getPair(order.tokens[0], order.tokens[1]);
        TransferHelper.safeTransfer(pairAddress, pairAddress, order.liquidity);
        uint256 wethAmount;
        uint256 amount0;
        uint256 amount1;
        if (
            order.unwrap && (order.tokens[0] == TokenShares.WETH_ADDRESS || order.tokens[1] == TokenShares.WETH_ADDRESS)
        ) {
            bool success;
            (success, wethAmount, amount0, amount1) = WithdrawHelper.withdrawAndUnwrap(
                order.tokens[0],
                order.tokens[1],
                pairAddress,
                TokenShares.WETH_ADDRESS,
                order.to,
                Orders.getTransferGasCost(Orders.NATIVE_CURRENCY_SENTINEL)
            );
            if (!success) {
                TokenShares.onUnwrapFailed(order.to, wethAmount);
            }
        } else {
            (amount0, amount1) = ITwapPair(pairAddress).burn(order.to);
        }
        require(amount0 >= order.value0 && amount1 >= order.value1, 'EH03');
    }

    function executeBuy(ExecuteBuySellParams memory orderParams, TokenShares.Data storage tokenShares) external {
        require(orderParams.order.validAfterTimestamp + ORDER_LIFESPAN >= block.timestamp, 'EH04');

        address tokenIn = orderParams.order.tokens[0];
        uint256 amountInMax = tokenShares.sharesToAmount(
            tokenIn,
            orderParams.order.value0,
            orderParams.order.amountLimit0,
            orderParams.order.to
        );

        HopParams memory hopParams = orderParams.hopParams[0];
        bool inverted = hopParams.inverted;
        uint256 amountIn;
        uint256 amountOut;
        uint256 reserveOut;
        {
            // scope for reserve out logic, avoids stack too deep errors
            (uint112 reserve0, uint112 reserve1) = ITwapPair(hopParams.pairAddress).getReserves();
            // subtract 1 to prevent reserve going to 0
            reserveOut = uint256(inverted ? reserve0 : reserve1).sub(1);
        }
        {
            // scope for partial fill logic, avoids stack too deep errors
            (amountIn, amountOut) = ITwapOracle(hopParams.oracle).getSwapAmountInMaxOut(
                inverted,
                hopParams.swapFee,
                orderParams.order.value1,
                hopParams.priceInfo
            );
            uint256 amountInMaxScaled;
            if (amountOut > reserveOut) {
                amountInMaxScaled = amountInMax.mul(reserveOut).ceil_div(orderParams.order.value1);
                (amountIn, amountOut) = ITwapOracle(hopParams.oracle).getSwapAmountInMinOut(
                    inverted,
                    hopParams.swapFee,
                    reserveOut,
                    hopParams.priceInfo
                );
            } else {
                amountInMaxScaled = amountInMax;
                amountOut = orderParams.order.value1; // Truncate to desired out
            }
            require(amountInMaxScaled >= amountIn, 'EH08');
            if (amountInMax > amountIn) {
                if (tokenIn == TokenShares.WETH_ADDRESS && orderParams.order.unwrap) {
                    forceEtherTransfer(orderParams.order.to, amountInMax - amountIn);
                } else {
                    TransferHelper.safeTransfer(tokenIn, orderParams.order.to, amountInMax - amountIn);
                }
            }
            TransferHelper.safeTransfer(tokenIn, hopParams.pairAddress, amountIn);
        }
        amountOut = amountOut.sub(hopParams.pairTolerance);
        uint256 amount0Out;
        uint256 amount1Out;
        if (inverted) {
            amount0Out = amountOut;
        } else {
            amount1Out = amountOut;
        }
        if (orderParams.order.tokens[1] == TokenShares.WETH_ADDRESS && orderParams.order.unwrap) {
            ITwapPair(hopParams.pairAddress).swap(amount0Out, amount1Out, address(this), hopParams.priceInfo);
            forceEtherTransfer(orderParams.order.to, amountOut);
        } else {
            ITwapPair(hopParams.pairAddress).swap(amount0Out, amount1Out, orderParams.order.to, hopParams.priceInfo);
        }
    }

    function executeMultihopBuy(
        ExecuteBuySellParams memory orderParams,
        TokenShares.Data storage tokenShares
    ) external {
        require(orderParams.order.validAfterTimestamp + ORDER_LIFESPAN >= block.timestamp, 'EH04');

        address tokenIn = orderParams.order.tokens[0];
        uint256 amountInMax = tokenShares.sharesToAmount(
            tokenIn,
            orderParams.order.value0,
            orderParams.order.amountLimit0,
            orderParams.order.to
        );

        // get input amount taking into account reserves
        uint256 desiredAmountOut = orderParams.order.value1;
        uint256 calculatedMaxAmountIn = _getMaxAmountIn(orderParams, desiredAmountOut);

        // get intermediate input and output amounts
        _populateIntermediateInAndOutAmounts(orderParams, calculatedMaxAmountIn);

        // check against amount max in
        uint256 lastHop = orderParams.hopParams.length - 1;
        uint256 amountOut = orderParams.hopParams[lastHop].amountOut;
        uint256 amountInMaxScaled = amountInMax.mul(amountOut).ceil_div(desiredAmountOut);
        require(amountInMaxScaled >= calculatedMaxAmountIn, 'EH08');

        // truncate to desired output amount in the last hop
        if (amountOut > desiredAmountOut) {
            orderParams.hopParams[lastHop].amountOut = desiredAmountOut;
        }

        // refund excess amount in
        if (amountInMax > calculatedMaxAmountIn) {
            if (tokenIn == TokenShares.WETH_ADDRESS && orderParams.order.unwrap) {
                forceEtherTransfer(orderParams.order.to, amountInMax - calculatedMaxAmountIn);
            } else {
                TransferHelper.safeTransfer(tokenIn, orderParams.order.to, amountInMax - calculatedMaxAmountIn);
            }
        }

        _swapTokens(orderParams);
    }

    function executeSell(ExecuteBuySellParams memory orderParams, TokenShares.Data storage tokenShares) external {
        require(orderParams.order.validAfterTimestamp + ORDER_LIFESPAN >= block.timestamp, 'EH04');

        uint256 amountOut = _executeSellHelper(orderParams, tokenShares);

        HopParams memory hopParams = orderParams.hopParams[0];
        uint256 amount0Out;
        uint256 amount1Out;
        if (hopParams.inverted) {
            amount0Out = amountOut;
        } else {
            amount1Out = amountOut;
        }
        if (orderParams.order.tokens[1] == TokenShares.WETH_ADDRESS && orderParams.order.unwrap) {
            ITwapPair(hopParams.pairAddress).swap(amount0Out, amount1Out, address(this), hopParams.priceInfo);
            forceEtherTransfer(orderParams.order.to, amountOut);
        } else {
            ITwapPair(hopParams.pairAddress).swap(amount0Out, amount1Out, orderParams.order.to, hopParams.priceInfo);
        }
    }

    function _executeSellHelper(
        ExecuteBuySellParams memory orderParams,
        TokenShares.Data storage tokenShares
    ) internal returns (uint256 amountOut) {
        HopParams memory hopParams = orderParams.hopParams[0];
        uint256 reserveOut;
        {
            // scope for determining reserve out, avoids stack too deep errors
            (uint112 reserve0, uint112 reserve1) = ITwapPair(hopParams.pairAddress).getReserves();
            // subtract 1 to prevent reserve going to 0
            reserveOut = uint256(hopParams.inverted ? reserve0 : reserve1).sub(1);
        }
        address tokenIn = orderParams.order.tokens[0];
        {
            // scope for calculations, avoids stack too deep errors
            uint256 amountIn = tokenShares.sharesToAmount(
                tokenIn,
                orderParams.order.value0,
                orderParams.order.amountLimit0,
                orderParams.order.to
            );
            amountOut = hopParams.inverted
                ? ITwapOracle(hopParams.oracle).getSwapAmount0Out(hopParams.swapFee, amountIn, hopParams.priceInfo)
                : ITwapOracle(hopParams.oracle).getSwapAmount1Out(hopParams.swapFee, amountIn, hopParams.priceInfo);

            uint256 amountOutMinScaled;
            if (amountOut > reserveOut) {
                amountOutMinScaled = orderParams.order.value1.mul(reserveOut).div(amountOut);
                uint256 _amountIn = amountIn;
                (amountIn, amountOut) = ITwapOracle(hopParams.oracle).getSwapAmountInMinOut(
                    hopParams.inverted,
                    hopParams.swapFee,
                    reserveOut,
                    hopParams.priceInfo
                );
                if (tokenIn == TokenShares.WETH_ADDRESS && orderParams.order.unwrap) {
                    forceEtherTransfer(orderParams.order.to, _amountIn.sub(amountIn));
                } else {
                    TransferHelper.safeTransfer(tokenIn, orderParams.order.to, _amountIn.sub(amountIn));
                }
            } else {
                amountOutMinScaled = orderParams.order.value1;
            }
            amountOut = amountOut.sub(hopParams.pairTolerance);
            require(amountOut >= amountOutMinScaled, 'EH37');
            TransferHelper.safeTransfer(tokenIn, hopParams.pairAddress, amountIn);
        }
    }

    function executeMultihopSell(
        ExecuteBuySellParams memory orderParams,
        TokenShares.Data storage tokenShares
    ) external {
        require(orderParams.order.validAfterTimestamp + ORDER_LIFESPAN >= block.timestamp, 'EH04');

        address tokenIn = orderParams.order.tokens[0];
        uint256 desiredAmountIn = tokenShares.sharesToAmount(
            tokenIn,
            orderParams.order.value0,
            orderParams.order.amountLimit0,
            orderParams.order.to
        );

        // get output amount ignoring reserves
        uint256 desiredAmountOut = _getDesiredAmountOut(orderParams, desiredAmountIn);

        // get input amount taking into account reserves
        uint256 calculatedMaxAmountIn = _getMaxAmountIn(orderParams, desiredAmountOut);
        if (calculatedMaxAmountIn > desiredAmountIn) {
            calculatedMaxAmountIn = desiredAmountIn; // truncate to desired input amount
        }

        // get intermediate input and output amounts
        _populateIntermediateInAndOutAmounts(orderParams, calculatedMaxAmountIn);

        // check against amount min out
        uint256 amountOut = orderParams.hopParams[orderParams.hopParams.length - 1].amountOut;
        uint256 amountOutMinScaled = orderParams.order.value1.mul(amountOut).div(desiredAmountOut);
        require(amountOut >= amountOutMinScaled, 'EH37');

        // refund excess amount in
        if (desiredAmountIn > calculatedMaxAmountIn) {
            if (tokenIn == TokenShares.WETH_ADDRESS && orderParams.order.unwrap) {
                forceEtherTransfer(orderParams.order.to, desiredAmountIn - calculatedMaxAmountIn);
            } else {
                TransferHelper.safeTransfer(tokenIn, orderParams.order.to, desiredAmountIn - calculatedMaxAmountIn);
            }
        }

        _swapTokens(orderParams);
    }

    function _swapTokens(ExecuteBuySellParams memory orderParams) internal {
        uint256 hops = orderParams.hopParams.length;
        uint256 lastHop = hops - 1;
        for (uint256 i; i < hops; ++i) {
            HopParams memory hopParams = orderParams.hopParams[i];

            TransferHelper.safeTransfer(orderParams.order.tokens[i], hopParams.pairAddress, hopParams.amountIn);

            uint256 amountOut = hopParams.amountOut.sub(hopParams.pairTolerance);
            uint256 amount0Out;
            uint256 amount1Out;
            if (hopParams.inverted) {
                amount0Out = amountOut;
            } else {
                amount1Out = amountOut;
            }
            if (i != lastHop) {
                ITwapPair(hopParams.pairAddress).swap(amount0Out, amount1Out, address(this), hopParams.priceInfo);
            } else {
                if (orderParams.order.tokens[i + 1] == TokenShares.WETH_ADDRESS && orderParams.order.unwrap) {
                    ITwapPair(hopParams.pairAddress).swap(amount0Out, amount1Out, address(this), hopParams.priceInfo);
                    forceEtherTransfer(orderParams.order.to, amountOut);
                } else {
                    ITwapPair(hopParams.pairAddress).swap(
                        amount0Out,
                        amount1Out,
                        orderParams.order.to,
                        hopParams.priceInfo
                    );
                }
            }
        }
    }

    function _getMaxAmountIn(
        ExecuteBuySellParams memory orderParams,
        uint256 desiredAmountOut
    ) internal view returns (uint256) {
        uint256 maxAmountIn = desiredAmountOut;
        for (uint256 i = orderParams.hopParams.length - 1; i != type(uint256).max; --i) {
            HopParams memory hopParams = orderParams.hopParams[i];
            (uint112 reserve0, uint112 reserve1) = ITwapPair(hopParams.pairAddress).getReserves();
            uint256 reserveOut = uint256(hopParams.inverted ? reserve0 : reserve1).sub(1);
            (uint256 amountIn, uint256 amountOut) = ITwapOracle(hopParams.oracle).getSwapAmountInMaxOut(
                hopParams.inverted,
                hopParams.swapFee,
                maxAmountIn,
                hopParams.priceInfo
            );

            if (amountOut > reserveOut) {
                (amountIn, amountOut) = ITwapOracle(hopParams.oracle).getSwapAmountInMinOut(
                    hopParams.inverted,
                    hopParams.swapFee,
                    reserveOut,
                    hopParams.priceInfo
                );
            }

            maxAmountIn = amountIn;
        }
        return maxAmountIn;
    }

    function _getDesiredAmountOut(
        ExecuteBuySellParams memory orderParams,
        uint256 desiredAmountIn
    ) internal view returns (uint256 desiredAmountOut) {
        desiredAmountOut = desiredAmountIn;
        uint256 hops = orderParams.hopParams.length;
        for (uint256 i; i < hops; ++i) {
            HopParams memory hopParams = orderParams.hopParams[i];
            desiredAmountOut = hopParams.inverted
                ? ITwapOracle(hopParams.oracle).getSwapAmount0Out(
                    hopParams.swapFee,
                    desiredAmountOut,
                    hopParams.priceInfo
                )
                : ITwapOracle(hopParams.oracle).getSwapAmount1Out(
                    hopParams.swapFee,
                    desiredAmountOut,
                    hopParams.priceInfo
                );
        }
    }

    function _populateIntermediateInAndOutAmounts(
        ExecuteBuySellParams memory orderParams,
        uint256 amountIn
    ) internal view {
        uint256 intermediateAmountIn = amountIn;
        uint256 hops = orderParams.hopParams.length;
        for (uint256 i; i < hops; ++i) {
            HopParams memory hopParams = orderParams.hopParams[i];
            uint256 amountOut = hopParams.inverted
                ? ITwapOracle(hopParams.oracle).getSwapAmount0Out(
                    hopParams.swapFee,
                    intermediateAmountIn,
                    hopParams.priceInfo
                )
                : ITwapOracle(hopParams.oracle).getSwapAmount1Out(
                    hopParams.swapFee,
                    intermediateAmountIn,
                    hopParams.priceInfo
                );

            hopParams.amountIn = intermediateAmountIn;
            hopParams.amountOut = amountOut;
            intermediateAmountIn = amountOut;
        }
    }

    function encodePriceInfo(address pairAddress) internal view returns (bytes memory data, address oracle) {
        oracle = ITwapPair(pairAddress).oracle();
        uint256 price = ITwapOracle(oracle).getAveragePrice(0, 0); // parameters to getAveragePrice unused
        // Pack everything as 32 bytes / uint256 to simplify decoding
        data = abi.encode(price);
    }

    function forceEtherTransfer(address to, uint256 amount) internal {
        IWETH(TokenShares.WETH_ADDRESS).withdraw(amount);
        (bool success, ) = to.call{ value: amount, gas: Orders.getTransferGasCost(Orders.NATIVE_CURRENCY_SENTINEL) }(
            ''
        );
        if (!success) {
            TokenShares.onUnwrapFailed(to, amount);
        }
    }
}
