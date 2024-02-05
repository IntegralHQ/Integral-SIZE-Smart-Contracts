// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../TwapOracle.sol';
import '../interfaces/ITwapPair.sol';

contract TwapOracleTest is TwapOracle {
    constructor(uint8 _xDecimals, uint8 _yDecimals) TwapOracle(_xDecimals, _yDecimals) {}

    function testGetAveragePriceForNoTimeElapsed() external view returns (uint256) {
        (uint256 priceAccumulator, uint256 priceTimestamp) = getPriceInfo();
        return getAveragePrice(priceAccumulator, priceTimestamp);
    }

    function testEncodePriceInfo(
        uint256 priceAccumulator,
        uint32 priceTimestamp
    ) external view returns (bytes memory priceInfo, uint256 price) {
        // Copied from TwapDelay
        price = getAveragePrice(priceAccumulator, priceTimestamp);
        // Pack everything as 32 bytes / uint256 to simplify decoding
        priceInfo = abi.encode(price);
    }

    function testEncodeGivenPrice(uint256 price) external pure returns (bytes memory) {
        return abi.encode(price);
    }

    function testDecodePriceInfo(bytes calldata data) external pure returns (uint256 price) {
        return decodePriceInfo(data);
    }

    function testGetSwapAmount0InMax(
        uint256 swapFee,
        uint256 amount1Out,
        bytes calldata data
    ) external view returns (uint256 amount0In) {
        return getSwapAmount0InMax(swapFee, amount1Out, data);
    }

    function testGetSwapAmount0InMin(
        uint256 swapFee,
        uint256 amount1Out,
        bytes calldata data
    ) external view returns (uint256 amount0In) {
        return getSwapAmount0InMin(swapFee, amount1Out, data);
    }

    function testGetSwapAmount1InMax(
        uint256 swapFee,
        uint256 amount0Out,
        bytes calldata data
    ) external view returns (uint256 amount1In) {
        return getSwapAmount1InMax(swapFee, amount0Out, data);
    }

    function testGetSwapAmount1InMin(
        uint256 swapFee,
        uint256 amount0Out,
        bytes calldata data
    ) external view returns (uint256 amount1In) {
        return getSwapAmount1InMin(swapFee, amount0Out, data);
    }
}
