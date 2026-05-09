import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const Vault = await ethers.getContractFactory("ConfidentialCreditVault");
  const vault = await Vault.deploy(deployer.address);
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  const outputDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "sepolia.json"),
    JSON.stringify(
      {
        network: "sepolia",
        contract: "ConfidentialCreditVault",
        address,
        complianceOfficer: deployer.address,
        deployedAt: new Date().toISOString()
      },
      null,
      2
    )
  );

  console.log("ConfidentialCreditVault deployed to:", address);
  console.log("Compliance officer:", deployer.address);
  console.log("Add this to .env.local:");
  console.log(`NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
