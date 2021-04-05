pragma solidity ^0.6.12;

/*
* This contract do swap for ERC20 via 1inch

  Also this contract allow get ratio between crypto curency assets
  Also get ratio for Bancor and Uniswap pools
*/

import "../../zeppelin-solidity/contracts/access/Ownable.sol";
import "../../zeppelin-solidity/contracts/math/SafeMath.sol";

import "../interfaces/IPricePortal.sol";
import "../interfaces/ExchangePortalInterface.sol";
import "../interfaces/DefiPortalInterface.sol";
import "../interfaces/PoolPortalViewInterface.sol";
import "../interfaces/ITokensTypeStorage.sol";
import "../interfaces/IMerkleTreeTokensVerification.sol";


contract ExchangePortal is ExchangePortalInterface, Ownable {
  using SafeMath for uint256;

  uint public version = 5;

  // Contract for handle tokens types
  ITokensTypeStorage public tokensTypes;

  // Contract for merkle tree white list verification
  IMerkleTreeTokensVerification public merkleTreeWhiteList;

  // 1 inch protocol for calldata
  address public OneInchRoute;

  IPricePortal public pricePortal;

  // CoTrader portals
  PoolPortalViewInterface public poolPortal;
  DefiPortalInterface public defiPortal;


  // Enum
  // NOTE: You can add a new type at the end, but DO NOT CHANGE this order,
  // because order has dependency in other contracts like ConvertPortal
  enum ExchangeType { OneInchRoute }

  // This contract recognizes ETH by this address
  IERC20 constant private ETH_TOKEN_ADDRESS = IERC20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

  // Trade event
  event Trade(
     address trader,
     address src,
     uint256 srcAmount,
     address dest,
     uint256 destReceived,
     uint8 exchangeType
  );

  // black list for non trade able tokens
  mapping (address => bool) disabledTokens;

  // Modifier to check that trading this token is not disabled
  modifier tokenEnabled(IERC20 _token) {
    require(!disabledTokens[address(_token)]);
    _;
  }

  /**
  * @dev contructor
  *
  * @param _defiPortal             address of defiPortal contract
  * @param _poolPortal             address of pool portal
  * @param _pricePortal            address of price portal
  * @param _OneInchRoute           address of oneInch ETH contract
  * @param _tokensTypes            address of the ITokensTypeStorage
  * @param _merkleTreeWhiteList    address of the IMerkleTreeWhiteList
  */
  constructor(
    address _defiPortal,
    address _poolPortal,
    address _pricePortal,
    address _OneInchRoute,
    address _tokensTypes,
    address _merkleTreeWhiteList
    )
    public
  {
    defiPortal = DefiPortalInterface(_defiPortal);
    poolPortal = PoolPortalViewInterface(_poolPortal);
    pricePortal = IPricePortal(_pricePortal);
    OneInchRoute = _OneInchRoute;
    tokensTypes = ITokensTypeStorage(_tokensTypes);
    merkleTreeWhiteList = IMerkleTreeTokensVerification(_merkleTreeWhiteList);
  }


  // EXCHANGE Functions

  /**
  * @dev Facilitates a trade for a SmartFund
  *
  * @param _source            ERC20 token to convert from
  * @param _sourceAmount      Amount to convert from (in _source token)
  * @param _destination       ERC20 token to convert to
  * @param _type              The type of exchange to trade with
  * @param _proof             Merkle tree proof (if not used just set [])
  * @param _positions         Merkle tree positions (if not used just set [])
  * @param _additionalData    For additional data (if not used just set 0x0)
  * @param _verifyDestanation For additional check if token in list or not
  *
  * @return receivedAmount    The amount of _destination received from the trade
  */
  function trade(
    IERC20 _source,
    uint256 _sourceAmount,
    IERC20 _destination,
    uint256 _type,
    bytes32[] calldata _proof,
    uint256[] calldata _positions,
    bytes calldata _additionalData,
    bool _verifyDestanation
  )
    external
    override
    payable
    tokenEnabled(_destination)
    returns (uint256 receivedAmount)
  {
    // throw if destanation token not in white list
    if(_verifyDestanation)
      _verifyToken(address(_destination), _proof, _positions);

    require(_source != _destination, "source can not be destination");

    // check ETH payable case
    if (_source == ETH_TOKEN_ADDRESS) {
      require(msg.value == _sourceAmount);
    } else {
      require(msg.value == 0);
    }

    if (_type == uint(ExchangeType.OneInchRoute)){
      receivedAmount = _tradeViaOneInchRoute(
          address(_source),
          address(_destination),
          _sourceAmount,
          _additionalData
      );
    }

    else {
      // unknown exchange type
      revert("Unknown type");
    }

    // Additional check
    require(receivedAmount > 0, "received amount can not be zerro");

    // Send destination
    if (_destination == ETH_TOKEN_ADDRESS) {
      (msg.sender).transfer(receivedAmount);
    } else {
      // transfer tokens received to sender
      _destination.transfer(msg.sender, receivedAmount);
    }

    // Send remains
    _sendRemains(_source, msg.sender);

    // Trigger event
    emit Trade(
      msg.sender,
      address(_source),
      _sourceAmount,
      address(_destination),
      receivedAmount,
      uint8(_type)
    );
  }

  // Facilitates trade with 1inch ETH
  // this protocol require calldata from 1inch api
  function _tradeViaOneInchRoute(
    address sourceToken,
    address destinationToken,
    uint256 sourceAmount,
    bytes memory _additionalData
    )
    private
    returns(uint256 destinationReceived)
  {
     bool success;
     // from ETH
     if(IERC20(sourceToken) == ETH_TOKEN_ADDRESS) {
       (success, ) = OneInchRoute.call.value(sourceAmount)(
         _additionalData
       );
     }
     // from ERC20
     else {
       _transferFromSenderAndApproveTo(IERC20(sourceToken), sourceAmount, OneInchRoute);
       (success, ) = OneInchRoute.call(
         _additionalData
       );
     }
     // check trade status
     require(success, "Fail 1inch call");
     // get received amount
     destinationReceived = tokenBalance(IERC20(destinationToken));
     // set token type
     tokensTypes.addNewTokenType(destinationToken, "CRYPTOCURRENCY");
  }

  // Facilitates for send source remains
  function _sendRemains(IERC20 _source, address _receiver) private {
    // After the trade, any _source that exchangePortal holds will be sent back to msg.sender
    uint256 endAmount = (_source == ETH_TOKEN_ADDRESS)
    ? address(this).balance
    : _source.balanceOf(address(this));

    // Check if we hold a positive amount of _source
    if (endAmount > 0) {
      if (_source == ETH_TOKEN_ADDRESS) {
        payable(_receiver).transfer(endAmount);
      } else {
        _source.transfer(_receiver, endAmount);
      }
    }
  }


  // Facilitates for verify destanation token input (check if token in merkle list or not)
  // revert transaction if token not in list
  function _verifyToken(
    address _destination,
    bytes32 [] memory proof,
    uint256 [] memory positions)
    private
    view
  {
    bool status = merkleTreeWhiteList.verify(_destination, proof, positions);

    if(!status)
      revert("Dest not in white list");
  }

  /**
  * @dev Transfers tokens to this contract and approves them to another address
  *
  * @param _source          Token to transfer and approve
  * @param _sourceAmount    The amount to transfer and approve (in _source token)
  * @param _to              Address to approve to
  */
  function _transferFromSenderAndApproveTo(IERC20 _source, uint256 _sourceAmount, address _to) private {
    require(_source.transferFrom(msg.sender, address(this), _sourceAmount));
    // reset previos approve because some tokens require allowance 0
    _source.approve(_to, 0);
    // approve
    _source.approve(_to, _sourceAmount);
  }



  // VIEW Functions

  function tokenBalance(IERC20 _token) private view returns (uint256) {
    if (_token == ETH_TOKEN_ADDRESS)
      return address(this).balance;
    return _token.balanceOf(address(this));
  }

  /**
  * @dev Gets the ratio by amount of token _from in token _to by totekn type
  *
  * @param _from      Address of token we're converting from
  * @param _to        Address of token we're getting the value in
  * @param _amount    The amount of _from
  *
  * @return best price from 1inch for ERC20, or ratio for Uniswap and Bancor pools
  */
  function getValue(address _from, address _to, uint256 _amount)
    public
    override
    view
    returns (uint256)
  {
    if(_amount > 0){
      // get asset type
      bytes32 assetType = tokensTypes.getType(_from);

      // get value by asset type
      if(assetType == bytes32("CRYPTOCURRENCY")){
        return getValueViaDEXsAgregators(_from, _to, _amount);
      }
      else{
        // Unmarked type, try find value
        return findValue(_from, _to, _amount);
      }
    }
    else{
      return 0;
    }
  }

  /**
  * @dev find the ratio by amount of token _from in token _to trying all available methods
  *
  * @param _from      Address of token we're converting from
  * @param _to        Address of token we're getting the value in
  * @param _amount    The amount of _from
  *
  * @return best price from 1inch for ERC20, or ratio for Uniswap and Bancor pools
  */
  function findValue(address _from, address _to, uint256 _amount) private view returns (uint256) {
     if(_amount > 0){
       // re-check from aggregators for unknown type
       uint256 aggregatorValue = getValueViaDEXsAgregators(_from, _to, _amount);
       if(aggregatorValue > 0)
          return aggregatorValue;
       // Check at first value from defi portal, maybe there are new defi protocols
       // If defiValue return 0 continue check from another sources
       uint256 defiValue = defiPortal.getValue(_from, _to, _amount);
       if(defiValue > 0)
          return defiValue;

       // Uniswap V2 pools return 0 if these is not a Uniswap V2 pool
       return getValueForUniswapV2Pools(_from, _to, _amount);
     }
     else{
       return 0;
     }
  }


  // helper for get value via 1inch
  // in this interface can be added more DEXs aggregators
  function getValueViaDEXsAgregators(
    address _from,
    address _to,
    uint256 _amount
  )
  public view returns (uint256){
    // if direction the same, just return amount
    if(_from == _to)
       return _amount;

    // try get value via 1inch
    if(_amount > 0){
      // try get value from 1inch aggregator
      return pricePortal.getPrice(_from, _to, _amount);
    }
    else{
      return 0;
    }
  }


  // helper for get ratio between pools in Uniswap network version 2
  // _from - should be uniswap pool address
  function getValueForUniswapV2Pools(
    address _from,
    address _to,
    uint256 _amount
  )
  public
  view
  returns (uint256)
  {
    // get connectors amount by pool share
    try poolPortal.getUniswapV2ConnectorsAmountByPoolAmount(
      _amount,
      _from
    ) returns (
      uint256 tokenAmountOne,
      uint256 tokenAmountTwo,
      address tokenAddressOne,
      address tokenAddressTwo
      )
    {
      // convert connectors amount via DEX aggregator
      uint256 amountOne = getValueViaDEXsAgregators(tokenAddressOne, _to, tokenAmountOne);
      uint256 amountTwo = getValueViaDEXsAgregators(tokenAddressTwo, _to, tokenAmountTwo);
      // return value
      return amountOne + amountTwo;
    }catch{
      return 0;
    }
  }

  /**
  * @dev Gets the total value of array of tokens and amounts
  *
  * @param _fromAddresses    Addresses of all the tokens we're converting from
  * @param _amounts          The amounts of all the tokens
  * @param _to               The token who's value we're converting to
  *
  * @return The total value of _fromAddresses and _amounts in terms of _to
  */
  function getTotalValue(
    address[] calldata _fromAddresses,
    uint256[] calldata _amounts,
    address _to)
    external
    override
    view
    returns (uint256)
  {
    uint256 sum = 0;
    for (uint256 i = 0; i < _fromAddresses.length; i++) {
      sum = sum.add(getValue(_fromAddresses[i], _to, _amounts[i]));
    }
    return sum;
  }

  // SETTERS Functions

  /**
  * @dev Allows the owner to disable/enable the buying of a token
  *
  * @param _token      Token address whos trading permission is to be set
  * @param _enabled    New token permission
  */
  function setToken(address _token, bool _enabled) external onlyOwner {
    disabledTokens[_token] = _enabled;
  }

  // owner can change price portal
  function setNewPricePortal(address _pricePortal) external onlyOwner {
    pricePortal = IPricePortal(_pricePortal);
  }

  // owner can change oneInch
  function setNewOneInchRoute(address _OneInchRoute) external onlyOwner {
    OneInchRoute = _OneInchRoute;
  }

  // owner can set new pool portal
  function setNewPoolPortal(address _poolPortal) external onlyOwner {
    poolPortal = PoolPortalViewInterface(_poolPortal);
  }

  // owner can set new defi portal
  function setNewDefiPortal(address _defiPortal) external onlyOwner {
    defiPortal = DefiPortalInterface(_defiPortal);
  }

  // fallback payable function to receive ether from other contract addresses
  fallback() external payable {}

}
