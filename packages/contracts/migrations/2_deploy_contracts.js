// Truffle migration script for deployment to Ganache

// 需要部署的各个合约的实例化
const SortedTroves = artifacts.require("./SortedTroves.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const StabilityPool = artifacts.require("./StabilityPool.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const LUSDToken = artifacts.require("./LUSDToken.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

// 从../utils/truffleDeploymentHelpers.js文件中读取一些功能函数
const deploymentHelpers = require("../utils/truffleDeploymentHelpers.js")

// getAddresses函数，结构传入参数，并将各个已部署的合约的地址都取出并结构化返回
const getAddresses = deploymentHelpers.getAddresses
// connectContracts函数，关联各个合约（即相互写地址）
const connectContracts = deploymentHelpers.connectContracts

// 部署脚本的入口
module.exports = function(deployer) {
  // 部署各个合约
  deployer.deploy(BorrowerOperations)
  deployer.deploy(PriceFeed)
  deployer.deploy(SortedTroves)
  deployer.deploy(TroveManager)
  deployer.deploy(ActivePool)
  deployer.deploy(StabilityPool)
  deployer.deploy(DefaultPool)
  deployer.deploy(LUSDToken)
  deployer.deploy(FunctionCaller)

  deployer.then(async () => {
    // 确保以上9个合约都已经部署上链
    const borrowerOperations = await BorrowerOperations.deployed()
    const priceFeed = await PriceFeed.deployed()
    const sortedTroves = await SortedTroves.deployed()
    const troveManager = await TroveManager.deployed()
    const activePool = await ActivePool.deployed()
    const stabilityPool = await StabilityPool.deployed()
    const defaultPool = await DefaultPool.deployed()
    const lusdToken = await LUSDToken.deployed()
    const functionCaller = await FunctionCaller.deployed()

    // 将9个合约实体封装成一个变量体（便于函数间传参）
    const liquityContracts = {
      borrowerOperations,
      priceFeed,
      lusdToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      defaultPool,
      functionCaller
    }

    // 获取所有已部署合约地址，结构化到变量liquityAddresses中
    const liquityAddresses = getAddresses(liquityContracts)
    // 打印输出
    console.log('deploy_contracts.js - Deployed contract addresses: \n')
    console.log(liquityAddresses)
    console.log('\n')

    // 调用各个合约的写函数，set进相互的地址
    await connectContracts(liquityContracts, liquityAddresses)
  })
}
