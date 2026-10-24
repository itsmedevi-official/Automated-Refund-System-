

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useNavigate } from "react-router-dom";
import EscrowJSON from "../contracts/Escrow.json";

const EscrowABI = EscrowJSON.abi;
const CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3"; // Replace with your deployed contract address

export default function BuyerDashboard() {
  const [userAddress, setUserAddress] = useState("");
  const [showHistory, setShowHistory] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [sellerAddress, setSellerAddress] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [buyerAddress, setBuyerAddress] = useState(""); // Dynamic buyer address from contract
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchAccountAndTransactions() {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setUserAddress(address);

        const contract = new ethers.Contract(CONTRACT_ADDRESS, EscrowABI, signer);

        // Fetch the buyer address from the contract (if stored there)
        const contractBuyerAddress = await contract.buyer();
        setBuyerAddress(contractBuyerAddress);

        // Assuming your contract has a method to fetch transaction history
        // const txs = await contract.getTransactions(address); // Replace with your actual method
        // setTransactions(txs);

      } catch (err) {
        console.error("Error fetching on-chain data:", err);
      }
    }

    fetchAccountAndTransactions();

    window.ethereum.on("accountsChanged", async (accounts) => {
      setUserAddress(accounts[0]);
      fetchAccountAndTransactions();
    });

    return () => {
      window.ethereum.removeListener("accountsChanged", fetchAccountAndTransactions);
    };
  }, []);

  const handleDeposit = async () => {
    if (!sellerAddress || !depositAmount) return alert("Fill all fields");
  
    try {
      // Create a Web3Provider to interact with Ethereum via the browser's window.ethereum provider
      const provider = new ethers.providers.Web3Provider(window.ethereum); // <-- Correct Web3Provider
      const signer = await provider.getSigner(); // Get the signer (user's wallet)
  
      const contract = new ethers.Contract(CONTRACT_ADDRESS, EscrowABI, signer);
  
      // Send deposit transaction
      const tx = await contract.depositFunds(
        sellerAddress,
        { value: ethers.parseEther(depositAmount) }
      );
      await tx.wait();
      alert("Funds deposited successfully ✅");
    } catch (err) {
      console.error("Deposit failed:", err);
      alert("Deposit failed ❌");
    }
  };
  

  // Function to handle dispute (update based on actual contract method)
  const handleRaiseDispute = async (transactionId) => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, EscrowABI, signer);

      // Placeholder: Update with actual contract function to raise a dispute
      // await contract.raiseDispute(transactionId);

      alert("Dispute raised successfully ✅");
    } catch (err) {
      console.error("Error raising dispute:", err);
      alert("Error raising dispute ❌");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2 style={{ marginBottom: "10px" }}>Buyer Dashboard</h2>
      <p>
        <strong>Current Buyer:</strong> {userAddress}
      </p>

      {/* Check if current user is the buyer */}
      {userAddress.toLowerCase() === buyerAddress.toLowerCase() ? (
        <>
          {/* Deposit Funds */}
          <div style={{ marginTop: "20px" }}>
            <h3>Deposit Funds</h3>
            <input
              placeholder="Seller Address"
              value={sellerAddress}
              onChange={(e) => setSellerAddress(e.target.value)}
              style={{ marginRight: "10px" }}
            />
            <input
              placeholder="Amount in ETH"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              style={{ marginRight: "10px" }}
            />
            <button onClick={handleDeposit}>Deposit Funds</button>
          </div>

          {/* Transaction History */}
          <div style={{ marginTop: "30px" }}>
            <h3>Transaction History</h3>
            <button onClick={() => setShowHistory(!showHistory)} style={{ marginBottom: "10px" }}>
              {showHistory ? "Hide" : "Show"} Transaction History
            </button>

            {showHistory &&
              transactions.map((tx, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: "lightgreen",
                    padding: "10px",
                    borderRadius: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <p><strong>{tx.txHash}</strong></p>
                  <p>Amount (ETH): {ethers.formatEther(tx.amount)}</p>
                  <p>Status: {tx.status}</p>
                  <p>
                    OTP:{" "}
                    <span style={{ border: "1px solid red", padding: "3px" }}>
                      {tx.otp}
                    </span>
                  </p>
                  <button
                    onClick={() => handleRaiseDispute(tx.transactionId)}
                    style={{
                      backgroundColor: "orange",
                      padding: "8px",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Raise Dispute
                  </button>
                </div>
              ))}
          </div>
        </>
      ) : (
        <p style={{ color: "red", fontWeight: "bold" }}>
          ❌ Access Denied: Only the buyer can perform these actions.
        </p>
      )}

      <button onClick={() => navigate("/")} style={{ marginTop: "20px", padding: "10px" }}>
        Back to Home
      </button>
    </div>
  );
}
