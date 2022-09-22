// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

library Debug {
    function debug(uint256 value) internal pure {
        revert(string(abi.encodePacked('Debug: ', uint_to_string(value))));
    }

    function debug(uint256 first, uint256 second) internal pure {
        revert(string(abi.encodePacked('Debug: ', uint_to_string(first), ', ', uint_to_string(second))));
    }

    function debug(int256 value) internal pure {
        if (value < 0) {
            revert(string(abi.encodePacked('Debug: -', uint_to_string(uint256(value * -1)))));
        }
        revert(string(abi.encodePacked('Debug: ', uint_to_string(uint256(value)))));
    }

    function debug(int256 first, int256 second) internal pure {
        string memory firstString;
        string memory secondString;

        if (first < 0) {
            firstString = string(abi.encodePacked('-', uint_to_string(uint256(first * -1))));
        } else {
            firstString = uint_to_string(uint256(first));
        }

        if (second < 0) {
            secondString = string(abi.encodePacked('-', uint_to_string(uint256(second * -1))));
        } else {
            secondString = uint_to_string(uint256(second));
        }

        revert(string(abi.encodePacked('Debug: ', firstString, ', ', secondString)));
    }

    function debug(bool value) internal pure {
        revert(value ? 'Debug: true' : 'Debug: false');
    }

    function debug(address value) internal pure {
        revert(string(abi.encodePacked('Debug: ', address_to_string(value))));
    }

    function uint_to_string(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return '0';
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            buffer[--digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function address_to_string(address value) public pure returns (string memory) {
        bytes memory data = abi.encodePacked(value);
        bytes memory alphabet = '0123456789abcdef';

        uint256 len = data.length;
        bytes memory str = new bytes(2 + len * 2);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i; i < len; ++i) {
            str[2 + i * 2] = alphabet[uint256(uint8(data[i] >> 4))];
            str[3 + i * 2] = alphabet[uint256(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }
}
