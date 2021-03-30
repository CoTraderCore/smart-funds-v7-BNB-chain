pragma solidity ^0.6.12;

import "./SmartFundETH.sol";

contract SmartFundETHFactory {

  function createSmartFund(
    address platfromAddress,
    address _owner,
    string  memory _name,
    uint256 _successFee,
    address _exchangePortalAddress,
    address _poolPortalAddress,
    address _defiPortal,
    address _permittedAddresses,
    bool    _isRequireTradeVerification
  )
  public
  returns(address)
  {
    SmartFundETH smartFundETH = new SmartFundETH(
      platfromAddress,
      _owner,
      _name,
      _successFee,
      _exchangePortalAddress,
      _poolPortalAddress,
      _defiPortal,
      _permittedAddresses,
      _isRequireTradeVerification
    );

    return address(smartFundETH);
  }
}
