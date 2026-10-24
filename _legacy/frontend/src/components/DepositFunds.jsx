import React, { useState } from "react";
import { depositFunds } from "../contract";

export default function DepositFunds() {
  const [amount, setAmount] = useState("");

  const handleDeposit = async () => {
    if (!amount) {
      alert("Enter an amount");
      return;
    }
    await depositFunds(amount);
    setAmount("");
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Amount in ETH"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ padding: "10px", marginBottom: "10px" }}
      />
      <br />
      <button onClick={handleDeposit} style={{ padding: "10px 20px", marginRight: "10px" }}>
        Deposit Funds
      </button>
    </div>
  );
}
