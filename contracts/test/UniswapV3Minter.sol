// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '../interfaces/IWETH.sol';
import '../libraries/TransferHelper.sol';

contract UniswapV3Minter is IUniswapV3MintCallback {
    struct MintCallbackData {
        address payer;
        address token0;
        address token1;
    }

    function uniswapV3MintCallback(
        uint256 amount0Owed,
        uint256 amount1Owed,
        bytes calldata data
    ) external override {
        MintCallbackData memory decoded = abi.decode(data, (MintCallbackData));
        if (amount0Owed > 0) pay(decoded.token0, decoded.payer, msg.sender, amount0Owed);
        if (amount1Owed > 0) pay(decoded.token1, decoded.payer, msg.sender, amount1Owed);
    }

    struct MintParams {
        address pool;
        address recipient;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }

    function mint(MintParams calldata params) external {
        IUniswapV3Pool pool = IUniswapV3Pool(params.pool);
        address token0 = pool.token0();
        address token1 = pool.token1();
        pool.mint(
            params.recipient,
            params.tickLower,
            params.tickUpper,
            params.liquidity,
            abi.encode(MintCallbackData({ token0: token0, token1: token1, payer: msg.sender }))
        );
    }

    function pay(
        address token,
        address payer,
        address recipient,
        uint256 value
    ) internal {
        if (payer == address(this)) {
            TransferHelper.safeTransfer(token, recipient, value);
        } else {
            TransferHelper.safeTransferFrom(token, payer, recipient, value);
        }
    }
}
