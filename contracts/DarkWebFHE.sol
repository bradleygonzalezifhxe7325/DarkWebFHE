// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract DarkWebFHE is SepoliaConfig {
    struct Transaction {
        euint32 encryptedSellerId;
        euint32 encryptedBuyerId;
        euint32 encryptedProductCode;
        euint32 encryptedAmount;
        uint256 timestamp;
    }

    struct NetworkNode {
        euint32 encryptedNodeId;
        euint32 encryptedConnectionScore;
        euint32 encryptedTransactionCount;
    }

    struct AnalysisResult {
        euint32 encryptedRiskScore;
        euint32 encryptedCentralityScore;
        bool isRevealed;
    }

    uint256 public transactionCount;
    uint256 public nodeCount;
    uint256 public analysisCount;
    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => NetworkNode) public networkNodes;
    mapping(uint256 => AnalysisResult) public analysisResults;
    mapping(uint256 => uint256) private requestToTransactionId;
    mapping(uint256 => uint256) private requestToNodeId;
    
    event TransactionRecorded(uint256 indexed txId);
    event NodeAdded(uint256 indexed nodeId);
    event AnalysisRequested(uint256 indexed nodeId);
    event RiskIdentified(uint256 indexed resultId);

    function recordTransaction(
        euint32 sellerId,
        euint32 buyerId,
        euint32 productCode,
        euint32 amount
    ) public {
        transactionCount++;
        transactions[transactionCount] = Transaction({
            encryptedSellerId: sellerId,
            encryptedBuyerId: buyerId,
            encryptedProductCode: productCode,
            encryptedAmount: amount,
            timestamp: block.timestamp
        });
        emit TransactionRecorded(transactionCount);
    }

    function addNetworkNode(
        euint32 nodeId,
        euint32 connectionScore
    ) public {
        nodeCount++;
        networkNodes[nodeCount] = NetworkNode({
            encryptedNodeId: nodeId,
            encryptedConnectionScore: connectionScore,
            encryptedTransactionCount: FHE.asEuint32(0)
        });
        emit NodeAdded(nodeCount);
    }

    function analyzeNode(uint256 nodeId) public {
        require(nodeId <= nodeCount, "Invalid node");
        
        bytes32[] memory ciphertexts = new bytes32[](3);
        ciphertexts[0] = FHE.toBytes32(networkNodes[nodeId].encryptedNodeId);
        ciphertexts[1] = FHE.toBytes32(networkNodes[nodeId].encryptedConnectionScore);
        ciphertexts[2] = FHE.toBytes32(networkNodes[nodeId].encryptedTransactionCount);
        
        uint256 reqId = FHE.requestDecryption(ciphertexts, this.calculateRisk.selector);
        requestToNodeId[reqId] = nodeId;
        
        emit AnalysisRequested(nodeId);
    }

    function calculateRisk(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 nodeId = requestToNodeId[requestId];
        require(nodeId != 0, "Invalid request");

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32[] memory nodeData = abi.decode(cleartexts, (uint32[]));
        uint32 id = nodeData[0];
        uint32 connections = nodeData[1];
        uint32 txCount = nodeData[2];

        // Simplified risk calculation
        uint32 riskScore = connections * txCount;
        uint32 centrality = connections + txCount;
        
        analysisCount++;
        analysisResults[analysisCount] = AnalysisResult({
            encryptedRiskScore: FHE.asEuint32(riskScore),
            encryptedCentralityScore: FHE.asEuint32(centrality),
            isRevealed: false
        });

        if (riskScore > 1000) {
            emit RiskIdentified(analysisCount);
        }
    }

    function requestAnalysisDecryption(uint256 resultId) public {
        require(resultId <= analysisCount, "Invalid result");
        require(!analysisResults[resultId].isRevealed, "Already revealed");
        
        bytes32[] memory ciphertexts = new bytes32[](2);
        ciphertexts[0] = FHE.toBytes32(analysisResults[resultId].encryptedRiskScore);
        ciphertexts[1] = FHE.toBytes32(analysisResults[resultId].encryptedCentralityScore);
        
        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptAnalysis.selector);
        requestToNodeId[reqId] = resultId;
    }

    function decryptAnalysis(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 resultId = requestToNodeId[requestId];
        require(resultId != 0, "Invalid request");

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32[] memory results = abi.decode(cleartexts, (uint32[]));
        analysisResults[resultId].isRevealed = true;
    }

    function updateNodeConnections(
        uint256 nodeId,
        euint32 additionalConnections
    ) public {
        require(nodeId <= nodeCount, "Invalid node");
        networkNodes[nodeId].encryptedConnectionScore = FHE.add(
            networkNodes[nodeId].encryptedConnectionScore,
            additionalConnections
        );
    }

    function incrementTransactionCount(uint256 nodeId) public {
        require(nodeId <= nodeCount, "Invalid node");
        networkNodes[nodeId].encryptedTransactionCount = FHE.add(
            networkNodes[nodeId].encryptedTransactionCount,
            FHE.asEuint32(1)
        );
    }

    function getTransactionCount() public view returns (uint256) {
        return transactionCount;
    }

    function getNodeCount() public view returns (uint256) {
        return nodeCount;
    }

    function getAnalysisStatus(uint256 resultId) public view returns (bool) {
        return analysisResults[resultId].isRevealed;
    }
}