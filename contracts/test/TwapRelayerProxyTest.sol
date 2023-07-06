// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '../Proxy.sol';

contract TwapRelayerProxyTest is Proxy {
    constructor(address _implementation) Proxy(_implementation) {}
}
