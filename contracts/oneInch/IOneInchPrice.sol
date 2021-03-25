interface IOneInchPrice {
  function getRate(IERC20 srcToken, IERC20 dstToken) external view returns (uint256 weightedRate);
}
