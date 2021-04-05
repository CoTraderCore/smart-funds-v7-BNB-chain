import "../../oneInch/IOneInchPrice.sol";
import "../interfaces/IDecimals.sol";
import "../../zeppelin-solidity/contracts/math/SafeMath.sol";

contract PricePortal {
  using SafeMath for uint256;

  IOneInchPrice public oneInchPrice = IOneInchPrice(0xe26A18b00E4827eD86bc136B2c1e95D5ae115edD);
  address constant private ETH_TOKEN_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

  // helper for get ratio between assets in 1inch aggregator
  function getPrice(
    address _from,
    address _to,
    uint256 _amount
  )
    public
    view
    returns (uint256 value)
  {
    // if direction the same, just return amount
    if(_from == _to)
       return _amount;

    address fromAddress = _from == ETH_TOKEN_ADDRESS ? address(0) : _from;
    address toAddress = _to == ETH_TOKEN_ADDRESS ? address(0) : _to;

    // try get rate
    try oneInchPrice.getRate(
       fromAddress,
       toAddress
     )
      returns(uint256 weightedRate)
     {
       uint256 decimalsFrom = getDecimals(_from);
       uint256 decimalsTo = getDecimals(_to);
       uint256 preConvert = uint256(weightedRate) * (10 ** decimalsFrom) / (10 ** decimalsTo);
       value = _amount.mul(preConvert).div(10**decimalsFrom);
     }
     catch{
       value = 0;
     }
  }

  function getDecimals(address _from) internal view returns(uint256) {
    if(_from == ETH_TOKEN_ADDRESS || _from == address(0)){
      return 18;
    }else{
      return IDecimals(_from).decimals();
    }
  }
}
