// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialCollateralOptimizer
/// @notice Demo optimizer that computes collateral requirements over encrypted borrower signals.
contract ConfidentialCreditVault is ZamaEthereumConfig {
    enum Status {
        None,
        Submitted,
        Funded,
        Repaid
    }

    struct Application {
        address borrower;
        uint64 clearAmount;
        uint64 clearCollateral;
        euint64 incomeScore;
        euint64 creditScore;
        euint64 debtPressure;
        euint64 assetSourceScore;
        euint64 riskScore;
        euint64 riskBand;
        euint64 requiredCollateralBps;
        euint64 suggestedRateBps;
        ebool approved;
        Status status;
        uint256 createdAt;
    }

    uint256 public nextApplicationId = 1;
    address public complianceOfficer;
    mapping(uint256 => Application) private applications;

    event ApplicationSubmitted(uint256 indexed applicationId, address indexed borrower, uint64 clearAmount, uint64 clearCollateral);
    event LenderAccessGranted(uint256 indexed applicationId, address indexed lender);
    event ComplianceOfficerUpdated(address indexed officer);
    event LoanFunded(uint256 indexed applicationId, address indexed lender);
    event LoanRepaid(uint256 indexed applicationId, address indexed borrower);

    constructor(address officer) {
        complianceOfficer = officer;
        emit ComplianceOfficerUpdated(officer);
    }

    function submitApplication(
        uint64 clearAmount,
        uint64 clearCollateral,
        externalEuint64 encryptedIncomeScore,
        externalEuint64 encryptedCreditScore,
        externalEuint64 encryptedDebtPressure,
        externalEuint64 encryptedAssetSourceScore,
        bytes calldata inputProof
    ) external returns (uint256 applicationId) {
        applicationId = nextApplicationId++;

        euint64 incomeScore = FHE.fromExternal(encryptedIncomeScore, inputProof);
        euint64 creditScore = FHE.fromExternal(encryptedCreditScore, inputProof);
        euint64 debtPressure = FHE.fromExternal(encryptedDebtPressure, inputProof);
        euint64 assetSourceScore = FHE.fromExternal(encryptedAssetSourceScore, inputProof);

        // Weighted score on encrypted values:
        // credit 40%, income 30%, asset source 20%, debt pressure penalty 10%.
        euint64 creditWeighted = FHE.div(FHE.mul(creditScore, 40), 100);
        euint64 incomeWeighted = FHE.div(FHE.mul(incomeScore, 30), 100);
        euint64 sourceWeighted = FHE.div(FHE.mul(assetSourceScore, 20), 100);
        euint64 debtPenalty = FHE.div(FHE.mul(debtPressure, 10), 100);
        euint64 positiveScore = FHE.add(FHE.add(creditWeighted, incomeWeighted), sourceWeighted);
        euint64 riskScore = FHE.sub(positiveScore, debtPenalty);

        uint64 currentCollateralBps = clearAmount == 0 ? 0 : uint64((uint256(clearCollateral) * 10000) / clearAmount);
        euint64 encryptedCurrentCollateralBps = FHE.asEuint64(currentCollateralBps);

        ebool lowRisk = FHE.ge(riskScore, 85);
        ebool mediumRisk = FHE.ge(riskScore, 70);
        ebool acceptableRisk = FHE.ge(riskScore, 50);
        euint64 riskBand = FHE.select(
            lowRisk,
            FHE.asEuint64(1),
            FHE.select(mediumRisk, FHE.asEuint64(2), FHE.select(acceptableRisk, FHE.asEuint64(3), FHE.asEuint64(4)))
        );
        euint64 requiredCollateralBps = FHE.select(
            lowRisk,
            FHE.asEuint64(12000),
            FHE.select(mediumRisk, FHE.asEuint64(15000), FHE.select(acceptableRisk, FHE.asEuint64(18000), FHE.asEuint64(99900)))
        );
        euint64 suggestedRateBps = FHE.select(
            lowRisk,
            FHE.asEuint64(1800),
            FHE.select(mediumRisk, FHE.asEuint64(3600), FHE.select(acceptableRisk, FHE.asEuint64(7200), FHE.asEuint64(0)))
        );
        ebool collateralOk = FHE.ge(encryptedCurrentCollateralBps, requiredCollateralBps);
        ebool approved = FHE.and(acceptableRisk, collateralOk);

        applications[applicationId] = Application({
            borrower: msg.sender,
            clearAmount: clearAmount,
            clearCollateral: clearCollateral,
            incomeScore: incomeScore,
            creditScore: creditScore,
            debtPressure: debtPressure,
            assetSourceScore: assetSourceScore,
            riskScore: riskScore,
            riskBand: riskBand,
            requiredCollateralBps: requiredCollateralBps,
            suggestedRateBps: suggestedRateBps,
            approved: approved,
            status: Status.Submitted,
            createdAt: block.timestamp
        });

        _allowApplication(applicationId, msg.sender);
        FHE.allow(applications[applicationId].approved, msg.sender);
        FHE.allow(applications[applicationId].riskBand, msg.sender);
        FHE.allow(applications[applicationId].requiredCollateralBps, msg.sender);
        FHE.allow(applications[applicationId].suggestedRateBps, msg.sender);

        if (complianceOfficer != address(0)) {
            _allowApplication(applicationId, complianceOfficer);
        }

        emit ApplicationSubmitted(applicationId, msg.sender, clearAmount, clearCollateral);
    }

    function getPublicApplication(uint256 applicationId)
        external
        view
        returns (address borrower, uint64 clearAmount, uint64 clearCollateral, Status status, uint256 createdAt)
    {
        Application storage application = applications[applicationId];
        return (application.borrower, application.clearAmount, application.clearCollateral, application.status, application.createdAt);
    }

    function grantLenderResultAccess(uint256 applicationId, address lender) external {
        Application storage application = applications[applicationId];
        require(msg.sender == application.borrower, "Only borrower can grant lender access");
        FHE.allow(application.approved, lender);
        FHE.allow(application.riskBand, lender);
        FHE.allow(application.requiredCollateralBps, lender);
        FHE.allow(application.suggestedRateBps, lender);
        emit LenderAccessGranted(applicationId, lender);
    }

    function fundLoan(uint256 applicationId) external payable {
        Application storage application = applications[applicationId];
        require(application.status == Status.Submitted, "Application is not fundable");
        application.status = Status.Funded;
        emit LoanFunded(applicationId, msg.sender);
    }

    function markRepaid(uint256 applicationId) external {
        Application storage application = applications[applicationId];
        require(msg.sender == application.borrower, "Only borrower can mark repayment");
        require(application.status == Status.Funded, "Loan is not funded");
        application.status = Status.Repaid;
        emit LoanRepaid(applicationId, msg.sender);
    }

    function setComplianceOfficer(address officer) external {
        require(msg.sender == complianceOfficer || complianceOfficer == address(0), "Only current officer");
        complianceOfficer = officer;
        emit ComplianceOfficerUpdated(officer);
    }

    function _allowApplication(uint256 applicationId, address account) private {
        Application storage application = applications[applicationId];
        FHE.allowThis(application.incomeScore);
        FHE.allowThis(application.creditScore);
        FHE.allowThis(application.debtPressure);
        FHE.allowThis(application.assetSourceScore);
        FHE.allowThis(application.riskScore);
        FHE.allowThis(application.riskBand);
        FHE.allowThis(application.requiredCollateralBps);
        FHE.allowThis(application.suggestedRateBps);
        FHE.allowThis(application.approved);

        FHE.allow(application.incomeScore, account);
        FHE.allow(application.creditScore, account);
        FHE.allow(application.debtPressure, account);
        FHE.allow(application.assetSourceScore, account);
        FHE.allow(application.riskScore, account);
        FHE.allow(application.riskBand, account);
        FHE.allow(application.requiredCollateralBps, account);
        FHE.allow(application.suggestedRateBps, account);
        FHE.allow(application.approved, account);
    }
}
