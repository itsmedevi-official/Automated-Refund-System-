import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import EscrowABI from "@artifacts/contracts/Escrow.sol/Escrow.json";  // Adjust the import if necessary
import config from "../config.json"; // Make sure your config file contains the correct contract address

export default function StakeholderVote() {
  const [contract, setContract] = useState(null);
  const [userAddress, setUserAddress] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [votingDeadline, setVotingDeadline] = useState(null);
  const [votesForBuyer, setVotesForBuyer] = useState(0);
  const [votesForSeller, setVotesForSeller] = useState(0);
  const [countdown, setCountdown] = useState("");

  // Predefined stakeholder addresses
  const stakeholders = [
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Stakeholder 1
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // Stakeholder 2
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"  // Stakeholder 3
  ];

  useEffect(() => {
    async function init() {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setUserAddress(address);

      const escrow = new ethers.Contract(config.escrowAddress, EscrowABI.abi, signer);
      setContract(escrow);

      // Escalate to DAO with the predefined stakeholder addresses
      await escrow.escalateToDAO(stakeholders);

      const voted = await escrow.hasVoted(address);
      setHasVoted(voted);

      const deadline = await escrow.votingDeadline();
      setVotingDeadline(Number(deadline));

      updateVotes();
    }

    async function updateVotes() {
      if (!contract) return;
      const buyerVotes = await contract.votesForBuyer();
      const sellerVotes = await contract.votesForSeller();
      setVotesForBuyer(Number(buyerVotes));
      setVotesForSeller(Number(sellerVotes));
    }

    init();

    // Set interval to update the countdown every second
    const interval = setInterval(() => updateCountdown(), 1000);

    return () => clearInterval(interval);  // Clean up the interval on unmount
  }, [contract]);

  const updateCountdown = () => {
    if (!votingDeadline) return;
    const timeLeft = votingDeadline - Math.floor(Date.now() / 1000);
    if (timeLeft <= 0) {
      setCountdown("Voting ended");
    } else {
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      const seconds = timeLeft % 60;
      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    }
  };

  const submitVote = async (voteForBuyer) => {
    if (!contract) return;
    try {
        const tx = await contract.voteOnDispute(voteForBuyer);
        await tx.wait();
        alert("Vote submitted!");
        setHasVoted(true);
    } catch (err) {
        console.error("Voting failed:", err);
        alert("Error submitting vote.");
    }
  };

  return (
    <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "12px" }}>
      <h3>🗳️ Stakeholder Voting</h3>
      <p><strong>Voting ends in:</strong> {countdown}</p>

      {hasVoted ? (
        <p style={{ color: "green", fontWeight: "bold" }}>✅ You’ve already voted</p>
      ) : (
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => submitVote(true)} style={{ padding: "10px", background: "#90ee90" }}>
            Refund Buyer
          </button>
          <button onClick={() => submitVote(false)} style={{ padding: "10px", background: "#f08080" }}>
            Pay Seller
          </button>
        </div>
      )}

      <div style={{ marginTop: "15px" }}>
        <h4>Live Vote Count:</h4>
        <p>Buyer Votes: {votesForBuyer}</p>
        <p>Seller Votes: {votesForSeller}</p>
      </div>
    </div>
  );
}
