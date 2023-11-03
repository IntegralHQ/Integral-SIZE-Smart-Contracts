// SPDX-License-Identifier: GPL-3.0-or-later
// Deployed with donations via Gitcoin GR9

pragma solidity 0.7.6;

library __MACRO__GLOBAL {
    address public constant PAIR_WETH_USDC_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant PAIR_WETH_USDT_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant PAIR_WETH_WBTC_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant PAIR_USDC_USDT_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant PAIR_WETH_CVX_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant PAIR_WETH_SUSHI_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant PAIR_WETH_STETH_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant PAIR_WETH_DAI_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;

    address public constant TOKEN_WETH_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant TOKEN_USDC_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant TOKEN_USDT_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant TOKEN_WBTC_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant TOKEN_CVX_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant TOKEN_SUSHI_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant TOKEN_STETH_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant TOKEN_DAI_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;

    address public constant FACTORY_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
    address public constant DELAY_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F;
}

library __MACRO__MAPPING {
    uint16 public constant TOLERANCE__DEFAULT = 0x0F0F;
    uint16 public constant TOLERANCE__PAIR_WETH_USDC = 0x0F0F;
    uint16 public constant TOLERANCE__PAIR_WETH_USDT = 0x0F0F;
    uint16 public constant TOLERANCE__PAIR_WETH_WBTC = 0x0F0F;
    uint16 public constant TOLERANCE__PAIR_USDC_USDT = 0x0F0F;
    uint16 public constant TOLERANCE__PAIR_WETH_CVX = 0x0F0F;
    uint16 public constant TOLERANCE__PAIR_WETH_SUSHI = 0x0F0F;
    uint16 public constant TOLERANCE__PAIR_WETH_STETH = 0x0F0F;
    uint16 public constant TOLERANCE__PAIR_WETH_DAI = 0x0F0F;

    uint16 public constant RELAYER_TOLERANCE__DEFAULT = 0x0F0F;
    uint16 public constant RELAYER_TOLERANCE__PAIR_WETH_USDC = 0x0F0F;
    uint16 public constant RELAYER_TOLERANCE__PAIR_WETH_USDT = 0x0F0F;
    uint16 public constant RELAYER_TOLERANCE__PAIR_WETH_WBTC = 0x0F0F;
    uint16 public constant RELAYER_TOLERANCE__PAIR_USDC_USDT = 0x0F0F;
    uint16 public constant RELAYER_TOLERANCE__PAIR_WETH_CVX = 0x0F0F;
    uint16 public constant RELAYER_TOLERANCE__PAIR_WETH_SUSHI = 0x0F0F;
    uint16 public constant RELAYER_TOLERANCE__PAIR_WETH_STETH = 0x0F0F;
    uint16 public constant RELAYER_TOLERANCE__PAIR_WETH_DAI = 0x0F0F;

    uint256 public constant TOKEN_LIMIT_MIN__DEFAULT = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MIN__TOKEN_WETH = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MIN__TOKEN_USDC = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MIN__TOKEN_USDT = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MIN__TOKEN_WBTC = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MIN__TOKEN_CVX = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MIN__TOKEN_SUSHI = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MIN__TOKEN_STETH = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MIN__TOKEN_DAI = 0x0F0F;

    uint256 public constant TOKEN_LIMIT_MAX_MULTIPLIER__DEFAULT = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WETH = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDC = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_USDT = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_WBTC = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_CVX = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_SUSHI = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_STETH = 0x0F0F;
    uint256 public constant TOKEN_LIMIT_MAX_MULTIPLIER__TOKEN_DAI = 0x0F0F;

    uint256 public constant TRANSFER_GAS_COST__DEFAULT = 0x0F0F;
    uint256 public constant TRANSFER_GAS_COST__TOKEN_WETH = 0x0F0F;
    uint256 public constant TRANSFER_GAS_COST__TOKEN_USDC = 0x0F0F;
    uint256 public constant TRANSFER_GAS_COST__TOKEN_USDT = 0x0F0F;
    uint256 public constant TRANSFER_GAS_COST__TOKEN_WBTC = 0x0F0F;
    uint256 public constant TRANSFER_GAS_COST__TOKEN_CVX = 0x0F0F;
    uint256 public constant TRANSFER_GAS_COST__TOKEN_SUSHI = 0x0F0F;
    uint256 public constant TRANSFER_GAS_COST__TOKEN_STETH = 0x0F0F;
    uint256 public constant TRANSFER_GAS_COST__TOKEN_DAI = 0x0F0F;

    uint32 public constant TWAP_INTERVAL__DEFAULT = 0x0F0F;
    uint32 public constant TWAP_INTERVAL__PAIR_WETH_USDC = 0x0F0F;
    uint32 public constant TWAP_INTERVAL__PAIR_WETH_USDT = 0x0F0F;
    uint32 public constant TWAP_INTERVAL__PAIR_WETH_WBTC = 0x0F0F;
    uint32 public constant TWAP_INTERVAL__PAIR_USDC_USDT = 0x0F0F;
    uint32 public constant TWAP_INTERVAL__PAIR_WETH_CVX = 0x0F0F;
    uint32 public constant TWAP_INTERVAL__PAIR_WETH_SUSHI = 0x0F0F;
    uint32 public constant TWAP_INTERVAL__PAIR_WETH_STETH = 0x0F0F;
    uint32 public constant TWAP_INTERVAL__PAIR_WETH_DAI = 0x0F0F;

    bool public constant IS_NON_REBASING__DEFAULT = false;
    bool public constant IS_NON_REBASING__TOKEN_WETH = false;
    bool public constant IS_NON_REBASING__TOKEN_USDC = false;
    bool public constant IS_NON_REBASING__TOKEN_USDT = false;
    bool public constant IS_NON_REBASING__TOKEN_WBTC = false;
    bool public constant IS_NON_REBASING__TOKEN_CVX = false;
    bool public constant IS_NON_REBASING__TOKEN_SUSHI = false;
    bool public constant IS_NON_REBASING__TOKEN_STETH = false;
    bool public constant IS_NON_REBASING__TOKEN_DAI = false;

    uint32 public constant PRICE_TOLERANCE__DEFAULT = 0x0F0F;
    uint32 public constant PRICE_TOLERANCE__PAIR_WETH_USDC = 0x0F0F;
    uint32 public constant PRICE_TOLERANCE__PAIR_WETH_USDT = 0x0F0F;
    uint32 public constant PRICE_TOLERANCE__PAIR_WETH_WBTC = 0x0F0F;
    uint32 public constant PRICE_TOLERANCE__PAIR_USDC_USDT = 0x0F0F;
    uint32 public constant PRICE_TOLERANCE__PAIR_WETH_CVX = 0x0F0F;
    uint32 public constant PRICE_TOLERANCE__PAIR_WETH_SUSHI = 0x0F0F;
    uint32 public constant PRICE_TOLERANCE__PAIR_WETH_STETH = 0x0F0F;
    uint32 public constant PRICE_TOLERANCE__PAIR_WETH_DAI = 0x0F0F;
}
