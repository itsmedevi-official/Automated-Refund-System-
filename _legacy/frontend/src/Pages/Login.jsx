import React, { useState } from "react";
import { ethers } from "ethers";

export default function Login({ onLogin }) {
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      const wallet = new ethers.Wallet(privateKey);
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const balance = await provider.getBalance(wallet.address);
      
      onLogin(wallet.address, ethers.formatEther(balance));
      alert(`Logged in as ${wallet.address}\nBalance: ${ethers.formatEther(balance)} ETH`);
      setError("");
    } catch (err) {
      setError("Invalid Private Key. Please try again.");
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <input
        type="password"
        placeholder="Enter Private Key"
        value={privateKey}
        onChange={(e) => setPrivateKey(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
