interface SmartFundETHFactoryInterface {
  function createSmartFund(
    address platformAddress,
    address _owner,
    string  memory _name,
    uint256 _successFee,
    address _exchangePortalAddress,
    address _poolPortalAddress,
    address _defiPortal,
    address _permittedAddresses,
    bool    _isRequireTradeVerification
  )
  external
  returns(address);
}
