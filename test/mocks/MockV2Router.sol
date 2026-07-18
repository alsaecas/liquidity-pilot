// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MockV2Factory } from "./MockV2Factory.sol";
import { MockV2Pair } from "./MockV2Pair.sol";

contract MockV2Router {
    using SafeERC20 for IERC20;

    MockV2Factory public immutable factory;
    uint256 public swapRateBps = 10_000;
    uint256 public liquidityUseBps = 10_000;

    constructor(address factory_) {
        factory = MockV2Factory(factory_);
    }

    function setSwapRateBps(uint256 bps) external {
        swapRateBps = bps;
    }

    function setLiquidityUseBps(uint256 bps) external {
        liquidityUseBps = bps;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 1; i < path.length; ++i) {
            amounts[i] = amounts[i - 1] * swapRateBps / 10_000;
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "EXPIRED");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 1; i < path.length; ++i) {
            amounts[i] = amounts[i - 1] * swapRateBps / 10_000;
        }
        uint256 output = amounts[amounts.length - 1];
        require(output >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(path[path.length - 1]).safeTransfer(to, output);
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(block.timestamp <= deadline, "EXPIRED");
        amountA = amountADesired * liquidityUseBps / 10_000;
        amountB = amountBDesired * liquidityUseBps / 10_000;
        require(amountA >= amountAMin && amountB >= amountBMin, "INSUFFICIENT_LIQUIDITY");
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
        liquidity = amountA < amountB ? amountA : amountB;
        MockV2Pair(factory.getPair(tokenA, tokenB)).mint(to, liquidity);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB) {
        require(block.timestamp <= deadline, "EXPIRED");
        amountA = liquidity;
        amountB = liquidity;
        require(amountA >= amountAMin && amountB >= amountBMin, "INSUFFICIENT_LIQUIDITY");
        MockV2Pair pair = MockV2Pair(factory.getPair(tokenA, tokenB));
        IERC20(address(pair)).safeTransferFrom(msg.sender, address(this), liquidity);
        pair.burn(address(this), liquidity);
        IERC20(tokenA).safeTransfer(to, amountA);
        IERC20(tokenB).safeTransfer(to, amountB);
    }
}
