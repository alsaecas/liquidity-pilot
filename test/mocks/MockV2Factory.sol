// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MockV2Pair } from "./MockV2Pair.sol";

contract MockV2Factory {
    mapping(address => mapping(address => address)) public getPair;

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB && getPair[tokenA][tokenB] == address(0), "INVALID_PAIR");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        pair = address(new MockV2Pair(token0, token1));
        getPair[tokenA][tokenB] = pair;
        getPair[tokenB][tokenA] = pair;
    }
}
