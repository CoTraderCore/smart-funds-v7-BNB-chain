pragma solidity ^0.6.2;

import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/ISale.sol";
import "./interfaces/IStake.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./openzeppelin-contracts/contracts/math/SafeMath.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/SafeERC20.sol";

contract Fetch {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  IUniswapV2Router02 public router;
  address public stakeClaimAble;
  address public stakeNonClaimAble;
  address public token;
  address public uniPair;
  address public tokenSale;

  /**
  * @dev constructor
  *
  * @param _stakeClaimAble        address of claim able stake
  * @param _stakeNonClaimAble     address of non claim able stake
  * @param _router                address of Uniswap v2 router
  * @param _token                 address of token token
  * @param _uniPair               address of pool pair
  * @param _tokenSale             address of token sale
  */
  constructor(
    address _stakeClaimAble,
    address _stakeNonClaimAble,
    address _router,
    address _token,
    address _uniPair,
    address _tokenSale
    )
    public
  {
    stakeClaimAble = _stakeClaimAble;
    stakeNonClaimAble = _stakeNonClaimAble;
    router = IUniswapV2Router02(_router);
    token = _token;
    uniPair = _uniPair;
    tokenSale = _tokenSale;
  }

  // deposit only ETH
  function deposit(bool _isClaimAbleStake) external payable {
    require(msg.value > 0, "zerro eth");
    // swap ETH
    swapETHInput(msg.value);
    // deposit and stake
    _depositFor(_isClaimAbleStake, msg.sender);
  }

  // deposit only ETH for a certain address
  function depositFor(bool _isClaimAbleStake, address receiver) external payable {
    require(msg.value > 0, "zerro eth");
    // swap ETH
    swapETHInput(msg.value);
    // deposit and stake
    _depositFor(_isClaimAbleStake, receiver);
  }

  // deposit ETH and token without convert
  function depositETHAndERC20(bool _isClaimAbleStake, uint256 tokenAmount) external payable {
    IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
    // deposit and stake
    _depositFor(_isClaimAbleStake, msg.sender);
  }

  /**
  * @dev convert deposited ETH into pool and then stake
  */
  function _depositFor(bool _isClaimAbleStake, address receiver) internal {
    // define stake address
    address stakeAddress = _isClaimAbleStake
    ? stakeClaimAble
    : stakeNonClaimAble;

    // check if token received
    uint256 tokenReceived = IERC20(token).balanceOf(address(this));
    uint256 ethBalance = address(this).balance;

    require(tokenReceived > 0, "NOT SWAPED");
    require(ethBalance > 0, "ETH NOT REMAINS");

    // convert ETH to WETH
    address WETH = router.WETH();
    IWETH(WETH).deposit.value(ethBalance)();

    // approve tokens to router
    IERC20(token).approve(address(router), tokenReceived);
    IERC20(WETH).approve(address(router), ethBalance);

    // add LD
    router.addLiquidity(
        WETH,
        token,
        ethBalance,
        tokenReceived,
        1,
        1,
        address(this),
        now + 1800
    );

    // approve pool to stake
    uint256 poolReceived = IERC20(uniPair).balanceOf(address(this));
    IERC20(uniPair).approve(stakeAddress, poolReceived);

    // deposit received pool in token vault strategy
    IStake(stakeAddress).stakeFor(poolReceived, receiver);

    // send remains and shares back to users
    sendRemains(stakeAddress, receiver);
  }


 /**
 * @dev send remains back to user
 */
 function sendRemains(address stakeAddress, address receiver) internal {
    uint256 tokenRemains = IERC20(token).balanceOf(address(this));
    if(tokenRemains > 0)
       IERC20(token).transfer(receiver, tokenRemains);

    address WETH = router.WETH();
    uint256 wethRemains = IERC20(WETH).balanceOf(address(this));
    if(wethRemains > 0)
      IERC20(WETH).transfer(receiver, wethRemains);

    uint256 ethRemains = address(this).balance;
    if(ethRemains > 0)
       payable(receiver).transfer(ethRemains);
 }

 /**
 * @dev swap ETH to token via DEX and Sale
 */
 function swapETHInput(uint256 input) internal {
   // determining the portion of the incoming ETH to be converted to the ERC20 Token
   uint256 conversionPortion = input.mul(505).div(1000);

   (uint256 ethToPool, uint256 ethToSale) = calculateToSplit(conversionPortion);

   // SWAP split % of ETH input to token from pool
   address[] memory path = new address[](2);
   path[0] = router.WETH();
   path[1] = token;

   router.swapExactETHForTokens.value(ethToPool)(
     1,
     path,
     address(this),
     now + 1800
   );

   // BUY token via split % of ETH input
   if(ethToSale > 0)
     ISale(tokenSale).buy.value(ethToSale)();
 }

 /**
 * @dev swap token to ETH via DEX
 */
 function swaptokenInput(uint256 input) internal {
   // determining the portion of the incoming ETH to be converted to the ERC20 Token
   uint256 conversionPortion = input.mul(505).div(1000);

   // SWAP token 50.5% to ETH
   address[] memory path = new address[](2);
   path[0] = token;
   path[1] = router.WETH();

   IERC20(token).approve(address(router), conversionPortion);

   router.swapExactTokensForETH(
     conversionPortion,
     1,
     path,
     address(this),
     now + 1800
   );
 }

 /**
 * @dev return split % of input in pool and % of input in sale
 */
 function calculateToSplit(uint256 ethInput)
   public
   view
   returns(uint256 ethToPool, uint256 ethToSale)
 {
   uint256 percentToSplit = percentToSplit();

   if(percentToSplit == 0){
     ethToPool = ethInput;
     ethToSale = 0;
   }else{
     uint256 toSale = ethInput.div(100).mul(percentToSplit);
     ethToPool = ethInput.sub(toSale);
     ethToSale = toSale;
   }
 }

 /**
 * @dev calculate % for split
 *
   5% after 1000 BNB LD
   10% after 2000 BNB LD
   20% after 4000 BNB LD
   40% after 8000 BNB LD
   50% after 12000 BNB LD
 */
 function percentToSplit() public view returns(uint256){
   uint256 poolBalance = IERC20(router.WETH()).balanceOf(uniPair);

   if(poolBalance < 1000 * 10**18){
     return 0;
   }
   else if(poolBalance < 2000 * 10**18){
     return 5;
   }
   else if(poolBalance < 4000 * 10**18){
     return 10;
   }
   else if(poolBalance < 8000 * 10**18 && poolBalance < 12000 * 10**18){
     return 40;
   }
   else{
     return 50;
   }
 }
}
