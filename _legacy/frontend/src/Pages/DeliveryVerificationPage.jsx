import React, { useEffect, useState } from "react";
import { generateOTP, verifyOTP, getOTP } from "../contract";
import { ethers } from "ethers";
import { useNavigate } from "react-router-dom";

export default function DeliveryVerificationPage() {
  const [userAddress, setUserAddress] = useState("");
  const buyerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const deliveryAgentAddress = "0xdD2FD4581271e230360230F9337D5c0430Bf44C0";
  const [otp, setOtp] = useState("");
  const [buyerOtp, setBuyerOtp] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchAccount() {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setUserAddress(await signer.getAddress());

      if ((await signer.getAddress()).toLowerCase() === buyerAddress.toLowerCase()) {
        try {
          const fetchedOtp = await getOTP();
          setBuyerOtp(fetchedOtp);
        } catch (error) {
          console.error("Error fetching OTP:", error);
        }
      }
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
      <h3>Delivery Verification</h3>
      
      {userAddress.toLowerCase() === buyerAddress.toLowerCase() && buyerOtp && (
        <p style={{ fontWeight: "bold", color: "green" }}>Your OTP: {buyerOtp}</p>
      )}

      {userAddress.toLowerCase() === deliveryAgentAddress.toLowerCase() ? (
        <>
          <button onClick={() => generateOTP()} style={{ marginRight: "10px", padding: "10px" }}>
            Generate OTP
          </button>
          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            style={{ marginRight: "10px", padding: "10px" }}
          />
          <button onClick={() => verifyOTP(otp)} style={{ padding: "10px" }}>
            Verify OTP
          </button>
        </>
      ) : (
        <p style={{ color: "red", fontWeight: "bold" }}>❌ Access Denied</p>
      )}

      <button onClick={() => navigate("/")} style={{ marginTop: "10px", padding: "10px" }}>
        Back to Home
      </button>
    </div>
  );
}
