import React, { useEffect, useState } from "react";
import { resolveDispute } from "../contract";
import { ethers } from "ethers";

export default function ResolveDispute() {
  const [userAddress, setUserAddress] = useState("");
  const adminAddress = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";

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

  const handleResolve = async (refundBuyer) => {
    try {
      if (userAddress.toLowerCase() !== adminAddress.toLowerCase()) {
        alert("Only the admin can resolve disputes.");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      await resolveDispute(refundBuyer, { signer });

      alert("Dispute resolved successfully.");
    } catch (error) {
      console.error("Error resolving dispute:", error);
      alert(error.reason || "Transaction failed.");
    }
  };

  return (
    <div>
      <h3>Resolve Dispute</h3>
      {userAddress.toLowerCase() === adminAddress.toLowerCase() ? (
        <>
          <button onClick={() => handleResolve(true)} style={{ marginRight: "10px", padding: "10px" }}>
            Refund Buyer
          </button>
          <button onClick={() => handleResolve(false)} style={{ padding: "10px" }}>
            Pay Seller
          </button>
        </>
      ) : (
        <p style={{ color: "red", fontWeight: "bold" }}>❌ Access Denied: Only Admin Can Resolve Disputes</p>
      )}
    </div>
  );
}
