import { BN, fromWei, toWei } from 'web3-utils'
import ether from './helpers/ether'
import EVMRevert from './helpers/EVMRevert'
import { duration } from './helpers/duration'
const BigNumber = BN
const timeMachine = require('ganache-time-traveler')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

// real contracts
const UniswapV2Factory = artifacts.require('./UniswapV2Factory.sol')
const UniswapV2Router = artifacts.require('./UniswapV2Router02.sol')
const UniswapV2Pair = artifacts.require('./UniswapV2Pair.sol')
const WETH = artifacts.require('./WETH9.sol')
const TOKEN = artifacts.require('./MintToken.sol')
const StakeClaim = artifacts.require('./StakeClaim.sol')
const StakeNonClaim = artifacts.require('./StakeNonClaim.sol')
const Fetch = artifacts.require('./Fetch.sol')
const Sale = artifacts.require('./Sale.sol')

const PairHash = "0x774b5e95bfc4d156d74fcd8dc28975e0343643aeb573357a038810ce46e0eb94"
const Beneficiary = "0x6ffFe11A5440fb275F30e0337Fc296f938a287a5"

let uniswapV2Factory,
    uniswapV2Router,
    weth,
    token,
    pair,
    pairAddress,
    stakeClaim,
    stakeNonClaim,
    fetch,
    sale


contract('Fetch-test', function([userOne, userTwo, userThree]) {

  async function deployContracts(){
    // deploy contracts
    uniswapV2Factory = await UniswapV2Factory.new(userOne)
    weth = await WETH.new()
    uniswapV2Router = await UniswapV2Router.new(uniswapV2Factory.address, weth.address)
    token = await TOKEN.new(toWei(String(100000)))

    // add token liquidity
    await token.approve(uniswapV2Router.address, toWei(String(500)))

    await uniswapV2Router.addLiquidityETH(
      token.address,
      toWei(String(500)),
      1,
      1,
      userOne,
      "1111111111111111111111"
    , { from:userOne, value:toWei(String(500)) })

    pairAddress = await uniswapV2Factory.allPairs(0)
    pair = await UniswapV2Pair.at(pairAddress)

    stakeClaim = await StakeClaim.new(
      userOne,
      token.address,
      pair.address,
      duration.days(30)
    )

    stakeNonClaim = await StakeNonClaim.new(
      userOne,
      token.address,
      pair.address,
      duration.days(30)
    )

    sale = await Sale.new(
      token.address,
      Beneficiary,
      uniswapV2Router.address
    )

    fetch = await Fetch.new(
      stakeClaim.address,
      stakeNonClaim.address,
      uniswapV2Router.address,
      token.address,
      pair.address,
      sale.address
    )

    // add some rewards to claim stake
    stakeClaim.setRewardsDistribution(userOne)
    token.transfer(stakeClaim.address, toWei(String(1)))
    stakeClaim.notifyRewardAmount(toWei(String(1)))

    // add some rewards to non claim stake
    stakeNonClaim.setRewardsDistribution(userOne)
    token.transfer(stakeNonClaim.address, toWei(String(1)))
    stakeNonClaim.notifyRewardAmount(toWei(String(1)))

    // send some tokens to another users
    await token.transfer(userTwo, toWei(String(1)))
    await token.transfer(userThree, toWei(String(1)))

    // make sale owner of token
    await token.transferOwnership(sale.address)
  }

  beforeEach(async function() {
    await deployContracts()
  })

  describe('INIT', function() {
    it('PairHash correct', async function() {
      assert.equal(
        String(await uniswapV2Factory.pairCodeHash()).toLowerCase(),
        String(PairHash).toLowerCase(),
      )
    })

    it('Factory in Router correct', async function() {
      assert.equal(
        String(await uniswapV2Router.factory()).toLowerCase(),
        String(uniswapV2Factory.address).toLowerCase(),
      )
    })

    it('WETH in Router correct', async function() {
      assert.equal(
        String(await uniswapV2Router.WETH()).toLowerCase(),
        String(weth.address).toLowerCase(),
      )
    })

    it('Correct init token supply', async function() {
      assert.equal(
        await token.totalSupply(),
        toWei(String(100000)),
      )
    })

    it('Correct init claim Stake', async function() {
      assert.equal(await stakeClaim.rewardsToken(), token.address)
      assert.equal(await stakeClaim.stakingToken(), pair.address)
    })

    it('Correct init non claim Stake', async function() {
      assert.equal(await stakeNonClaim.rewardsToken(), token.address)
      assert.equal(await stakeNonClaim.stakingToken(), pair.address)
    })

    it('Correct init token sale', async function() {
      assert.equal(await sale.token(), token.address)
      assert.equal(await sale.beneficiary(), Beneficiary)
      assert.equal(await sale.Router(), uniswapV2Router.address)
    })

    it('token should be added in LD DEX', async function() {
      assert.equal(await pair.totalSupply(), toWei(String(500)))
    })
  })

  describe('token', function() {
    it('Can be burned', async function() {
      assert.equal(Number(await token.totalSupply()), toWei(String(100000)))
      await token.burn(toWei(String(50000)))
      assert.equal(Number(await token.totalSupply()), toWei(String(50000)))
    })
  })

  describe('CLAIM ABLE token fetch WITH DEPOSIT WITH token', function() {
    it('Convert input to pool and stake via token fetch and fetch send all shares and remains back to user', async function() {
      // user two not hold any pool before deposit
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // stake don't have any pool yet
      assert.equal(Number(await pair.balanceOf(stakeClaim.address)), 0)
      // approve token
      await token.approve(fetch.address, toWei(String(0.1)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(true, toWei(String(0.1)), { from:userTwo, value:toWei(String(0.1)) })
      // fetch send all pool
      assert.equal(Number(await pair.balanceOf(fetch.address)), 0)
      // fetch send all shares
      assert.equal(Number(await stakeClaim.balanceOf(fetch.address)), 0)
      // fetch send all ETH remains
      assert.equal(Number(await web3.eth.getBalance(fetch.address)), 0)
      // fetch send all WETH remains
      assert.equal(Number(await weth.balanceOf(fetch.address)), 0)
      // fetch send all token
      assert.equal(Number(await token.balanceOf(fetch.address)), 0)
      // stake should receive pool
      assert.notEqual(Number(await pair.balanceOf(stakeClaim.address)), 0)
      // user should receive token shares
      assert.notEqual(Number(await stakeClaim.balanceOf(userTwo)), 0)
    })

    it('User can withdraw converted pool via fetch from vault', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // approve token
      await token.approve(fetch.address, toWei(String(0.1)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(true, toWei(String(0.1)), { from:userTwo, value:toWei(String(0.1)) })
      // shares should be equal to pool depsoit
      const staked = await pair.balanceOf(stakeClaim.address)
      const shares = await stakeClaim.balanceOf(userTwo)
      // staked and shares should be equal
      assert.equal(Number(shares), Number(staked))
      // withdraw
      await stakeClaim.withdraw(shares, { from:userTwo })
      // vault should burn shares
      assert.equal(await stakeClaim.balanceOf(userTwo), 0)
      // stake send all tokens
      assert.equal(Number(await pair.balanceOf(stakeClaim.address)), 0)
      // vault should send user token
      assert.equal(
        Number(await pair.balanceOf(userTwo)),
        Number(staked)
      )
    })

    it('User claim correct rewards and pool amount after exit', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // approve token
      await token.approve(fetch.address, toWei(String(0.1)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(true, toWei(String(0.1)), { from:userTwo, value:toWei(String(0.1)) })
      // get staked amount
      const staked = await pair.balanceOf(stakeClaim.address)
      // staked should be more than 0
      assert.isTrue(staked > 0)
      // clear user balance
      await token.transfer(userOne, await token.balanceOf(userTwo), {from:userTwo})
      assert.equal(await token.balanceOf(userTwo), 0)

      await timeMachine.advanceTimeAndBlock(duration.days(31))
      // estimate rewards
      const estimateReward = await stakeClaim.earned(userTwo)
      // get user shares
      const shares = await stakeClaim.balanceOf(userTwo)
      // withdraw
      await stakeClaim.exit({ from:userTwo })
      // user should get reward
      assert.equal(Number(await token.balanceOf(userTwo)), Number(estimateReward))
      // user get pool
      assert.equal(Number(await pair.balanceOf(userTwo)), staked)
      // stake send all address
      assert.equal(Number(await pair.balanceOf(stakeClaim.address)), 0)
    })

    it('Claim rewards calculates correct for a few users after exit ', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)

      // deposit form user 2
      // approve token
      await token.approve(fetch.address, toWei(String(0.1)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(true, toWei(String(0.1)), { from:userTwo, value:toWei(String(0.1)) })
      // clear user 2 balance
      await token.transfer(userOne, await token.balanceOf(userTwo), {from:userTwo})
      assert.equal(await token.balanceOf(userTwo), 0)

      // deposit form user 3
      // approve token
      await token.approve(fetch.address, toWei(String(0.1)), { from:userThree })
      // deposit
      await fetch.depositETHAndERC20(true, toWei(String(0.1)), { from:userThree, value:toWei(String(0.1)) })
      // clear user 3 balance
      await token.transfer(userOne, await token.balanceOf(userThree), {from:userThree})
      assert.equal(await token.balanceOf(userThree), 0)

      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(31))

      // estimate rewards
      const estimateRewardTwo = await stakeClaim.earned(userTwo)
      const estimateRewardThree = await stakeClaim.earned(userThree)

      assert.isTrue(estimateRewardTwo > toWei(String(0.49)))
      assert.isTrue(estimateRewardThree > toWei(String(0.49)))

      // withdraw
      await stakeClaim.exit({ from:userTwo })
      await stakeClaim.exit({ from:userThree })

      // users should get reward
      assert.equal(Number(await token.balanceOf(userTwo)), Number(estimateRewardTwo))
      assert.equal(Number(await token.balanceOf(userThree)), Number(estimateRewardThree))
    })

    it('token fetch can handle big deposit and after this users can continue do many small deposits ', async function() {
      // user 1 not hold any shares
      assert.equal(Number(await stakeClaim.balanceOf(userOne)), 0)
      // deposit form user 1
      // approve token
      await token.approve(fetch.address, toWei(String(500)), { from:userOne })
      // deposit
      await fetch.depositETHAndERC20(true, toWei(String(500)), { from:userOne, value:toWei(String(500)) })
      // user 1 get shares
      assert.notEqual(Number(await stakeClaim.balanceOf(userOne)), 0)

      // user 2 not hold any shares
      assert.equal(Number(await stakeClaim.balanceOf(userTwo)), 0)
      // deposit form user 2
      // approve token
      await token.approve(fetch.address, toWei(String(0.001)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(true, toWei(String(0.001)), { from:userTwo, value:toWei(String(0.001)) })
      // user 2 get shares
      assert.notEqual(Number(await stakeClaim.balanceOf(userTwo)), 0)
    })

    it('token fetch can handle many deposits ', async function() {
      // approve token
      await token.approve(fetch.address, toWei(String(100)), { from:userOne })

      for(let i=0; i<100;i++){
        const sharesBefore = Number(await stakeClaim.balanceOf(userOne))
        await fetch.depositETHAndERC20(true, toWei(String(0.01)), { from:userOne, value:toWei(String(0.01)) })
        assert.isTrue(
          Number(await stakeClaim.balanceOf(userOne)) > sharesBefore
        )
      }
    })
  })

  describe('NON CLAIM ABLE token fetch DEPOSIT WITH token', function() {
    it('Convert input to pool and stake via token fetch and fetch send all shares and remains back to user', async function() {
      // user two not hold any pool before deposit
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // stake don't have any pool yet
      assert.equal(Number(await pair.balanceOf(stakeNonClaim.address)), 0)
      // approve token
      await token.approve(fetch.address, toWei(String(1)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(false, toWei(String(1)), { from:userTwo, value:toWei(String(1)) })
      // fetch send all pool
      assert.equal(Number(await pair.balanceOf(fetch.address)), 0)
      // fetch send all shares
      assert.equal(Number(await stakeNonClaim.balanceOf(fetch.address)), 0)
      // fetch send all ETH remains
      assert.equal(Number(await web3.eth.getBalance(fetch.address)), 0)
      // fetch send all WETH remains
      assert.equal(Number(await weth.balanceOf(fetch.address)), 0)
      // fetch send all token
      assert.equal(Number(await token.balanceOf(fetch.address)), 0)
      // stake should receive pool
      assert.notEqual(Number(await pair.balanceOf(stakeNonClaim.address)), 0)
      // user should receive token shares
      assert.notEqual(Number(await stakeNonClaim.balanceOf(userTwo)), 0)
    })

    it('User can withdraw converted pool via fetch from vault', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // approve token
      await token.approve(fetch.address, toWei(String(1)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(false, toWei(String(1)), { from:userTwo, value:toWei(String(1)) })
      // shares should be equal to pool depsoit
      const staked = await pair.balanceOf(stakeNonClaim.address)
      const shares = await stakeNonClaim.balanceOf(userTwo)
      // staked and shares should be equal
      assert.equal(Number(shares), Number(staked))
      // withdraw
      await stakeNonClaim.withdraw(shares, { from:userTwo })
      // vault should burn shares
      assert.equal(await stakeNonClaim.balanceOf(userTwo), 0)
      // stake send all tokens
      assert.equal(Number(await pair.balanceOf(stakeNonClaim.address)), 0)
      // vault should send user token
      assert.equal(
        Number(await pair.balanceOf(userTwo)),
        Number(staked)
      )
    })

    it('User CAN NOT claim until stake not finished', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // approve token
      await token.approve(fetch.address, toWei(String(1)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(false, toWei(String(1)), { from:userTwo, value:toWei(String(1)) })
      // clear user balance
      await token.transfer(userOne, await token.balanceOf(userTwo), {from:userTwo})
      assert.equal(await token.balanceOf(userTwo), 0)

      await timeMachine.advanceTimeAndBlock(duration.days(15))
      // estimate rewards
      const estimateReward = await stakeNonClaim.earned(userTwo)
      assert.isTrue(estimateReward > 0)
      // get user shares
      const shares = await stakeNonClaim.balanceOf(userTwo)
      // withdraw
      await stakeNonClaim.exit({ from:userTwo })
      .should.be.rejectedWith(EVMRevert)
      // user should get reward
      assert.equal(Number(await token.balanceOf(userTwo)), 0)
    })

    it('User claim correct rewards amount after exit and get correct pool amount back ', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // approve token
      await token.approve(fetch.address, toWei(String(1)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(false, toWei(String(1)), { from:userTwo, value:toWei(String(1)) })
      // get staked amount
      const staked = await pair.balanceOf(stakeNonClaim.address)
      // staked should be more than 0
      assert.isTrue(staked > 0)
      // clear user balance
      await token.transfer(userOne, await token.balanceOf(userTwo), {from:userTwo})
      assert.equal(await token.balanceOf(userTwo), 0)

      await timeMachine.advanceTimeAndBlock(duration.days(31))
      // estimate rewards
      const estimateReward = await stakeNonClaim.earned(userTwo)
      assert.isTrue(estimateReward > 0)
      // get user shares
      const shares = await stakeNonClaim.balanceOf(userTwo)
      // withdraw
      await stakeNonClaim.exit({ from:userTwo })
      // user should get reward
      assert.equal(Number(await token.balanceOf(userTwo)), Number(estimateReward))
      // user get pool
      assert.equal(Number(await pair.balanceOf(userTwo)), staked)
      // stake send all address
      assert.equal(Number(await pair.balanceOf(stakeNonClaim.address)), 0)
    })

    it('Claim rewards calculates correct for a few users after exit ', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)

      // deposit form user 2
      // approve token
      await token.approve(fetch.address, toWei(String(1)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(false, toWei(String(1)), { from:userTwo, value:toWei(String(1)) })
      // clear user 2 balance
      await token.transfer(userOne, await token.balanceOf(userTwo), {from:userTwo})
      assert.equal(await token.balanceOf(userTwo), 0)

      // deposit form user 3
      // approve token
      await token.approve(fetch.address, toWei(String(1)), { from:userThree })
      // deposit
      await fetch.depositETHAndERC20(false, toWei(String(1)), { from:userThree, value:toWei(String(1)) })
      // clear user 3 balance
      await token.transfer(userOne, await token.balanceOf(userThree), {from:userThree})
      assert.equal(await token.balanceOf(userThree), 0)

      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(31))

      // estimate rewards
      const estimateRewardTwo = await stakeNonClaim.earned(userTwo)
      const estimateRewardThree = await stakeNonClaim.earned(userThree)

      // check rewards
      assert.isTrue(estimateRewardTwo > toWei(String(0.49)))
      assert.isTrue(estimateRewardThree > toWei(String(0.49)))

      // withdraw
      await stakeNonClaim.exit({ from:userTwo })
      await stakeNonClaim.exit({ from:userThree })

      // users should get reward
      assert.equal(Number(await token.balanceOf(userTwo)), Number(estimateRewardTwo))
      assert.equal(Number(await token.balanceOf(userThree)), Number(estimateRewardThree))
    })

    it('token fetch can handle big deposit and after this users can continue do many small deposits ', async function() {
      // user 1 not hold any shares
      assert.equal(Number(await stakeNonClaim.balanceOf(userOne)), 0)
      // deposit form user 1
      await token.approve(fetch.address, toWei(String(500)), { from:userOne })
      // deposit
      await fetch.depositETHAndERC20(false, toWei(String(500)), { from:userOne, value:toWei(String(500)) })
      // user 1 get shares
      assert.notEqual(Number(await stakeNonClaim.balanceOf(userOne)), 0)

      // user 2 not hold any shares
      assert.equal(Number(await stakeNonClaim.balanceOf(userTwo)), 0)
      // deposit form user 2
      await token.approve(fetch.address, toWei(String(0.01)), { from:userTwo })
      // deposit
      await fetch.depositETHAndERC20(false, toWei(String(0.01)), { from:userTwo, value:toWei(String(0.01)) })
      // user 2 get shares
      assert.notEqual(Number(await stakeNonClaim.balanceOf(userTwo)), 0)
    })

    it('token fetch can handle many deposits ', async function() {
      await token.approve(fetch.address, toWei(String(100)), { from:userOne })
      for(let i=0; i<100;i++){
        const sharesBefore = Number(await stakeNonClaim.balanceOf(userOne))
        await fetch.depositETHAndERC20(false, toWei(String(0.01)), { from:userOne, value:toWei(String(0.01)) })
        assert.isTrue(
          Number(await stakeNonClaim.balanceOf(userOne)) > sharesBefore
        )
      }
    })
  })

  describe('CLAIM ABLE token fetch DEPOSIT ONLY BNB', function() {
    it('Convert input to pool and stake via token fetch and fetch send all shares and remains back to user', async function() {
      // user two not hold any pool before deposit
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // stake don't have any pool yet
      assert.equal(Number(await pair.balanceOf(stakeClaim.address)), 0)
      // deposit
      await fetch.deposit(true, { from:userTwo, value:toWei(String(1)) })
      // fetch send all pool
      assert.equal(Number(await pair.balanceOf(fetch.address)), 0)
      // fetch send all shares
      assert.equal(Number(await stakeClaim.balanceOf(fetch.address)), 0)
      // fetch send all ETH remains
      assert.equal(Number(await web3.eth.getBalance(fetch.address)), 0)
      // fetch send all WETH remains
      assert.equal(Number(await weth.balanceOf(fetch.address)), 0)
      // fetch send all token
      assert.equal(Number(await token.balanceOf(fetch.address)), 0)
      // stake should receive pool
      assert.notEqual(Number(await pair.balanceOf(stakeClaim.address)), 0)
      // user should receive token shares
      assert.notEqual(Number(await stakeClaim.balanceOf(userTwo)), 0)
    })

    it('User can withdraw converted pool via fetch from vault', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // deposit
      await fetch.deposit(true, { from:userTwo, value:toWei(String(1)) })
      // shares should be equal to pool depsoit
      const staked = await pair.balanceOf(stakeClaim.address)
      const shares = await stakeClaim.balanceOf(userTwo)
      // staked and shares should be equal
      assert.equal(Number(shares), Number(staked))
      // withdraw
      await stakeClaim.withdraw(shares, { from:userTwo })
      // vault should burn shares
      assert.equal(await stakeClaim.balanceOf(userTwo), 0)
      // stake send all tokens
      assert.equal(Number(await pair.balanceOf(stakeClaim.address)), 0)
      // vault should send user token
      assert.equal(
        Number(await pair.balanceOf(userTwo)),
        Number(staked)
      )
    })

    it('User claim correct rewards and pool amount after exit', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // deposit
      await fetch.deposit(true, { from:userTwo, value:toWei(String(1)) })
      // get staked amount
      const staked = await pair.balanceOf(stakeClaim.address)
      // staked should be more than 0
      assert.isTrue(staked > 0)
      // clear user balance
      await token.transfer(userOne, await token.balanceOf(userTwo), {from:userTwo})
      assert.equal(await token.balanceOf(userTwo), 0)

      await timeMachine.advanceTimeAndBlock(duration.days(31))
      // estimate rewards
      const estimateReward = await stakeClaim.earned(userTwo)
      // get user shares
      const shares = await stakeClaim.balanceOf(userTwo)
      // withdraw
      await stakeClaim.exit({ from:userTwo })
      // user should get reward
      assert.equal(Number(await token.balanceOf(userTwo)), Number(estimateReward))
      // user get pool
      assert.equal(Number(await pair.balanceOf(userTwo)), staked)
      // stake send all address
      assert.equal(Number(await pair.balanceOf(stakeClaim.address)), 0)
    })

    it('Claim rewards calculates correct for a few users after exit ', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)

      // deposit form user 2
      await fetch.deposit(true, { from:userTwo, value:toWei(String(1)) })
      // clear user 2 balance
      await token.transfer(userOne, await token.balanceOf(userTwo), {from:userTwo})
      assert.equal(await token.balanceOf(userTwo), 0)

      // deposit form user 3
      await fetch.deposit(true, { from:userThree, value:toWei(String(1)) })
      // clear user 3 balance
      await token.transfer(userOne, await token.balanceOf(userThree), {from:userThree})
      assert.equal(await token.balanceOf(userThree), 0)

      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(31))

      // estimate rewards
      const estimateRewardTwo = await stakeClaim.earned(userTwo)
      const estimateRewardThree = await stakeClaim.earned(userThree)

      // check rewards
      assert.isTrue(estimateRewardTwo > toWei(String(0.5)))
      assert.isTrue(estimateRewardThree > toWei(String(0.49)))

      // withdraw
      await stakeClaim.exit({ from:userTwo })
      await stakeClaim.exit({ from:userThree })

      // users should get reward
      assert.equal(Number(await token.balanceOf(userTwo)), Number(estimateRewardTwo))
      assert.equal(Number(await token.balanceOf(userThree)), Number(estimateRewardThree))
    })

    it('token fetch can handle big deposit and after this users can continue do many small deposits ', async function() {
      // user 1 not hold any shares
      assert.equal(Number(await stakeClaim.balanceOf(userOne)), 0)
      // deposit form user 1
      await fetch.deposit(true, { from:userOne, value:toWei(String(500)) })
      // user 1 get shares
      assert.notEqual(Number(await stakeClaim.balanceOf(userOne)), 0)

      // user 2 not hold any shares
      assert.equal(Number(await stakeClaim.balanceOf(userTwo)), 0)
      // deposit form user 2
      await fetch.deposit(true, { from:userTwo, value:toWei(String(0.001)) })
      // user 2 get shares
      assert.notEqual(Number(await stakeClaim.balanceOf(userTwo)), 0)
    })

    it('token fetch can handle many deposits ', async function() {
      for(let i=0; i<100;i++){
        const sharesBefore = Number(await stakeClaim.balanceOf(userOne))
        await fetch.deposit(true, { from:userOne, value:toWei(String(0.01)) })
        assert.isTrue(
          Number(await stakeClaim.balanceOf(userOne)) > sharesBefore
        )
      }
    })
  })

  describe('NON CLAIM ABLE token fetch DEPOSIT ONLY BNB', function() {
    it('Convert input to pool and stake via token fetch and fetch send all shares and remains back to user', async function() {
      // user two not hold any pool before deposit
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // stake don't have any pool yet
      assert.equal(Number(await pair.balanceOf(stakeNonClaim.address)), 0)
      // deposit
      await fetch.deposit(false, { from:userTwo, value:toWei(String(1)) })
      // fetch send all pool
      assert.equal(Number(await pair.balanceOf(fetch.address)), 0)
      // fetch send all shares
      assert.equal(Number(await stakeNonClaim.balanceOf(fetch.address)), 0)
      // fetch send all ETH remains
      assert.equal(Number(await web3.eth.getBalance(fetch.address)), 0)
      // fetch send all WETH remains
      assert.equal(Number(await weth.balanceOf(fetch.address)), 0)
      // fetch send all token
      assert.equal(Number(await token.balanceOf(fetch.address)), 0)
      // stake should receive pool
      assert.notEqual(Number(await pair.balanceOf(stakeNonClaim.address)), 0)
      // user should receive token shares
      assert.notEqual(Number(await stakeNonClaim.balanceOf(userTwo)), 0)
    })

    it('User can withdraw converted pool via fetch from vault', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // deposit
      await fetch.deposit(false, { from:userTwo, value:toWei(String(1)) })
      // shares should be equal to pool depsoit
      const staked = await pair.balanceOf(stakeNonClaim.address)
      const shares = await stakeNonClaim.balanceOf(userTwo)
      // staked and shares should be equal
      assert.equal(Number(shares), Number(staked))
      // withdraw
      await stakeNonClaim.withdraw(shares, { from:userTwo })
      // vault should burn shares
      assert.equal(await stakeNonClaim.balanceOf(userTwo), 0)
      // stake send all tokens
      assert.equal(Number(await pair.balanceOf(stakeNonClaim.address)), 0)
      // vault should send user token
      assert.equal(
        Number(await pair.balanceOf(userTwo)),
        Number(staked)
      )
    })

    it('User CAN NOT claim until stake not finished', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // deposit
      await fetch.deposit(false, { from:userTwo, value:toWei(String(1)) })
      // clear user balance
      await token.transfer(userOne, await token.balanceOf(userTwo), {from:userTwo})
      assert.equal(await token.balanceOf(userTwo), 0)

      await timeMachine.advanceTimeAndBlock(duration.days(15))
      // estimate rewards
      const estimateReward = await stakeNonClaim.earned(userTwo)
      assert.isTrue(estimateReward > 0)
      // get user shares
      const shares = await stakeNonClaim.balanceOf(userTwo)
      // withdraw
      await stakeNonClaim.exit({ from:userTwo })
      .should.be.rejectedWith(EVMRevert)
      // user should get reward
      assert.equal(Number(await token.balanceOf(userTwo)), 0)
    })

    it('User claim correct rewards amount after exit and get correct pool amount back ', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)
      // deposit
      await fetch.deposit(false, { from:userTwo, value:toWei(String(1)) })
      // get staked amount
      const staked = await pair.balanceOf(stakeNonClaim.address)
      // staked should be more than 0
      assert.isTrue(staked > 0)
      // clear user balance
      await token.transfer(userOne, await token.balanceOf(userTwo), {from:userTwo})
      assert.equal(await token.balanceOf(userTwo), 0)

      await timeMachine.advanceTimeAndBlock(duration.days(31))
      // estimate rewards
      const estimateReward = await stakeNonClaim.earned(userTwo)
      assert.isTrue(estimateReward > 0)
      // get user shares
      const shares = await stakeNonClaim.balanceOf(userTwo)
      // withdraw
      await stakeNonClaim.exit({ from:userTwo })
      // user should get reward
      assert.equal(Number(await token.balanceOf(userTwo)), Number(estimateReward))
      // user get pool
      assert.equal(Number(await pair.balanceOf(userTwo)), staked)
      // stake send all address
      assert.equal(Number(await pair.balanceOf(stakeNonClaim.address)), 0)
    })

    it('Claim rewards calculates correct for a few users after exit ', async function() {
      // user not hold any pool
      assert.equal(Number(await pair.balanceOf(userTwo)), 0)

      // deposit form user 2
      await fetch.deposit(false, { from:userTwo, value:toWei(String(1)) })
      // clear user 2 balance
      await token.transfer(userOne, await token.balanceOf(userTwo), {from:userTwo})
      assert.equal(await token.balanceOf(userTwo), 0)

      // deposit form user 3
      await fetch.deposit(false, { from:userThree, value:toWei(String(1)) })
      // clear user 3 balance
      await token.transfer(userOne, await token.balanceOf(userThree), {from:userThree})
      assert.equal(await token.balanceOf(userThree), 0)

      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(31))

      // estimate rewards
      const estimateRewardTwo = await stakeNonClaim.earned(userTwo)
      const estimateRewardThree = await stakeNonClaim.earned(userThree)

      // check rewards
      assert.isTrue(estimateRewardTwo > toWei(String(0.5)))
      assert.isTrue(estimateRewardThree > toWei(String(0.49)))

      // withdraw
      await stakeNonClaim.exit({ from:userTwo })
      await stakeNonClaim.exit({ from:userThree })

      // users should get reward
      assert.equal(Number(await token.balanceOf(userTwo)), Number(estimateRewardTwo))
      assert.equal(Number(await token.balanceOf(userThree)), Number(estimateRewardThree))
    })

    it('token fetch can handle big deposit and after this users can continue do many small deposits ', async function() {
      // user 1 not hold any shares
      assert.equal(Number(await stakeNonClaim.balanceOf(userOne)), 0)
      // deposit form user 1
      await fetch.deposit(false, { from:userOne, value:toWei(String(500)) })
      // user 1 get shares
      assert.notEqual(Number(await stakeNonClaim.balanceOf(userOne)), 0)

      // user 2 not hold any shares
      assert.equal(Number(await stakeNonClaim.balanceOf(userTwo)), 0)
      // deposit form user 2
      await fetch.deposit(false, { from:userTwo, value:toWei(String(0.001)) })
      // user 2 get shares
      assert.notEqual(Number(await stakeNonClaim.balanceOf(userTwo)), 0)
    })

    it('token fetch can handle many deposits ', async function() {
      for(let i=0; i<100;i++){
        const sharesBefore = Number(await stakeNonClaim.balanceOf(userOne))
        await fetch.deposit(false, { from:userOne, value:toWei(String(0.01)) })
        assert.isTrue(
          Number(await stakeNonClaim.balanceOf(userOne)) > sharesBefore
        )
      }
    })
  })

  describe('token fetch split deposit to sale and pool by LD depth (CLAIM ABLE AND NON CLAIM ABLE STAKE)', function() {
    it('(CLAIM ABLE) Sale should receive 5% if LD > 1000 and 50% if LD > 12000 ', async function() {
      // deposit
      let balanceBefore = await web3.eth.getBalance(Beneficiary)
      await fetch.deposit(true, { from:userTwo, value:toWei(String(1)) })
      // balance of sale beneficiary should be the same (because no LD trigger)
      assert.equal(await web3.eth.getBalance(Beneficiary), balanceBefore)

      await token.approve(uniswapV2Router.address, toWei(String(501)))
      await uniswapV2Router.addLiquidityETH(
        token.address,
        toWei(String(501)),
        1,
        1,
        userOne,
        "1111111111111111111111"
      , { from:userOne, value:toWei(String(501))
      })

      // reset
      balanceBefore = 0

      balanceBefore = await web3.eth.getBalance(Beneficiary)
      await fetch.deposit(true, { from:userTwo, value:toWei(String(1)) })
      // balance of sale beneficiary should be more now
      assert.notEqual(await web3.eth.getBalance(Beneficiary), balanceBefore)

      // should send 5% of input split to sale
      assert.equal(
        Number(await web3.eth.getBalance(Beneficiary)) - Number(balanceBefore),
        Number(toWei(String(1))) * 505 / 1000 / 100 * 5
      )


      await token.approve(uniswapV2Router.address, toWei(String(12000)))
      await uniswapV2Router.addLiquidityETH(
        token.address,
        toWei(String(12000)),
        1,
        1,
        userOne,
        "1111111111111111111111"
      , { from:userOne, value:toWei(String(12000))
      })

      // reset
      balanceBefore = 0

      balanceBefore = await web3.eth.getBalance(Beneficiary)
      await fetch.deposit(true, { from:userTwo, value:toWei(String(1)) })
      // balance of sale beneficiary should be more now
      assert.notEqual(await web3.eth.getBalance(Beneficiary), balanceBefore)

      // should send 50% of input split to sale
      assert.equal(
        Number(await web3.eth.getBalance(Beneficiary)) - Number(balanceBefore),
        Number(toWei(String(1))) * 505 / 1000 / 100 * 50
      )
    })

    it('(CLAIM ABLE) Sale support many small deposits if was LD triggered and also after big deposit', async function() {
      // deposit
      let balanceBefore = await web3.eth.getBalance(Beneficiary)
      await fetch.deposit(true, { from:userTwo, value:toWei(String(1)) })
      // balance of sale beneficiary should be the same (because no LD trigger)
      assert.equal(await web3.eth.getBalance(Beneficiary), balanceBefore)

      await token.approve(uniswapV2Router.address, toWei(String(3001)))
      await uniswapV2Router.addLiquidityETH(
        token.address,
        toWei(String(3001)),
        1,
        1,
        userOne,
        "1111111111111111111111"
      , { from:userOne, value:toWei(String(3001))
      })

      // reset
      balanceBefore = 0

      balanceBefore = await web3.eth.getBalance(Beneficiary)
      await fetch.deposit(true, { from:userTwo, value:toWei(String(1)) })
      // balance of sale beneficiary should be more now
      assert.notEqual(await web3.eth.getBalance(Beneficiary), balanceBefore)

      // should send 10% of input split to sale
      assert.equal(
        Number(await web3.eth.getBalance(Beneficiary)) - Number(balanceBefore),
        Number(toWei(String(1))) * 505 / 1000 / 100 * 10
      )

      await fetch.deposit(true, { from:userTwo, value:toWei(String(500)) })
      // user two should receive shares
      assert.notEqual(await stakeClaim.balanceOf(userTwo), 0)

      for(let i=0; i<100;i++){
        const beneficiaryBalanceBefore = Number(await web3.eth.getBalance(Beneficiary))
        const sharesBefore = Number(await stakeClaim.balanceOf(userOne))
        await fetch.deposit(true, { from:userOne, value:toWei(String(0.01)) })
        // user get new shares
        assert.isTrue(
          Number(await stakeClaim.balanceOf(userOne)) > sharesBefore
        )
        // sale beneficiary get new eth
        assert.isTrue(
          Number(await web3.eth.getBalance(Beneficiary)) > beneficiaryBalanceBefore
        )
      }
    })
  })
  //END
})
