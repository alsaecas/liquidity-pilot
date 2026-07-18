// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { LiquidityPilot } from "../../src/LiquidityPilot.sol";
import { IV2Factory } from "../../src/interfaces/IV2Factory.sol";
import { IV2Pair } from "../../src/interfaces/IV2Pair.sol";

contract LiquidityPilotArbitrumForkTest is Test {
    address internal constant ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address internal constant FACTORY = 0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9;
    address internal constant USDT = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
    address internal constant DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;

    LiquidityPilot internal pilot;
    address internal user = makeAddr("fork-user");
    address internal pair;
    bool internal forkEnabled;

    function setUp() public {
        string memory rpcUrl = vm.envOr("ARBITRUM_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) return;
        vm.createSelectFork(rpcUrl);
        forkEnabled = true;

        assertGt(ROUTER.code.length, 0, "router has no bytecode");
        assertGt(FACTORY.code.length, 0, "factory has no bytecode");
        pair = IV2Factory(FACTORY).getPair(USDT, DAI);
        assertNotEq(pair, address(0), "pair missing");
        assertGt(pair.code.length, 0, "pair has no bytecode");
        address token0 = IV2Pair(pair).token0();
        address token1 = IV2Pair(pair).token1();
        assertTrue(
            (token0 == USDT && token1 == DAI) || (token0 == DAI && token1 == USDT),
            "unexpected pair tokens"
        );
        pilot = new LiquidityPilot(ROUTER, FACTORY);
        deal(USDT, user, 10_000e6, true);
    }

    function testFork_QuoteAndSwap_USDTToDAI() public {
        if (!forkEnabled) return;
        address[] memory path = _path(USDT, DAI);
        uint256[] memory quote = pilot.quoteSwap(100e6, path);
        assertGt(quote[1], 0);

        vm.startPrank(user);
        IERC20(USDT).approve(address(pilot), 100e6);
        uint256 output = pilot.swapExactTokens(
            100e6, quote[1] * 99 / 100, path, user, block.timestamp + 20 minutes
        );
        vm.stopPrank();

        assertEq(IERC20(USDT).balanceOf(user), 9_900e6);
        assertEq(IERC20(DAI).balanceOf(user), output);
        assertGe(output, quote[1] * 99 / 100);
        assertEq(IERC20(USDT).balanceOf(address(pilot)), 0);
        assertEq(IERC20(DAI).balanceOf(address(pilot)), 0);
    }

    function testFork_ZapInReceiveLpAndRemove() public {
        if (!forkEnabled) return;
        uint256 amountIn = 1_000e6;
        address[] memory path = _path(USDT, DAI);
        uint256 swapQuote = pilot.quoteSwap(amountIn / 2, path)[1];
        LiquidityPilot.ZapInParams memory zap = LiquidityPilot.ZapInParams({
            tokenA: USDT,
            tokenB: DAI,
            inputToken: USDT,
            amountIn: amountIn,
            minSwapOut: swapQuote * 98 / 100,
            minAmountA: 0,
            minAmountB: 0,
            minLiquidity: 1,
            recipient: user,
            deadline: block.timestamp + 20 minutes
        });

        vm.startPrank(user);
        IERC20(USDT).approve(address(pilot), amountIn);
        (,, uint256 liquidity) = pilot.zapIn(zap);
        assertGt(liquidity, 0);
        assertEq(IERC20(pair).balanceOf(user), liquidity);

        IERC20(pair).approve(address(pilot), liquidity);
        (uint256 amountA, uint256 amountB) = pilot.removeLiquidity(
            LiquidityPilot.RemoveParams({
                tokenA: USDT,
                tokenB: DAI,
                liquidity: liquidity,
                minAmountA: 1,
                minAmountB: 1,
                recipient: user,
                deadline: block.timestamp + 20 minutes
            })
        );
        vm.stopPrank();

        assertGt(amountA, 0);
        assertGt(amountB, 0);
        assertEq(IERC20(pair).balanceOf(user), 0);
        assertEq(IERC20(USDT).balanceOf(address(pilot)), 0);
        assertEq(IERC20(DAI).balanceOf(address(pilot)), 0);
        assertEq(IERC20(pair).balanceOf(address(pilot)), 0);
    }

    function _path(address tokenIn, address tokenOut)
        internal
        pure
        returns (address[] memory path)
    {
        path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
    }
}
