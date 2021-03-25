// For support new Defi protocols
// NOT IMPLEMENTED FOR NOW
pragma solidity ^0.6.12;

import "../../zeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../../zeppelin-solidity/contracts/math/SafeMath.sol";
import "../interfaces/ITokensTypeStorage.sol";


contract DefiPortal {
  using SafeMath for uint256;

  uint public version = 4;
  address constant private ETH_TOKEN_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

  // Contract for handle tokens types
  ITokensTypeStorage public tokensTypes;

  constructor(address _tokensTypes) public {
    tokensTypes = ITokensTypeStorage(_tokensTypes);
  }

  /**
  *
  * if need paybale protocol, in new version of this portal can be added such function
  *
  function callNonPayableProtocol(
    address[] memory tokensToSend,
    uint256[] memory amountsToSend,
    bytes memory _additionalData,
    bytes32[] memory _additionalArgs
  )
   external
   returns(
     string memory eventType,
     address[] memory tokensToReceive,
     uint256[] memory amountsToReceive
  );
  */


  // // param _additionalArgs[0] require DefiActions type
  // function callNonPayableProtocol(
  //   address[] memory tokensToSend,
  //   uint256[] memory amountsToSend,
  //   bytes memory _additionalData,
  //   bytes32[] memory _additionalArgs
  // )
  //   external
  //   returns(
  //     string memory eventType,
  //     address[] memory tokensToReceive,
  //     uint256[] memory amountsToReceive
  //   )
  // {
  //    revert("Unknown DEFI action");
  // }


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
}
