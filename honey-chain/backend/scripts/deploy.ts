import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Deploying HoneyChain smart contract...');

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Deployer balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const HoneyChain = await ethers.getContractFactory('HoneyChain');
  const honeyChain = await HoneyChain.deploy();
  await honeyChain.waitForDeployment();

  const contractAddress = await honeyChain.getAddress();
  console.log(`HoneyChain deployed to: ${contractAddress}`);

  // Save deployment info
  const deploymentInfo = {
    contractAddress,
    deployerAddress: deployer.address,
    network: 'localhost',
    deployedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, '../deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to: ${deploymentPath}`);

  console.log('\n=== NEXT STEPS ===');
  console.log(`1. Add to your .env file:`);
  console.log(`   SMART_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`   BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545`);
  console.log(`   BLOCKCHAIN_PRIVATE_KEY=<hardhat test account private key>`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
