import "./interfaces/IFetch.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/SafeERC20.sol";


contract ConverterFetch {
   using SafeERC20 for IERC20;
   using SafeMath for uint256;

   IFetch public fetch;

   constructor(address _fetch) public {
     fetch = IFetch(_fetch);
   }

   function depositByToken(
     address _token,
     address _router,
     uint256 _amount,
     bool _isClaimAbleStake
   )
   external
   {
     IUniswapV2Router02 router = IUniswapV2Router02(_router);
     IERC20 token = IERC20(_token);

     token.safeTransferFrom(msg.sender, address(this), _amount);
     token.approve(_router, _amount);

     address[] memory path = new address[](2);
     path[0] = _token;
     path[1] = router.WETH();

     router.swapExactTokensForETH(
       _amount,
       1,
       path,
       address(this),
       now + 1800
     );

     uint256 ethToSend = address(this).balance;

     fetch.depositFor.value(ethToSend)(_isClaimAbleStake, msg.sender);

     // send remains
     uint256 remains = token.balanceOf(address(this));
     if(remains > 0)
       token.transfer(msg.sender, remains);
   }

   /**
    * @dev fallback function
    */
   receive() external payable {}
}
