import React, { useEffect, useState } from "react";
import { generateOTP, verifyOTP, getOTP } from "../contract";
import { ethers } from "ethers";

export default function DeliveryVerification() {
  const [userAddress, setUserAddress] = useState("");
  const buyerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; 
  const deliveryAgentAddress = "0xdD2FD4581271e230360230F9337D5c0430Bf44C0"; 
  const [otp, setOtp] = useState("");
  const [buyerOtp, setBuyerOtp] = useState(null);

  useEffect(() => {
    async function fetchAccount() {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setUserAddress(await signer.getAddress());

      // Fetch OTP if user is buyer
      if ((await signer.getAddress()).toLowerCase() === buyerAddress.toLowerCase()) {
        try {
          const fetchedOtp = await getOTP();
          // setBuyerOtp(fetchedOtp);
          setBuyerOtp(fetchedOtp ? fetchedOtp.toString().padStart(4, "0") : null);
        } catch (error) {
          console.error("Error fetching OTP:", error);
        }
      }
    }

    fetchAccount();

    window.ethereum.on("accountsChanged", async (accounts) => {
      setUserAddress(accounts[0]);
      setBuyerOtp(null);
      setOtp("");
    });

    return () => {
      window.ethereum.removeListener("accountsChanged", fetchAccount);
    };
  }, []);

  const handleGenerateOTP = async () => {
    if (userAddress.toLowerCase() !== deliveryAgentAddress.toLowerCase()) {
      alert("Only the assigned delivery agent can generate OTP.");
      return;
    }
    try {
      await generateOTP();
      alert("OTP Generated Successfully!");

      const updatedOtp = await getOTP();
      setBuyerOtp(updatedOtp ? updatedOtp.toString().padStart(4, "0") : null);
    } catch (error) {
      console.error("Error generating OTP:", error);
      alert(error.reason || "Transaction failed.");
    }
  };

  const handleVerifyOTP = async () => {
    if (userAddress.toLowerCase() !== deliveryAgentAddress.toLowerCase()) {
      alert("Only the assigned delivery agent can verify OTP.");
      return;
    }
    try {
      await verifyOTP(otp);
      alert("OTP Verified Successfully!");

      setOtp("");
      setBuyerOtp(null);
    } catch (error) {
      console.error("Error verifying OTP:", error);
      alert(error.reason || "Transaction failed.");
    }
  };

  return (
    <div>
      <h3>Delivery Verification</h3>
      
      {userAddress.toLowerCase() === buyerAddress.toLowerCase() && buyerOtp && (
        <p style={{ fontWeight: "bold", color: "green" }}>Your OTP: {buyerOtp}</p>
      )}

      {userAddress.toLowerCase() === deliveryAgentAddress.toLowerCase() ? (
        <>
          <button onClick={handleGenerateOTP} style={{ marginRight: "10px", padding: "10px" }}>
            Generate OTP
          </button>
          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            style={{ marginRight: "10px", padding: "10px" }}
          />
          <button onClick={handleVerifyOTP} style={{ padding: "10px" }}>
            Verify OTP
          </button>
        </>
      ) : (
        <p style={{ color: "red", fontWeight: "bold" }}>❌ Access Denied: Only Assigned Delivery Agent Can Perform Actions</p>
      )}
    </div>
  );
}
