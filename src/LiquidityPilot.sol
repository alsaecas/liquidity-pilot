// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IV2Router } from "./interfaces/IV2Router.sol";
import { IV2Factory } from "./interfaces/IV2Factory.sol";

/// @title LiquidityPilot
/// @notice Non-custodial swaps and one-sided V2 liquidity management.
/// @dev Fee-on-transfer and rebasing tokens are intentionally unsupported.
contract LiquidityPilot is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error DeadlineExpired();
    error InvalidPath();
    error PairNotFound();
    error UnsupportedPairToken();
    error InvalidOutputToken();
    error InsufficientSwapOutput(uint256 actual, uint256 minimum);
    error InsufficientLiquidityOutput(uint256 actual, uint256 minimum);

    struct ZapInParams {
        address tokenA;
        address tokenB;
        address inputToken;
        uint256 amountIn;
        uint256 minSwapOut;
        uint256 minAmountA;
        uint256 minAmountB;
        uint256 minLiquidity;
        address recipient;
        uint256 deadline;
    }

    struct RemoveParams {
        address tokenA;
        address tokenB;
        uint256 liquidity;
        uint256 minAmountA;
        uint256 minAmountB;
        address recipient;
        uint256 deadline;
    }

    struct ZapOutParams {
        address tokenA;
        address tokenB;
        address outputToken;
        uint256 liquidity;
        uint256 minAmountA;
        uint256 minAmountB;
        uint256 minSwapOut;
        address recipient;
        uint256 deadline;
    }

    IV2Router public immutable router;
    IV2Factory public immutable factory;

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        address recipient,
        uint256 amountIn,
        uint256 amountOut
    );
    event LiquidityAdded(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        address inputToken,
        address recipient,
        uint256 inputAmount,
        uint256 swapOutput,
        uint256 amountAUsed,
        uint256 amountBUsed,
        uint256 liquidity
    );
    event LiquidityRemoved(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        address recipient,
        uint256 liquidity,
        uint256 amountA,
        uint256 amountB
    );
    event LiquidityZappedOut(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        address outputToken,
        address recipient,
        uint256 liquidity,
        uint256 removedA,
        uint256 removedB,
        uint256 swapOutput,
        uint256 totalOutput
    );

    /// @notice Configures the immutable V2 router and factory.
    constructor(address router_, address factory_) {
        if (router_ == address(0) || factory_ == address(0)) revert ZeroAddress();
        router = IV2Router(router_);
        factory = IV2Factory(factory_);
    }

    /// @notice Returns the V2 pair for two tokens, or the zero address when absent.
    function getPair(address tokenA, address tokenB) public view returns (address) {
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        return factory.getPair(tokenA, tokenB);
    }

    /// @notice Quotes a swap along a configurable V2 path.
    function quoteSwap(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        if (amountIn == 0) revert ZeroAmount();
        _validatePath(path);
        return router.getAmountsOut(amountIn, path);
    }

    /// @notice Swaps an exact ERC-20 input and sends output directly to `recipient`.
    function swapExactTokens(
        uint256 amountIn,
        uint256 minAmountOut,
        address[] calldata path,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();
        _validateDeadline(deadline);
        _validatePath(path);

        IERC20 input = IERC20(path[0]);
        input.safeTransferFrom(msg.sender, address(this), amountIn);
        _approveExact(input, amountIn);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, minAmountOut, path, recipient, deadline);
        input.forceApprove(address(router), 0);

        amountOut = amounts[amounts.length - 1];
        if (amountOut < minAmountOut) {
            revert InsufficientSwapOutput(amountOut, minAmountOut);
        }
        emit SwapExecuted(
            msg.sender, path[0], path[path.length - 1], recipient, amountIn, amountOut
        );
    }

    /// @notice Enters a direct V2 pair from one token and mints LP tokens to `recipient`.
    function zapIn(ZapInParams calldata p)
        external
        nonReentrant
        returns (uint256 amountAUsed, uint256 amountBUsed, uint256 liquidity)
    {
        _validateZapIn(p);
        address pair = factory.getPair(p.tokenA, p.tokenB);
        if (pair == address(0)) revert PairNotFound();

        address otherToken = p.inputToken == p.tokenA ? p.tokenB : p.tokenA;
        IERC20 tokenA = IERC20(p.tokenA);
        IERC20 tokenB = IERC20(p.tokenB);
        uint256 baseA = tokenA.balanceOf(address(this));
        uint256 baseB = tokenB.balanceOf(address(this));

        IERC20(p.inputToken).safeTransferFrom(msg.sender, address(this), p.amountIn);
        uint256 swapAmount = p.amountIn / 2;
        uint256 swapOutput = _swapDirect(
            p.inputToken, otherToken, swapAmount, p.minSwapOut, address(this), p.deadline
        );

        uint256 availableA = tokenA.balanceOf(address(this)) - baseA;
        uint256 availableB = tokenB.balanceOf(address(this)) - baseB;
        _approveExact(tokenA, availableA);
        _approveExact(tokenB, availableB);
        (amountAUsed, amountBUsed, liquidity) = router.addLiquidity(
            p.tokenA,
            p.tokenB,
            availableA,
            availableB,
            p.minAmountA,
            p.minAmountB,
            p.recipient,
            p.deadline
        );
        tokenA.forceApprove(address(router), 0);
        tokenB.forceApprove(address(router), 0);
        if (liquidity < p.minLiquidity) {
            revert InsufficientLiquidityOutput(liquidity, p.minLiquidity);
        }

        _refundDelta(tokenA, baseA, msg.sender);
        _refundDelta(tokenB, baseB, msg.sender);
        emit LiquidityAdded(
            msg.sender,
            p.tokenA,
            p.tokenB,
            p.inputToken,
            p.recipient,
            p.amountIn,
            swapOutput,
            amountAUsed,
            amountBUsed,
            liquidity
        );
    }

    /// @notice Pulls LP tokens from the caller and removes liquidity to `recipient`.
    function removeLiquidity(RemoveParams calldata p)
        external
        nonReentrant
        returns (uint256 amountA, uint256 amountB)
    {
        _validateRemove(p);
        address pair = factory.getPair(p.tokenA, p.tokenB);
        if (pair == address(0)) revert PairNotFound();

        IERC20 lpToken = IERC20(pair);
        lpToken.safeTransferFrom(msg.sender, address(this), p.liquidity);
        _approveExact(lpToken, p.liquidity);
        (amountA, amountB) = router.removeLiquidity(
            p.tokenA, p.tokenB, p.liquidity, p.minAmountA, p.minAmountB, p.recipient, p.deadline
        );
        lpToken.forceApprove(address(router), 0);
        emit LiquidityRemoved(
            msg.sender, p.tokenA, p.tokenB, p.recipient, p.liquidity, amountA, amountB
        );
    }

    /// @notice Removes liquidity and converts both underlying assets into `outputToken`.
    function zapOutToSingleToken(ZapOutParams calldata p)
        external
        nonReentrant
        returns (uint256 totalOutput)
    {
        _validateZapOut(p);
        address pair = factory.getPair(p.tokenA, p.tokenB);
        if (pair == address(0)) revert PairNotFound();

        address otherToken = p.outputToken == p.tokenA ? p.tokenB : p.tokenA;
        IERC20 output = IERC20(p.outputToken);
        IERC20 other = IERC20(otherToken);
        uint256 outputBase = output.balanceOf(address(this));
        uint256 otherBase = other.balanceOf(address(this));

        IERC20 lpToken = IERC20(pair);
        lpToken.safeTransferFrom(msg.sender, address(this), p.liquidity);
        _approveExact(lpToken, p.liquidity);
        (uint256 removedA, uint256 removedB) = router.removeLiquidity(
            p.tokenA, p.tokenB, p.liquidity, p.minAmountA, p.minAmountB, address(this), p.deadline
        );
        lpToken.forceApprove(address(router), 0);

        uint256 otherAmount = other.balanceOf(address(this)) - otherBase;
        uint256 swapOutput = _swapDirect(
            otherToken, p.outputToken, otherAmount, p.minSwapOut, address(this), p.deadline
        );
        totalOutput = output.balanceOf(address(this)) - outputBase;
        output.safeTransfer(p.recipient, totalOutput);
        _refundDelta(other, otherBase, p.recipient);

        emit LiquidityZappedOut(
            msg.sender,
            p.tokenA,
            p.tokenB,
            p.outputToken,
            p.recipient,
            p.liquidity,
            removedA,
            removedB,
            swapOutput,
            totalOutput
        );
    }

    function _swapDirect(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        IERC20 input = IERC20(tokenIn);
        _approveExact(input, amountIn);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, minAmountOut, path, recipient, deadline);
        input.forceApprove(address(router), 0);
        amountOut = amounts[1];
        if (amountOut < minAmountOut) {
            revert InsufficientSwapOutput(amountOut, minAmountOut);
        }
    }

    function _validateZapIn(ZapInParams calldata p) internal view {
        if (
            p.tokenA == address(0) || p.tokenB == address(0) || p.inputToken == address(0)
                || p.recipient == address(0)
        ) revert ZeroAddress();
        if (p.amountIn < 2) revert ZeroAmount();
        if (p.tokenA == p.tokenB) revert UnsupportedPairToken();
        if (p.inputToken != p.tokenA && p.inputToken != p.tokenB) {
            revert UnsupportedPairToken();
        }
        _validateDeadline(p.deadline);
    }

    function _validateRemove(RemoveParams calldata p) internal view {
        if (p.tokenA == address(0) || p.tokenB == address(0) || p.recipient == address(0)) {
            revert ZeroAddress();
        }
        if (p.liquidity == 0) revert ZeroAmount();
        _validateDeadline(p.deadline);
    }

    function _validateZapOut(ZapOutParams calldata p) internal view {
        if (
            p.tokenA == address(0) || p.tokenB == address(0) || p.outputToken == address(0)
                || p.recipient == address(0)
        ) revert ZeroAddress();
        if (p.liquidity == 0) revert ZeroAmount();
        if (p.outputToken != p.tokenA && p.outputToken != p.tokenB) {
            revert InvalidOutputToken();
        }
        _validateDeadline(p.deadline);
    }

    function _validateDeadline(uint256 deadline) internal view {
        if (deadline < block.timestamp) revert DeadlineExpired();
    }

    function _validatePath(address[] calldata path) internal pure {
        if (path.length < 2) revert InvalidPath();
        for (uint256 i; i < path.length; ++i) {
            if (path[i] == address(0)) revert ZeroAddress();
            if (i > 0 && path[i] == path[i - 1]) revert InvalidPath();
        }
    }

    function _approveExact(IERC20 token, uint256 amount) internal {
        token.forceApprove(address(router), amount);
    }

    function _refundDelta(IERC20 token, uint256 baseBalance, address recipient) internal {
        uint256 current = token.balanceOf(address(this));
        if (current > baseBalance) token.safeTransfer(recipient, current - baseBalance);
    }
}
