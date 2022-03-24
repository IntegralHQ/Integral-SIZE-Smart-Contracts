// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../libraries/SafeMath.sol';
import '../libraries/Math.sol';

contract SafeMathTest {
    using SafeMath for int256;

    function add(int256 a, int256 b) external pure returns (int256) {
        return a.add(b);
    }

    function sub(int256 a, int256 b) external pure returns (int256) {
        return a.sub(b);
    }
}
