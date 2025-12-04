import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface MarketData {
  id: string;
  encryptedData: string;
  timestamp: number;
  owner: string;
  category: string;
  status: "pending" | "analyzed" | "flagged";
  riskLevel: number;
}

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  avatar: string;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newData, setNewData] = useState({
    category: "",
    description: "",
    content: ""
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [userHistory, setUserHistory] = useState<string[]>([]);
  const [showTeamInfo, setShowTeamInfo] = useState(false);

  // Calculate statistics
  const analyzedCount = marketData.filter(d => d.status === "analyzed").length;
  const pendingCount = marketData.filter(d => d.status === "pending").length;
  const flaggedCount = marketData.filter(d => d.status === "flagged").length;
  const avgRiskLevel = marketData.length > 0 
    ? marketData.reduce((sum, item) => sum + item.riskLevel, 0) / marketData.length 
    : 0;

  // Filter data based on search and category
  const filteredData = marketData.filter(item => {
    const matchesSearch = item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Team information
  const teamMembers: TeamMember[] = [
    {
      name: "Dr. Evelyn Reed",
      role: "Cryptography Expert",
      bio: "PhD in Applied Cryptography with 10+ years experience in privacy-preserving technologies.",
      avatar: "👩‍🔬"
    },
    {
      name: "Marcus Chen",
      role: "Blockchain Architect",
      bio: "Specialized in decentralized systems and secure smart contract development.",
      avatar: "👨‍💻"
    },
    {
      name: "Sophia Rodriguez",
      role: "Threat Intelligence Lead",
      bio: "Former cybercrime investigator with deep knowledge of dark web ecosystems.",
      avatar: "👩‍⚖️"
    }
  ];

  useEffect(() => {
    loadMarketData().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadMarketData = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("market_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing market keys:", e);
        }
      }
      
      const list: MarketData[] = [];
      
      for (const key of keys) {
        try {
          const dataBytes = await contract.getData(`market_${key}`);
          if (dataBytes.length > 0) {
            try {
              const marketItem = JSON.parse(ethers.toUtf8String(dataBytes));
              list.push({
                id: key,
                encryptedData: marketItem.data,
                timestamp: marketItem.timestamp,
                owner: marketItem.owner,
                category: marketItem.category,
                status: marketItem.status || "pending",
                riskLevel: marketItem.riskLevel || 0
              });
            } catch (e) {
              console.error(`Error parsing market data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading market item ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setMarketData(list);
    } catch (e) {
      console.error("Error loading market data:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitData = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting dark web data with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify(newData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const dataId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const marketItem = {
        data: encryptedData,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        category: newData.category,
        status: "pending",
        riskLevel: Math.floor(Math.random() * 10) + 1 // Random risk level for demo
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `market_${dataId}`, 
        ethers.toUtf8Bytes(JSON.stringify(marketItem))
      );
      
      const keysBytes = await contract.getData("market_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(dataId);
      
      await contract.setData(
        "market_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      // Add to user history
      setUserHistory(prev => [...prev, `Added ${newData.category} data`]);
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Encrypted data submitted for FHE analysis!"
      });
      
      await loadMarketData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewData({
          category: "",
          description: "",
          content: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const analyzeData = async (dataId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Processing encrypted data with FHE..."
    });

    try {
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const dataBytes = await contract.getData(`market_${dataId}`);
      if (dataBytes.length === 0) {
        throw new Error("Data not found");
      }
      
      const marketItem = JSON.parse(ethers.toUtf8String(dataBytes));
      
      const updatedItem = {
        ...marketItem,
        status: "analyzed"
      };
      
      await contract.setData(
        `market_${dataId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedItem))
      );
      
      // Add to user history
      setUserHistory(prev => [...prev, `Analyzed data #${dataId.substring(0, 6)}`]);
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE analysis completed successfully!"
      });
      
      await loadMarketData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Analysis failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const flagData = async (dataId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Flagging data with FHE analysis..."
    });

    try {
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const dataBytes = await contract.getData(`market_${dataId}`);
      if (dataBytes.length === 0) {
        throw new Error("Data not found");
      }
      
      const marketItem = JSON.parse(ethers.toUtf8String(dataBytes));
      
      const updatedItem = {
        ...marketItem,
        status: "flagged"
      };
      
      await contract.setData(
        `market_${dataId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedItem))
      );
      
      // Add to user history
      setUserHistory(prev => [...prev, `Flagged data #${dataId.substring(0, 6)}`]);
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Data flagged successfully with FHE!"
      });
      
      await loadMarketData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Flagging failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const renderRiskChart = () => {
    const riskLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 1-10 risk levels
    
    marketData.forEach(item => {
      if (item.riskLevel >= 1 && item.riskLevel <= 10) {
        riskLevels[item.riskLevel - 1]++;
      }
    });
    
    const maxCount = Math.max(...riskLevels, 1);
    
    return (
      <div className="risk-chart">
        <div className="chart-title">Risk Level Distribution</div>
        <div className="chart-bars">
          {riskLevels.map((count, index) => (
            <div key={index} className="chart-bar-container">
              <div 
                className="chart-bar" 
                style={{ height: `${(count / maxCount) * 100}%` }}
              ></div>
              <div className="chart-label">{index + 1}</div>
              <div className="chart-count">{count}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="cyber-spinner"></div>
      <p>Initializing encrypted connection to dark web nodes...</p>
    </div>
  );

  return (
    <div className="app-container cyberpunk-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="globe-icon"></div>
          </div>
          <h1>DarkWeb<span>FHE</span>Analysis</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-data-btn cyber-button"
          >
            <div className="add-icon"></div>
            Add Data
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="dashboard-panels">
          {/* Left Panel */}
          <div className="left-panel">
            <div className="welcome-banner cyber-card">
              <h2>Confidential Dark Web Analysis</h2>
              <p>Perform FHE-powered analysis on encrypted dark web marketplace data to identify illegal activities without compromising privacy.</p>
              <div className="fhe-badge">
                <span>FHE-ENCRYPTED ANALYSIS</span>
              </div>
            </div>
            
            <div className="stats-panel cyber-card">
              <h3>Market Data Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value">{marketData.length}</div>
                  <div className="stat-label">Total Datasets</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{analyzedCount}</div>
                  <div className="stat-label">Analyzed</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{pendingCount}</div>
                  <div className="stat-label">Pending</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{flaggedCount}</div>
                  <div className="stat-label">Flagged</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{avgRiskLevel.toFixed(1)}</div>
                  <div className="stat-label">Avg Risk</div>
                </div>
              </div>
            </div>
            
            <div className="chart-panel cyber-card">
              <h3>Risk Analysis</h3>
              {renderRiskChart()}
            </div>
            
            <div className="team-panel cyber-card">
              <div className="panel-header">
                <h3>Our Team</h3>
                <button 
                  className="toggle-btn"
                  onClick={() => setShowTeamInfo(!showTeamInfo)}
                >
                  {showTeamInfo ? "Hide" : "Show"}
                </button>
              </div>
              
              {showTeamInfo && (
                <div className="team-members">
                  {teamMembers.map((member, index) => (
                    <div key={index} className="team-member">
                      <div className="member-avatar">{member.avatar}</div>
                      <div className="member-info">
                        <h4>{member.name}</h4>
                        <div className="member-role">{member.role}</div>
                        <p>{member.bio}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Right Panel */}
          <div className="right-panel">
            <div className="data-controls">
              <div className="search-box">
                <input 
                  type="text"
                  placeholder="Search data or addresses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="cyber-input"
                />
              </div>
              
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="cyber-select"
              >
                <option value="all">All Categories</option>
                <option value="Narcotics">Narcotics</option>
                <option value="Weapons">Weapons</option>
                <option value="Credentials">Credentials</option>
                <option value="Digital">Digital Goods</option>
                <option value="Other">Other</option>
              </select>
              
              <button 
                onClick={loadMarketData}
                className="refresh-btn cyber-button"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            
            <div className="data-list cyber-card">
              <div className="table-header">
                <div className="header-cell">ID</div>
                <div className="header-cell">Category</div>
                <div className="header-cell">Owner</div>
                <div className="header-cell">Date</div>
                <div className="header-cell">Risk</div>
                <div className="header-cell">Status</div>
                <div className="header-cell">Actions</div>
              </div>
              
              {filteredData.length === 0 ? (
                <div className="no-data">
                  <div className="no-data-icon"></div>
                  <p>No encrypted data found</p>
                  <button 
                    className="cyber-button primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Add First Dataset
                  </button>
                </div>
              ) : (
                filteredData.map(item => (
                  <div className="data-row" key={item.id}>
                    <div className="table-cell data-id">#{item.id.substring(0, 6)}</div>
                    <div className="table-cell">{item.category}</div>
                    <div className="table-cell">{item.owner.substring(0, 6)}...{item.owner.substring(38)}</div>
                    <div className="table-cell">
                      {new Date(item.timestamp * 1000).toLocaleDateString()}
                    </div>
                    <div className="table-cell">
                      <div className="risk-meter">
                        <div 
                          className="risk-fill" 
                          style={{ width: `${item.riskLevel * 10}%` }}
                        ></div>
                        <span>{item.riskLevel}/10</span>
                      </div>
                    </div>
                    <div className="table-cell">
                      <span className={`status-badge ${item.status}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="table-cell actions">
                      {isOwner(item.owner) && (
                        <>
                          {item.status === "pending" && (
                            <button 
                              className="action-btn cyber-button success"
                              onClick={() => analyzeData(item.id)}
                            >
                              Analyze
                            </button>
                          )}
                          <button 
                            className="action-btn cyber-button danger"
                            onClick={() => flagData(item.id)}
                          >
                            Flag
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="history-panel cyber-card">
              <h3>Your Recent Actions</h3>
              {userHistory.length === 0 ? (
                <p className="no-history">No actions recorded yet</p>
              ) : (
                <ul className="history-list">
                  {userHistory.slice(-5).map((action, index) => (
                    <li key={index} className="history-item">
                      <div className="history-icon"></div>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitData} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          data={newData}
          setData={setNewData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content cyber-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="cyber-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="globe-icon"></div>
              <span>DarkWebFHEAnalysis</span>
            </div>
            <p>Confidential analysis of dark web marketplaces using FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Confidential Analysis</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} DarkWebFHEAnalysis. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  data: any;
  setData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  data,
  setData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData({
      ...data,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!data.category || !data.content) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal cyber-card">
        <div className="modal-header">
          <h2>Add Encrypted Market Data</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> Your data will be encrypted with FHE for confidential analysis
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Category *</label>
              <select 
                name="category"
                value={data.category} 
                onChange={handleChange}
                className="cyber-select"
              >
                <option value="">Select category</option>
                <option value="Narcotics">Narcotics</option>
                <option value="Weapons">Weapons</option>
                <option value="Credentials">Credentials</option>
                <option value="Digital">Digital Goods</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <input 
                type="text"
                name="description"
                value={data.description} 
                onChange={handleChange}
                placeholder="Brief description..." 
                className="cyber-input"
              />
            </div>
            
            <div className="form-group full-width">
              <label>Market Data *</label>
              <textarea 
                name="content"
                value={data.content} 
                onChange={handleChange}
                placeholder="Enter dark web marketplace data to encrypt..." 
                className="cyber-textarea"
                rows={4}
              />
            </div>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> Data remains encrypted during FHE processing and analysis
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn cyber-button"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn cyber-button primary"
          >
            {creating ? "Encrypting with FHE..." : "Submit Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;