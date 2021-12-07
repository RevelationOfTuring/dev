const fs = require('fs')

// 拼装地址和bytes32的零值
const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

// 部署工具集
class MainnetDeploymentHelper {
  constructor(configParams, deployerWallet) {
    // 一些系统配置参数（前面已介绍）
    this.configParams = configParams
    // 用于部署合约的相关交易签名
    this.deployerWallet = deployerWallet
    // 引用了hardhat
    this.hre = require("hardhat")
  }

  // 载入之前部署的合约信息
  loadPreviousDeployment() {
    let previousDeployment = {}
    // 看看那个记录部署合约信息的文件是否存在？
    if (fs.existsSync(this.configParams.OUTPUT_FILE)) {
      console.log(`Loading previous deployment...`)
      // 如果存在，将文件内的部署信息都读到出来并返回；如果不存在，直接返回空值
      previousDeployment = require('../' + this.configParams.OUTPUT_FILE)
    }

    return previousDeployment
  }

  // 保存合约部署信息
  saveDeployment(deploymentState) {
    // json格式化相关
    const deploymentStateJSON = JSON.stringify(deploymentState, null, 2)
    // 将部署信息json格式化后的字符串写到记录部署合约信息的文件中
    fs.writeFileSync(this.configParams.OUTPUT_FILE, deploymentStateJSON)

  }
  // --- Deployer methods ---
  // 输入合约名字，返回该合约的实体
  async getFactory(name) {
    const factory = await ethers.getContractFactory(name, this.deployerWallet)
    return factory
  }
  // 发交易并等待该交易上链
  async sendAndWaitForTransaction(txPromise) {
    const tx = await txPromise
    const minedTx = await ethers.provider.waitForTransaction(tx.hash, this.configParams.TX_CONFIRMATIONS)

    return minedTx
  }

  // 部署一个合约的原子性函数
  // 参数：
  //    factory: 要部署那个合约，就传入该合约的实体
  //    name: 该合约的名字，用于记录
  //    deploymentState：部署的信息。一个map，name做key，value是相关合约的信息(见loadPreviousDeployment函数)
  async loadOrDeploy(factory, name, deploymentState, params=[]) {
    if (deploymentState[name] && deploymentState[name].address) {
      // 如果deploymentState中已经包含要部署的name且value中address有值，表示该合约已经部署
      // 打印提示信息
      console.log(`Using previously deployed ${name} contract at address ${deploymentState[name].address}`)
      // 将该factory转换成ethers.js可用的Contract对象并返回
      return new ethers.Contract(
        deploymentState[name].address,
        factory.interface,
        this.deployerWallet
      );
    }

    // 如果deploymentState中不包含该合约信息，直接部署（用gas price的限制）
    const contract = await factory.deploy(...params, {gasPrice: this.configParams.GAS_PRICE})
    // 等待交易上链
    await this.deployerWallet.provider.waitForTransaction(contract.deployTransaction.hash, this.configParams.TX_CONFIRMATIONS)
    // 增添信息到deploymentState中
    deploymentState[name] = {
      // 合约地址
      address: contract.address,
      // 部署合约的交易hash
      txHash: contract.deployTransaction.hash
    }
    // deployment信息写文件
    this.saveDeployment(deploymentState)
    // 返回contract对象
    return contract
  }

  // 核心部署liquity项目合约的函数
  async deployLiquityCoreMainnet(tellorMasterAddr, deploymentState) {
    // 从合约文件载入合约实体
    const priceFeedFactory = await this.getFactory("PriceFeed")
    const sortedTrovesFactory = await this.getFactory("SortedTroves")
    const troveManagerFactory = await this.getFactory("TroveManager")
    const activePoolFactory = await this.getFactory("ActivePool")
    const stabilityPoolFactory = await this.getFactory("StabilityPool")
    const gasPoolFactory = await this.getFactory("GasPool")
    const defaultPoolFactory = await this.getFactory("DefaultPool")
    const collSurplusPoolFactory = await this.getFactory("CollSurplusPool")
    const borrowerOperationsFactory = await this.getFactory("BorrowerOperations")
    const hintHelpersFactory = await this.getFactory("HintHelpers")
    const lusdTokenFactory = await this.getFactory("LUSDToken")
    const tellorCallerFactory = await this.getFactory("TellorCaller")

    // 部署合约，并返回ether.js的contract对象。如果该合约已经部署过，那么直接返回部署过的ether.js的contract对象
    const priceFeed = await this.loadOrDeploy(priceFeedFactory, 'priceFeed', deploymentState)
    const sortedTroves = await this.loadOrDeploy(sortedTrovesFactory, 'sortedTroves', deploymentState)
    const troveManager = await this.loadOrDeploy(troveManagerFactory, 'troveManager', deploymentState)
    const activePool = await this.loadOrDeploy(activePoolFactory, 'activePool', deploymentState)
    const stabilityPool = await this.loadOrDeploy(stabilityPoolFactory, 'stabilityPool', deploymentState)
    const gasPool = await this.loadOrDeploy(gasPoolFactory, 'gasPool', deploymentState)
    const defaultPool = await this.loadOrDeploy(defaultPoolFactory, 'defaultPool', deploymentState)
    const collSurplusPool = await this.loadOrDeploy(collSurplusPoolFactory, 'collSurplusPool', deploymentState)
    const borrowerOperations = await this.loadOrDeploy(borrowerOperationsFactory, 'borrowerOperations', deploymentState)
    const hintHelpers = await this.loadOrDeploy(hintHelpersFactory, 'hintHelpers', deploymentState)
    const tellorCaller = await this.loadOrDeploy(tellorCallerFactory, 'tellorCaller', deploymentState, [tellorMasterAddr])

    // 拼装lusd的相关参数
    // lusd为liquity项目通过抵押eth借贷出的稳定币
    const lusdTokenParams = [
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    ]

    // 部署lusd的稳定币合约并返回contract对象。如果已经部署过了，直接返回contract对象
    const lusdToken = await this.loadOrDeploy(
      lusdTokenFactory,
      'lusdToken',
      deploymentState,
      lusdTokenParams
    )

    // 合约验证相关
    if (!this.configParams.ETHERSCAN_BASE_URL) {
      // 如果没有在配置中给出了etherscan的base url地址，输出提示语句
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      // 如果有配置etherscan的base url地址，验证上面已部署的合约代码
      await this.verifyContract('priceFeed', deploymentState)
      await this.verifyContract('sortedTroves', deploymentState)
      await this.verifyContract('troveManager', deploymentState)
      await this.verifyContract('activePool', deploymentState)
      await this.verifyContract('stabilityPool', deploymentState)
      await this.verifyContract('gasPool', deploymentState)
      await this.verifyContract('defaultPool', deploymentState)
      await this.verifyContract('collSurplusPool', deploymentState)
      await this.verifyContract('borrowerOperations', deploymentState)
      await this.verifyContract('hintHelpers', deploymentState)
      await this.verifyContract('tellorCaller', deploymentState, [tellorMasterAddr])
      await this.verifyContract('lusdToken', deploymentState, lusdTokenParams)
    }

    // 将已部署的合约的ether.js的contract对象封装到coreContracts变量中并返回
    const coreContracts = {
      priceFeed,
      lusdToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      borrowerOperations,
      hintHelpers,
      tellorCaller
    }
    return coreContracts
  }

  // 部署LQTY合约逻辑。LQTY为liquity项目的代币，用户可以抵押eth接待处lusd，并抵押lusd到stabilityPool中来挖lqty，然后抵押lqty又可以在LQTYStaking池来挖eth和lusd
  async deployLQTYContractsMainnet(bountyAddress, lpRewardsAddress, multisigAddress, deploymentState) {
    // 从本地合约文件中获取以下合约对象
    const lqtyStakingFactory = await this.getFactory("LQTYStaking")
    const lockupContractFactory_Factory = await this.getFactory("LockupContractFactory")
    const communityIssuanceFactory = await this.getFactory("CommunityIssuance")
    const lqtyTokenFactory = await this.getFactory("LQTYToken")

    // 利用本地获取的合约对象去部署（支持已部署载入），得到ethers.js可用的contract对象
    const lqtyStaking = await this.loadOrDeploy(lqtyStakingFactory, 'lqtyStaking', deploymentState)
    const lockupContractFactory = await this.loadOrDeploy(lockupContractFactory_Factory, 'lockupContractFactory', deploymentState)
    const communityIssuance = await this.loadOrDeploy(communityIssuanceFactory, 'communityIssuance', deploymentState)

    // 拼装lqty token合约部署时需要传入的参数
    const lqtyTokenParams = [
      communityIssuance.address,
      lqtyStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    ]
    // 部署lqty合约（支持已部署载入）
    const lqtyToken = await this.loadOrDeploy(
      lqtyTokenFactory,
      'lqtyToken',
      deploymentState,
      lqtyTokenParams
    )

    // 新部署的合约验证相关
    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract('lqtyStaking', deploymentState)
      await this.verifyContract('lockupContractFactory', deploymentState)
      await this.verifyContract('communityIssuance', deploymentState)
      await this.verifyContract('lqtyToken', deploymentState, lqtyTokenParams)
    }

    // 将这四个合约的ethers.js的contract对象封装后返回
    const LQTYContracts = {
      lqtyStaking,
      lockupContractFactory,
      communityIssuance,
      lqtyToken
    }
    return LQTYContracts
  }

  // 部署unipool
  // liquity刚上线会开启流动性挖矿，所以要部署unipool合约
  async deployUnipoolMainnet(deploymentState) {
    // 本地通过合约文件载入unipool实体
    const unipoolFactory = await this.getFactory("Unipool")
    // 部署（支持已部署载入）
    const unipool = await this.loadOrDeploy(unipoolFactory, 'unipool', deploymentState)

    // 合约验证相关
    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract('unipool', deploymentState)
    }

    // 返回unipool的ethers.js的contract实体
    return unipool
  }

  // 部署MultiTroveGetter，业务逻辑不表，部署过程同上
  async deployMultiTroveGetterMainnet(liquityCore, deploymentState) {
    const multiTroveGetterFactory = await this.getFactory("MultiTroveGetter")
    const multiTroveGetterParams = [
      liquityCore.troveManager.address,
      liquityCore.sortedTroves.address
    ]
    const multiTroveGetter = await this.loadOrDeploy(
      multiTroveGetterFactory,
      'multiTroveGetter',
      deploymentState,
      multiTroveGetterParams
    )

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract('multiTroveGetter', deploymentState, multiTroveGetterParams)
    }

    return multiTroveGetter
  }
  // --- Connector methods ---
  // 判断某合约是否已经释放ownership
  async isOwnershipRenounced(contract) {
    const owner = await contract.owner()
    return owner == ZERO_ADDRESS
  }

  // 关联各个合约（即各个合约相互将自己的地址写到其他合约的状态变量中）
  async connectCoreContractsMainnet(contracts, LQTYContracts, chainlinkProxyAddress) {
    // 获取设置好的gas price值
    const gasPrice = this.configParams.GAS_PRICE


    // 发交易设置priceFeed合约
    // 这个写法超级巧妙（||短路）。如果priceFeed已经设置完了，就不发交易了
    await this.isOwnershipRenounced(contracts.priceFeed) ||
      await this.sendAndWaitForTransaction(contracts.priceFeed.setAddresses(chainlinkProxyAddress, contracts.tellorCaller.address, {gasPrice}))

    // 发交易设置sortedTroves合约
    await this.isOwnershipRenounced(contracts.sortedTroves) ||
      await this.sendAndWaitForTransaction(contracts.sortedTroves.setParams(
        maxBytes32,
        contracts.troveManager.address,
        contracts.borrowerOperations.address, 
	{gasPrice}
      ))

    // 发交易设置troveManager合约
    await this.isOwnershipRenounced(contracts.troveManager) ||
      await this.sendAndWaitForTransaction(contracts.troveManager.setAddresses(
        contracts.borrowerOperations.address,
        contracts.activePool.address,
        contracts.defaultPool.address,
        contracts.stabilityPool.address,
        contracts.gasPool.address,
        contracts.collSurplusPool.address,
        contracts.priceFeed.address,
        contracts.lusdToken.address,
        contracts.sortedTroves.address,
        LQTYContracts.lqtyToken.address,
        LQTYContracts.lqtyStaking.address,
	{gasPrice}
      ))

    // 发交易设置borrowerOperations合约
    await this.isOwnershipRenounced(contracts.borrowerOperations) ||
      await this.sendAndWaitForTransaction(contracts.borrowerOperations.setAddresses(
        contracts.troveManager.address,
        contracts.activePool.address,
        contracts.defaultPool.address,
        contracts.stabilityPool.address,
        contracts.gasPool.address,
        contracts.collSurplusPool.address,
        contracts.priceFeed.address,
        contracts.sortedTroves.address,
        contracts.lusdToken.address,
        LQTYContracts.lqtyStaking.address,
	{gasPrice}
      ))

    // 发交易设置stabilityPool合约
    await this.isOwnershipRenounced(contracts.stabilityPool) ||
      await this.sendAndWaitForTransaction(contracts.stabilityPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.activePool.address,
        contracts.lusdToken.address,
        contracts.sortedTroves.address,
        contracts.priceFeed.address,
        LQTYContracts.communityIssuance.address,
	{gasPrice}
      ))

    // 发交易设置activePool合约
    await this.isOwnershipRenounced(contracts.activePool) ||
      await this.sendAndWaitForTransaction(contracts.activePool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.defaultPool.address,
	{gasPrice}
      ))

    // 发交易设置defaultPool合约
    await this.isOwnershipRenounced(contracts.defaultPool) ||
      await this.sendAndWaitForTransaction(contracts.defaultPool.setAddresses(
        contracts.troveManager.address,
        contracts.activePool.address,
	{gasPrice}
      ))

    // 发交易设置collSurplusPool合约
    await this.isOwnershipRenounced(contracts.collSurplusPool) ||
      await this.sendAndWaitForTransaction(contracts.collSurplusPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.activePool.address,
	{gasPrice}
      ))

    // 发交易设置hintHelpers合约
    await this.isOwnershipRenounced(contracts.hintHelpers) ||
      await this.sendAndWaitForTransaction(contracts.hintHelpers.setAddresses(
        contracts.sortedTroves.address,
        contracts.troveManager.address,
	{gasPrice}
      ))
  }

  // 单独为lockupContractFactory合约设置lqty地址
  async connectLQTYContractsMainnet(LQTYContracts) {
    const gasPrice = this.configParams.GAS_PRICE
    // 发交易设置lockupContractFactory合约（同上）
    await this.isOwnershipRenounced(LQTYContracts.lqtyStaking) ||
      await this.sendAndWaitForTransaction(LQTYContracts.lockupContractFactory.setLQTYTokenAddress(LQTYContracts.lqtyToken.address, {gasPrice}))
  }

  // 为lqtyStaking、communityIssuance合约设置相关地址
  async connectLQTYContractsToCoreMainnet(LQTYContracts, coreContracts) {
    const gasPrice = this.configParams.GAS_PRICE
    await this.isOwnershipRenounced(LQTYContracts.lqtyStaking) ||
      await this.sendAndWaitForTransaction(LQTYContracts.lqtyStaking.setAddresses(
        LQTYContracts.lqtyToken.address,
        coreContracts.lusdToken.address,
        coreContracts.troveManager.address, 
        coreContracts.borrowerOperations.address,
        coreContracts.activePool.address,
	{gasPrice}
      ))

    await this.isOwnershipRenounced(LQTYContracts.communityIssuance) ||
      await this.sendAndWaitForTransaction(LQTYContracts.communityIssuance.setAddresses(
        LQTYContracts.lqtyToken.address,
        coreContracts.stabilityPool.address,
	{gasPrice}
      ))
  }

  // 设置unipool合约相关参数
  // 设置内容：reward token是lqty、抵押lp为weth/lusq、流动性挖矿有效时长
  async connectUnipoolMainnet(uniPool, LQTYContracts, LUSDWETHPairAddr, duration) {
    const gasPrice = this.configParams.GAS_PRICE
    await this.isOwnershipRenounced(uniPool) ||
      await this.sendAndWaitForTransaction(uniPool.setParams(LQTYContracts.lqtyToken.address, LUSDWETHPairAddr, duration, {gasPrice}))
  }

  // --- Verify on Ethrescan ---
  // 在etherscan上自动验证合约代码
  async verifyContract(name, deploymentState, constructorArguments=[]) {
    if (!deploymentState[name] || !deploymentState[name].address) {
      console.error(`  --> No deployment state for contract ${name}!!`)
      return
    }
    if (deploymentState[name].verification) {
      console.log(`Contract ${name} already verified`)
      return
    }

    try {
      await this.hre.run("verify:verify", {
        address: deploymentState[name].address,
        constructorArguments,
      })
    } catch (error) {
      // if it was already verified, it’s like a success, so let’s move forward and save it
      if (error.name != 'NomicLabsHardhatPluginError') {
        console.error(`Error verifying: ${error.name}`)
        console.error(error)
        return
      }
    }

    deploymentState[name].verification = `${this.configParams.ETHERSCAN_BASE_URL}/${deploymentState[name].address}#code`

    this.saveDeployment(deploymentState)
  }

  // --- Helpers ---
  // 输出格式化函数
  async logContractObjects (contracts) {
    console.log(`Contract objects addresses:`)
    for ( const contractName of Object.keys(contracts)) {
      console.log(`${contractName}: ${contracts[contractName].address}`);
    }
  }
}

module.exports = MainnetDeploymentHelper
