
const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const LUSDToken = artifacts.require("./LUSDToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deployLiquity = async () => {
  const priceFeedTestnet = await PriceFeedTestnet.new()
  const sortedTroves = await SortedTroves.new()
  const troveManager = await TroveManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const lusdToken = await LUSDToken.new(
    troveManager.address,
    stabilityPool.address,
    borrowerOperations.address
  )
  DefaultPool.setAsDeployed(defaultPool)
  PriceFeedTestnet.setAsDeployed(priceFeedTestnet)
  LUSDToken.setAsDeployed(lusdToken)
  SortedTroves.setAsDeployed(sortedTroves)
  TroveManager.setAsDeployed(troveManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  FunctionCaller.setAsDeployed(functionCaller)
  BorrowerOperations.setAsDeployed(borrowerOperations)

  const contracts = {
    priceFeedTestnet,
    lusdToken,
    sortedTroves,
    troveManager,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller,
    borrowerOperations
  }
  return contracts
}

// 结构传入参数，取出各个已部署合约的地址并结构化返回
const getAddresses = (contracts) => {
  return {
    BorrowerOperations: contracts.borrowerOperations.address,
    PriceFeedTestnet: contracts.priceFeedTestnet.address,
    LUSDToken: contracts.lusdToken.address,
    SortedTroves: contracts.sortedTroves.address,
    TroveManager: contracts.troveManager.address,
    StabilityPool: contracts.stabilityPool.address,
    ActivePool: contracts.activePool.address,
    DefaultPool: contracts.defaultPool.address,
    FunctionCaller: contracts.functionCaller.address
  }
}

// 调用各个已部署的合约，并调用他们里面的一些写函数，将其他交互合约的地址set进去。即关联各个合约。
const connectContracts = async (contracts, addresses) => {
  // TroveManager合约地址写进SortedTroves合约
  await contracts.sortedTroves.setTroveManager(addresses.TroveManager)

  // set contract addresses in the FunctionCaller 
  await contracts.functionCaller.setTroveManagerAddress(addresses.TroveManager)
  await contracts.functionCaller.setSortedTrovesAddress(addresses.SortedTroves)

  // TroveManager合约地址写进PriceFeed合约
  await contracts.priceFeedTestnet.setTroveManagerAddress(addresses.TroveManager)

  // 设置TroveManager合约（诸多地址，通过调用TroveManager合约的写函数设置）
  await contracts.troveManager.setLUSDToken(addresses.LUSDToken)
  await contracts.troveManager.setSortedTroves(addresses.SortedTroves)
  await contracts.troveManager.setPriceFeed(addresses.PriceFeedTestnet)
  await contracts.troveManager.setActivePool(addresses.ActivePool)
  await contracts.troveManager.setDefaultPool(addresses.DefaultPool)
  await contracts.troveManager.setStabilityPool(addresses.StabilityPool)
  await contracts.troveManager.setBorrowerOperations(addresses.BorrowerOperations)

  // 设置BorrowerOperations合约（诸多地址，通过调用BorrowerOperations合约的写函数设置）
  await contracts.borrowerOperations.setSortedTroves(addresses.SortedTroves)
  await contracts.borrowerOperations.setPriceFeed(addresses.PriceFeedTestnet)
  await contracts.borrowerOperations.setActivePool(addresses.ActivePool)
  await contracts.borrowerOperations.setDefaultPool(addresses.DefaultPool)
  await contracts.borrowerOperations.setTroveManager(addresses.TroveManager)

  // 设置StabilityPool合约（诸多地址，通过调用StabilityPool合约的写函数设置）
  await contracts.stabilityPool.setActivePoolAddress(addresses.ActivePool)
  await contracts.stabilityPool.setDefaultPoolAddress(addresses.DefaultPool)

  // 设置ActivePool合约（诸多地址，通过调用ActivePool合约的写函数设置）
  await contracts.activePool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.activePool.setDefaultPoolAddress(addresses.DefaultPool)

  // 设置DefaultPool合约（诸多地址，通过调用DefaultPool合约的写函数设置）
  await contracts.defaultPool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.defaultPool.setActivePoolAddress(addresses.ActivePool)
}

const connectEchidnaProxy = async (echidnaProxy, addresses) => {
  echidnaProxy.setTroveManager(addresses.TroveManager)
  echidnaProxy.setBorrowerOperations(addresses.BorrowerOperations)
}

module.exports = {
  connectEchidnaProxy: connectEchidnaProxy,
  getAddresses: getAddresses,
  deployLiquity: deployLiquity,
  connectContracts: connectContracts
}
