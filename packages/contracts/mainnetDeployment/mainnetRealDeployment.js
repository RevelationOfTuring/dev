// 部署的具体逻辑都在./mainnetDeployment.js文件中
const { mainnetDeploy } = require('./mainnetDeployment.js')
// 导入部署涉及到的一些系统配置及参数
const configParams = require("./deploymentParams.mainnet.js")

// 部署脚本的main函数定义
async function main() {
  await mainnetDeploy(configParams)
}

// main函数的执行
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
