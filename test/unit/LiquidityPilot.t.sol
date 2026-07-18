// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { LiquidityPilot } from "../../src/LiquidityPilot.sol";
import { MockERC20 } from "../mocks/MockERC20.sol";
import { MockV2Pair } from "../mocks/MockV2Pair.sol";
import { MockV2Factory } from "../mocks/MockV2Factory.sol";
import { MockV2Router } from "../mocks/MockV2Router.sol";
import { ReentrantERC20 } from "../mocks/ReentrantERC20.sol";

contract LiquidityPilotTest is Test {
    MockERC20 internal usdt;
    MockERC20 internal dai;
    MockERC20 internal weth;
    MockV2Factory internal factory;
    MockV2Router internal router;
    MockV2Pair internal pair;
    LiquidityPilot internal pilot;
    address internal user = makeAddr("user");
    address internal recipient = makeAddr("recipient");

    uint256 internal constant INITIAL = 1_000_000e18;

    function setUp() public {
        usdt = new MockERC20("Tether", "USDT", 6);
        dai = new MockERC20("Dai", "DAI", 18);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        factory = new MockV2Factory();
        pair = MockV2Pair(factory.createPair(address(usdt), address(dai)));
        router = new MockV2Router(address(factory));
        pilot = new LiquidityPilot(address(router), address(factory));

        usdt.mint(user, INITIAL);
        dai.mint(user, INITIAL);
        usdt.mint(address(router), INITIAL);
        dai.mint(address(router), INITIAL);
        weth.mint(address(router), INITIAL);
        vm.startPrank(user);
        usdt.approve(address(pilot), type(uint256).max);
        dai.approve(address(pilot), type(uint256).max);
        pair.approve(address(pilot), type(uint256).max);
        vm.stopPrank();
    }

    function test_Constructor_ConfiguresImmutableEndpoints() public view {
        assertEq(address(pilot.router()), address(router));
        assertEq(address(pilot.factory()), address(factory));
    }

    function test_RevertWhen_ConstructorAddressIsZero() public {
        vm.expectRevert(LiquidityPilot.ZeroAddress.selector);
        new LiquidityPilot(address(0), address(factory));
    }

    function test_GetPair_ResolvesThroughFactory() public view {
        assertEq(pilot.getPair(address(usdt), address(dai)), address(pair));
        assertEq(pilot.getPair(address(dai), address(usdt)), address(pair));
    }

    function test_QuoteSwap_SupportsMultiHopPaths() public view {
        address[] memory path = new address[](3);
        path[0] = address(usdt);
        path[1] = address(weth);
        path[2] = address(dai);
        uint256[] memory amounts = pilot.quoteSwap(100e6, path);
        assertEq(amounts.length, 3);
        assertEq(amounts[2], 100e6);
    }

    function test_Swap_ReturnsActualOutputAndChangesBalances() public {
        router.setSwapRateBps(9_500);
        address[] memory path = _path(address(usdt), address(dai));
        uint256 userBefore = usdt.balanceOf(user);
        uint256 recipientBefore = dai.balanceOf(recipient);

        vm.prank(user);
        uint256 output =
            pilot.swapExactTokens(100e6, 95e6, path, recipient, block.timestamp + 20 minutes);

        assertEq(output, 95e6);
        assertEq(userBefore - usdt.balanceOf(user), 100e6);
        assertEq(dai.balanceOf(recipient) - recipientBefore, 95e6);
        assertEq(usdt.allowance(address(pilot), address(router)), 0);
    }

    function test_Swap_EmitsDetailedEvent() public {
        address[] memory path = _path(address(usdt), address(dai));
        vm.expectEmit(true, true, true, true, address(pilot));
        emit LiquidityPilot.SwapExecuted(user, address(usdt), address(dai), recipient, 10e6, 10e6);
        vm.prank(user);
        pilot.swapExactTokens(10e6, 10e6, path, recipient, block.timestamp + 1);
    }

    function test_ZapIn_TransfersInputOnlyOnceAndMintsLpToRecipient() public {
        uint256 userBefore = usdt.balanceOf(user);
        vm.prank(user);
        (uint256 usedA, uint256 usedB, uint256 liquidity) =
            pilot.zapIn(_zapInParams(100e6, recipient));

        assertEq(userBefore - usdt.balanceOf(user), 100e6);
        assertEq(usedA, 50e6);
        assertEq(usedB, 50e6);
        assertEq(liquidity, 50e6);
        assertEq(pair.balanceOf(recipient), 50e6);
        assertEq(usdt.balanceOf(address(pilot)), 0);
        assertEq(dai.balanceOf(address(pilot)), 0);
    }

    function test_ZapIn_RefundsUnusedTokenDust() public {
        router.setLiquidityUseBps(9_000);
        uint256 beforeBalance = usdt.balanceOf(user);
        vm.prank(user);
        (uint256 usedA, uint256 usedB,) = pilot.zapIn(_zapInParams(100e6, user));

        assertEq(usedA, 45e6);
        assertEq(usedB, 45e6);
        assertEq(beforeBalance - usdt.balanceOf(user), 95e6);
        assertEq(dai.balanceOf(user), INITIAL + 5e6);
        assertEq(usdt.balanceOf(address(pilot)), 0);
        assertEq(dai.balanceOf(address(pilot)), 0);
    }

    function test_RemoveLiquidity_PullsLpTokensFromCaller() public {
        _mintLpToUser(80e6);
        uint256 lpBefore = pair.balanceOf(user);
        uint256 usdtBefore = usdt.balanceOf(recipient);
        uint256 daiBefore = dai.balanceOf(recipient);

        vm.prank(user);
        (uint256 amountA, uint256 amountB) = pilot.removeLiquidity(_removeParams(30e6, recipient));

        assertEq(lpBefore - pair.balanceOf(user), 30e6);
        assertEq(amountA, 30e6);
        assertEq(amountB, 30e6);
        assertEq(usdt.balanceOf(recipient) - usdtBefore, 30e6);
        assertEq(dai.balanceOf(recipient) - daiBefore, 30e6);
        assertEq(pair.allowance(address(pilot), address(router)), 0);
        assertEq(pair.balanceOf(address(pilot)), 0);
    }

    function test_ZapOut_ConvertsBothAssetsToRequestedToken() public {
        _mintLpToUser(80e6);
        uint256 beforeBalance = dai.balanceOf(recipient);
        LiquidityPilot.ZapOutParams memory p = LiquidityPilot.ZapOutParams({
            tokenA: address(usdt),
            tokenB: address(dai),
            outputToken: address(dai),
            liquidity: 40e6,
            minAmountA: 40e6,
            minAmountB: 40e6,
            minSwapOut: 40e6,
            recipient: recipient,
            deadline: block.timestamp + 20 minutes
        });

        vm.prank(user);
        uint256 output = pilot.zapOutToSingleToken(p);

        assertEq(output, 80e6);
        assertEq(dai.balanceOf(recipient) - beforeBalance, 80e6);
        assertEq(usdt.balanceOf(address(pilot)), 0);
        assertEq(dai.balanceOf(address(pilot)), 0);
        assertEq(pair.allowance(address(pilot), address(router)), 0);
    }

    function test_RevertWhen_DeadlineHasExpired() public {
        address[] memory path = _path(address(usdt), address(dai));
        vm.warp(100);
        vm.expectRevert(LiquidityPilot.DeadlineExpired.selector);
        vm.prank(user);
        pilot.swapExactTokens(1e6, 0, path, user, 99);
    }

    function test_RevertWhen_AmountIsZero() public {
        address[] memory path = _path(address(usdt), address(dai));
        vm.expectRevert(LiquidityPilot.ZeroAmount.selector);
        vm.prank(user);
        pilot.swapExactTokens(0, 0, path, user, block.timestamp);
    }

    function test_RevertWhen_RecipientIsZero() public {
        address[] memory path = _path(address(usdt), address(dai));
        vm.expectRevert(LiquidityPilot.ZeroAddress.selector);
        vm.prank(user);
        pilot.swapExactTokens(1e6, 0, path, address(0), block.timestamp);
    }

    function test_RevertWhen_PathIsInvalid() public {
        address[] memory path = new address[](1);
        path[0] = address(usdt);
        vm.expectRevert(LiquidityPilot.InvalidPath.selector);
        pilot.quoteSwap(1e6, path);
    }

    function test_RevertWhen_ZapInTokenIsNotInPair() public {
        LiquidityPilot.ZapInParams memory p = _zapInParams(10e6, user);
        p.inputToken = address(weth);
        vm.expectRevert(LiquidityPilot.UnsupportedPairToken.selector);
        vm.prank(user);
        pilot.zapIn(p);
    }

    function test_RevertWhen_PairDoesNotExist() public {
        LiquidityPilot.ZapInParams memory p = _zapInParams(10e6, user);
        p.tokenB = address(weth);
        vm.expectRevert(LiquidityPilot.PairNotFound.selector);
        vm.prank(user);
        pilot.zapIn(p);
    }

    function test_RevertWhen_ZapOutTokenIsNotInPair() public {
        LiquidityPilot.ZapOutParams memory p = LiquidityPilot.ZapOutParams({
            tokenA: address(usdt),
            tokenB: address(dai),
            outputToken: address(weth),
            liquidity: 1,
            minAmountA: 0,
            minAmountB: 0,
            minSwapOut: 0,
            recipient: user,
            deadline: block.timestamp
        });
        vm.expectRevert(LiquidityPilot.InvalidOutputToken.selector);
        vm.prank(user);
        pilot.zapOutToSingleToken(p);
    }

    function test_RevertWhen_RouterSlippageCheckFails() public {
        router.setSwapRateBps(9_000);
        address[] memory path = _path(address(usdt), address(dai));
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        vm.prank(user);
        pilot.swapExactTokens(100e6, 91e6, path, user, block.timestamp);
    }

    function test_ReentrancyGuard_BlocksTokenCallback() public {
        ReentrantERC20 reentrantToken = new ReentrantERC20();
        reentrantToken.mint(user, 10e18);
        dai.mint(address(router), 10e18);
        address[] memory path = _path(address(reentrantToken), address(dai));
        bytes memory callback =
            abi.encodeCall(pilot.swapExactTokens, (1, 0, path, user, block.timestamp + 1));
        reentrantToken.configureCallback(address(pilot), callback);
        vm.prank(user);
        reentrantToken.approve(address(pilot), 10e18);

        vm.prank(user);
        uint256 output = pilot.swapExactTokens(10e18, 10e18, path, user, block.timestamp + 1);

        assertEq(output, 10e18);
        assertFalse(reentrantToken.callbackSucceeded());
    }

    function testFuzz_ZapIn_AccountsForInputAndDust(uint96 rawAmount, uint16 rawUseBps) public {
        uint256 amount = bound(uint256(rawAmount), 2, 500_000e6);
        uint256 useBps = bound(uint256(rawUseBps), 5_000, 10_000);
        router.setLiquidityUseBps(useBps);
        uint256 userBefore = usdt.balanceOf(user);
        uint256 daiBefore = dai.balanceOf(user);

        vm.prank(user);
        (uint256 usedA, uint256 usedB,) = pilot.zapIn(_zapInParams(amount, user));

        assertEq(userBefore - usdt.balanceOf(user), amount / 2 + usedA);
        assertEq(dai.balanceOf(user) - daiBefore, amount / 2 - usedB);
        assertEq(usdt.balanceOf(address(pilot)), 0);
        assertEq(dai.balanceOf(address(pilot)), 0);
    }

    function testFuzz_Swap_MinimumOutputBoundary(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 500_000e6);
        router.setSwapRateBps(9_875);
        uint256 expected = amount * 9_875 / 10_000;
        address[] memory path = _path(address(usdt), address(dai));
        vm.prank(user);
        uint256 actual = pilot.swapExactTokens(amount, expected, path, user, block.timestamp + 1);
        assertEq(actual, expected);
    }

    function _mintLpToUser(uint256 amount) internal {
        pair.mint(user, amount);
    }

    function _zapInParams(uint256 amount, address to)
        internal
        view
        returns (LiquidityPilot.ZapInParams memory)
    {
        return LiquidityPilot.ZapInParams({
            tokenA: address(usdt),
            tokenB: address(dai),
            inputToken: address(usdt),
            amountIn: amount,
            minSwapOut: amount / 2,
            minAmountA: 0,
            minAmountB: 0,
            minLiquidity: 0,
            recipient: to,
            deadline: block.timestamp + 20 minutes
        });
    }

    function _removeParams(uint256 liquidity, address to)
        internal
        view
        returns (LiquidityPilot.RemoveParams memory)
    {
        return LiquidityPilot.RemoveParams({
            tokenA: address(usdt),
            tokenB: address(dai),
            liquidity: liquidity,
            minAmountA: liquidity,
            minAmountB: liquidity,
            recipient: to,
            deadline: block.timestamp + 20 minutes
        });
    }

    function _path(address a, address b) internal pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = a;
        path[1] = b;
    }
}
