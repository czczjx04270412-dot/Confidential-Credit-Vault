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
        uint64 clearTermDays;
        uint64 clearSuggestedRateBps;
        uint256 collateralAmount;
        address lender;
        uint256 fundedAmount;
        uint256 repaymentDue;
        uint256 dueAt;
    }

    uint256 public nextApplicationId = 1;
    address public complianceOfficer;
    mapping(uint256 => Application) private applications;

    event ApplicationSubmitted(uint256 indexed applicationId, address indexed borrower, uint64 clearAmount, uint64 clearCollateral);
    event ComplianceOfficerUpdated(address indexed officer);
    event LoanFunded(uint256 indexed applicationId, address indexed lender, address indexed borrower, uint256 amount, uint256 repaymentDue, uint256 dueAt);
    event LoanRepaid(uint256 indexed applicationId, address indexed borrower, address indexed lender, uint256 repaymentAmount, uint256 collateralReleased);

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
        bytes calldata inputProof,
        uint64 clearTermDays,
        uint64 clearSuggestedRateBps
    ) external payable returns (uint256 applicationId) {
        require(msg.value > 0, "Collateral deposit required");
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
            createdAt: block.timestamp,
            clearTermDays: clearTermDays,
            clearSuggestedRateBps: clearSuggestedRateBps,
            collateralAmount: msg.value,
            lender: address(0),
            fundedAmount: 0,
            repaymentDue: 0,
            dueAt: 0
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

    function fundLoan(uint256 applicationId) external payable {
        Application storage application = applications[applicationId];
        require(application.borrower != address(0), "Application not found");
        require(application.status == Status.Submitted, "Application is not fundable");
        require(msg.sender != application.borrower, "Borrower cannot fund own loan");
        require(msg.value > 0, "Funding value required");
        application.status = Status.Funded;
        application.lender = msg.sender;
        application.fundedAmount = msg.value;
        application.repaymentDue = msg.value + ((msg.value * application.clearSuggestedRateBps * application.clearTermDays) / 365 / 10000);
        application.dueAt = block.timestamp + (uint256(application.clearTermDays) * 1 days);

        (bool sent, ) = payable(application.borrower).call{value: msg.value}("");
        require(sent, "Funding transfer failed");

        emit LoanFunded(applicationId, msg.sender, application.borrower, msg.value, application.repaymentDue, application.dueAt);
    }

    function repayLoan(uint256 applicationId) external payable {
        Application storage application = applications[applicationId];
        require(msg.sender == application.borrower, "Only borrower can mark repayment");
        require(application.status == Status.Funded, "Loan is not funded");
        require(msg.value >= application.repaymentDue, "Insufficient repayment");
        application.status = Status.Repaid;

        (bool repaid, ) = payable(application.lender).call{value: application.repaymentDue}("");
        require(repaid, "Repayment transfer failed");

        uint256 refund = msg.value - application.repaymentDue;
        if (refund > 0) {
            (bool refunded, ) = payable(application.borrower).call{value: refund}("");
            require(refunded, "Refund failed");
        }

        uint256 collateralAmount = application.collateralAmount;
        application.collateralAmount = 0;
        (bool released, ) = payable(application.borrower).call{value: collateralAmount}("");
        require(released, "Collateral release failed");

        emit LoanRepaid(applicationId, msg.sender, application.lender, application.repaymentDue, collateralAmount);
    }

    function markRepaid(uint256) external pure {
        revert("Use repayLoan");
    }

    function getLoanTerms(uint256 applicationId)
        external
        view
        returns (address lender, uint256 collateralAmount, uint256 fundedAmount, uint256 repaymentDue, uint256 dueAt)
    {
        Application storage application = applications[applicationId];
        return (application.lender, application.collateralAmount, application.fundedAmount, application.repaymentDue, application.dueAt);
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
