// import { BN, fromWei, toWei } from 'web3-utils'
// import ether from './helpers/ether'
// import EVMRevert from './helpers/EVMRevert'
// import { duration } from './helpers/duration'
// const BigNumber = BN
// const timeMachine = require('ganache-time-traveler')
//
// require('chai')
//   .use(require('chai-as-promised'))
//   .use(require('chai-bignumber')(BigNumber))
//   .should()
//
// const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
//
// // real contracts
// const UniswapV2Factory = artifacts.require('./UniswapV2Factory.sol')
// const UniswapV2Router = artifacts.require('./UniswapV2Router02.sol')
// const UniswapV2Pair = artifacts.require('./UniswapV2Pair.sol')
// const WETH = artifacts.require('./WETH9.sol')
// const TOKEN = artifacts.require('./MintToken.sol')
// const StakeClaim = artifacts.require('./StakeClaim.sol')
// const StakeNonClaim = artifacts.require('./StakeNonClaim.sol')
// const Fetch = artifacts.require('./Fetch.sol')
// const Sale = artifacts.require('./Sale.sol')
//
// const PairHash = "0x774b5e95bfc4d156d74fcd8dc28975e0343643aeb573357a038810ce46e0eb94"
// const Beneficiary = "0x6ffFe11A5440fb275F30e0337Fc296f938a287a5"
//
// let uniswapV2Factory,
//     uniswapV2Router,
//     weth,
//     token,
//     pair,
//     pairAddress,
//     stakeClaim,
//     stakeNonClaim,
//     fetch,
//     sale
//
//
// contract('Fetch-test', function([userOne, userTwo, userThree]) {
//
//   async function deployContracts(){
//     // deploy contracts
//     uniswapV2Factory = await UniswapV2Factory.new(userOne)
//     weth = await WETH.new()
//     uniswapV2Router = await UniswapV2Router.new(uniswapV2Factory.address, weth.address)
//     token = await TOKEN.new(toWei(String(100000)))
//
//     // add token liquidity
//     await token.approve(uniswapV2Router.address, toWei(String(500)))
//
//     await uniswapV2Router.addLiquidityETH(
//       token.address,
//       toWei(String(500)),
//       1,
//       1,
//       userOne,
//       "1111111111111111111111"
//     , { from:userOne, value:toWei(String(500)) })
//
//     pairAddress = await uniswapV2Factory.allPairs(0)
//     pair = await UniswapV2Pair.at(pairAddress)
//
//     stakeClaim = await StakeClaim.new(
//       userOne,
//       token.address,
//       pair.address,
//       duration.days(30)
//     )
//
//     stakeNonClaim = await StakeNonClaim.new(
//       userOne,
//       token.address,
//       pair.address,
//       duration.days(30)
//     )
//
//     sale = await Sale.new(
//       token.address,
//       Beneficiary,
//       uniswapV2Router.address
//     )
//
//     fetch = await Fetch.new(
//       stakeClaim.address,
//       stakeNonClaim.address,
//       uniswapV2Router.address,
//       token.address,
//       pair.address,
//       sale.address
//     )
//
//     // add some rewards to claim stake
//     stakeClaim.setRewardsDistribution(userOne)
//     token.transfer(stakeClaim.address, toWei(String(1)))
//     stakeClaim.notifyRewardAmount(toWei(String(1)))
//
//     // add some rewards to non claim stake
//     stakeNonClaim.setRewardsDistribution(userOne)
//     token.transfer(stakeNonClaim.address, toWei(String(1)))
//     stakeNonClaim.notifyRewardAmount(toWei(String(1)))
//
//     // send some tokens to another users
//     await token.transfer(userTwo, toWei(String(1)))
//     await token.transfer(userThree, toWei(String(1)))
//
//     // make sale owner of token
//     await token.transferOwnership(sale.address)
//   }
//
//   beforeEach(async function() {
//     await deployContracts()
//   })
//
//   describe('Deposit non claim able fetch from ETH fund ', function() {
//
//   })
//
//   //END
// })
