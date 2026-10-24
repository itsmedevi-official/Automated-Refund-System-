import React, { useEffect, useState } from "react";
import DisputeReason from "../components/DisputeReason";
import ResolveDispute from "../components/ResolveDispute";
import StakeholderVote from "../components/StakeholderVote";

import { ethers } from "ethers";
import { useNavigate } from "react-router-dom";

export default function DisputePage() {
  const [userAddress, setUserAddress] = useState("");
  const buyerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Buyer Address
  const adminAddress = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"; // Admin Address
  const stakeholders = [
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Stakeholder 1
    "0x6c6e2a0D7d90E4B409d6D58Fda460F8F983c1457", // Stakeholder 2
    "0x4F217d7061deE9028a17E3c7bb506aa7eEc6e021"  // Stakeholder 3
  ]; 
  const navigate = useNavigate();

  // Check if the user is a stakeholder
  const isStakeholder = stakeholders.includes(userAddress.toLowerCase());

  useEffect(() => {
    async function fetchAccount() {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setUserAddress(await signer.getAddress());
    }

    fetchAccount();

    window.ethereum.on("accountsChanged", async (accounts) => {
      setUserAddress(accounts[0]);
    });

    return () => {
      window.ethereum.removeListener("accountsChanged", fetchAccount);
    };
  }, []);

  return (
    <div>
      <h2>Dispute Management</h2>

      {/* Dispute Reason: Visible to Buyer and Admin */}
      {(userAddress.toLowerCase() === buyerAddress.toLowerCase() || userAddress.toLowerCase() === adminAddress.toLowerCase()) ? (
        <DisputeReason />
      ) : (
        <p style={{ color: "red", fontWeight: "bold" }}>❌ Access Denied: Only Buyer and Admin can raise a dispute.</p>
      )}

      {/* Resolve Dispute: Visible only to Admin */}
      {userAddress.toLowerCase() === adminAddress.toLowerCase() && <ResolveDispute />}

      {/* Stakeholder Voting: Visible only to Stakeholders */}
      {isStakeholder && <StakeholderVote />}

      {/* Back Button */}
      <button onClick={() => navigate("/")} style={{ marginTop: "10px", padding: "10px" }}>
        Back to Home
      </button>
    </div>
  );
}
