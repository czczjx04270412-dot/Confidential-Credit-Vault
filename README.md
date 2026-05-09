# Zama 隐私抵押率优化器

一个基于 Zama FHEVM 的隐私金融 dApp 演示。项目面向抵押借贷场景：借款人仍然需要抵押资产，但风险定价不只依赖公开抵押率，而是让收入稳定性、信用历史、负债压力、资产来源等敏感风控输入以加密形式进入 Solidity 合约，由 Zama FHE 在密文状态下计算风险结果、最低抵押率和建议利率。

## 项目定位

公共区块链上的借贷信息默认透明，用户的资金行为、风险画像和策略偏好容易被公开观察。本项目展示一种更现实的隐私借贷方案：

- 借款金额、公开抵押率、贷款期限等必要业务信息保持公开。
- 借款人的敏感风险输入通过 Zama Relayer SDK 加密后提交。
- 合约在密文上计算风险分、风险等级、最低抵押率和建议利率。
- 贷方只看到授权后的最终结果，不看到原始隐私数据。
- AI 风险解释只读取合约授权披露的结果，不读取原始评分。

## 核心功能

- 借款人连接 EVM 钱包，填写借款金额和期限。
- 前端读取 SepoliaETH 余额，并按演示汇率折算可用抵押额度。
- 前端生成风险画像，并使用 Zama Relayer SDK 加密 4 个隐私输入。
- Solidity 合约接收 `externalEuint64` 和 `inputProof`。
- 合约使用 FHE 运算计算风险分、风险等级、最低抵押率、建议年化利率。
- 借款申请可以写入 Sepolia 上的 Zama FHEVM 合约。
- 贷方市场可以查看授权后的风险结果，并调用 DeepSeek 生成风险解释。
- 贷方可以用另一个 EVM 钱包发起链上放款交易，调用合约 `fundLoan`。

## Zama 使用方式

智能合约位置：

```text
contracts/ConfidentialCreditVault.sol
```

合约使用的 Zama / FHEVM 能力：

```solidity
externalEuint64
euint64
ebool
FHE.fromExternal
FHE.add
FHE.sub
FHE.mul
FHE.div
FHE.ge
FHE.select
FHE.allow
FHE.allowThis
```

前端 Zama 交互位置：

```text
lib/zamaContract.ts
```

前端加密输入流程：

```ts
const { createInstance, initSDK, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
await initSDK();

const relayer = await createInstance({
  ...SepoliaConfig,
  network: ethereumProvider
});

const encryptedInput = relayer.createEncryptedInput(contractAddress, userAddress);
encryptedInput.add64(incomeScore);
encryptedInput.add64(creditScore);
encryptedInput.add64(debtPressure);
encryptedInput.add64(assetSource);

const encrypted = await encryptedInput.encrypt();
```

随后前端把 `handles` 和 `inputProof` 提交给合约：

```solidity
submitApplication(
  clearAmount,
  clearCollateral,
  encryptedIncomeScore,
  encryptedCreditScore,
  encryptedDebtPressure,
  encryptedAssetSourceScore,
  inputProof
)
```

## 风险计算模型

当前演示使用以下加权模型：

```text
风险分 =
信用历史评分 * 40%
+ 收入稳定性评分 * 30%
+ 资产来源评分 * 20%
- 负债压力评分 * 10%
```

合约根据风险分选择抵押率和利率：

```text
低风险：最低抵押率 120%，建议年化 18%
中风险：最低抵押率 150%，建议年化 36%
高风险：最低抵押率 180%，建议年化 72%
拒绝：不进入放款流程
```

利息按借款期限折算：

```text
预计利息 = 借款金额 * 年化利率 * 计息天数 / 365
```

## 页面结构

```text
/dashboard    总览仪表盘
/borrow       借款申请
/lend         贷方市场
/compliance   合规说明
```

## 合约地址

当前 Sepolia 部署地址：

```text
0xA2b639aa6B67b022329bd97ac3c4c66aAFB3EF2d
```

部署钱包：

```text
0xD85a389004F5c59fd991C98376e27F9aD6f75996
```

## 本地运行

安装依赖：

```bash
npm install
```

启动前端：

```bash
npm run dev
```

打开：

```text
http://localhost:3000/dashboard
```

## 环境变量

创建 `.env.local`：

```env
SEPOLIA_RPC_URL=你的 Sepolia RPC
PRIVATE_KEY=你的 EVM 部署钱包私钥
NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT=0xA2b639aa6B67b022329bd97ac3c4c66aAFB3EF2d
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

说明：

- `PRIVATE_KEY` 只用于部署，不会暴露给前端。
- `NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT` 会暴露给前端，用于调用合约。
- 钱包可以使用 MetaMask，也可以使用 Phantom 的 EVM 钱包，但必须是 `0x...` 地址并切换到 Sepolia。

## 编译和部署

编译合约：

```bash
npm run compile:contracts
```

部署到 Sepolia：

```bash
npm run deploy:sepolia
```

部署成功后，脚本会输出：

```text
NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT=0x...
```

把该地址写回 `.env.local`，然后重启前端。

## 演示流程

1. 打开 `/borrow`。
2. 连接 EVM 钱包并切换到 Sepolia。
3. 填写借款金额和期限。
4. 选择风险画像模式。
5. 点击“加密并提交”。
6. 钱包确认交易，申请写入 Zama 合约。
7. 打开 `/lend`。
8. 使用另一个 EVM 钱包作为贷方。
9. 点击“调用 DeepSeek”生成风险解释。
10. 点击“链上放款”，调用合约 `fundLoan`。

## 隐私边界

加密处理：

- 收入稳定性评分
- 信用历史评分
- 负债压力评分
- 资产来源评分
- 风险分
- 风险等级
- 最低抵押率
- 建议利率
- 审批结果

公开展示：

- 借款金额
- 公开抵押率
- 期限
- 到期应还金额
- 授权后的风险等级和利率结果
- 链上交易哈希

AI 风险解释只读取授权后的结果，不读取原始隐私评分。

## 当前演示假设

为了让评审能在短时间内完整跑通流程，当前版本保留了以下演示假设：

- 抵押额度由 SepoliaETH 按固定演示汇率折算为测试 USDT。
- 风险画像由钱包地址和模式稳定生成，用于模拟外部风控数据源。
- 贷方放款使用 SepoliaETH 进入合约 Vault，后续可替换为 ERC20 测试 USDT。
- 当前版本重点展示 Zama FHE 风控计算和授权披露，不包含完整清算引擎。

## 后续可扩展方向

- 接入 ERC20 测试 USDT 抵押和放款。
- 接入价格预言机和清算逻辑。
- 增加链上事件索引和历史记录持久化。
- 增加合规角色的授权查看和审计流程。
- 将风险输入接入真实链下信用或 RWA 数据源。

## 技术栈

- Next.js
- TypeScript
- Solidity
- Hardhat
- Ethers v6
- Zama FHEVM Solidity
- Zama Relayer SDK
- DeepSeek API

## 一句话总结

本项目用 Zama FHEVM 展示了隐私抵押借贷中的动态风险定价：借款人的敏感风险输入保持加密，合约在密文上计算最低抵押率和利率，贷方只获得必要的授权结果，从而兼顾隐私保护、风险控制和资金效率。
