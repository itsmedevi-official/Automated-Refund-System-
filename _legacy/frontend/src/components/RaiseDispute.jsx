import React, { useState } from "react";
import { raiseDispute } from "../contract";

export default function RaiseDispute() {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const disputeReasons = [
    "Product not received",
    "Product damaged or defective",
    "Wrong item delivered",
    "Seller not responding",
    "Other",
  ];

  const handleRaiseDispute = async () => {
    let reasonToSend = selectedReason === "Other" ? customReason : selectedReason;
    if (!reasonToSend) {
      alert("Please select or enter a reason for the dispute.");
      return;
    }

    await raiseDispute(reasonToSend);
    setSelectedReason("");
    setCustomReason("");
  };

  return (
    <div>
      <h2>Raise a Dispute</h2>
      <label>Select a reason:</label>
      <select value={selectedReason} onChange={(e) => setSelectedReason(e.target.value)}>
        <option value="">-- Select a reason --</option>
        {disputeReasons.map((reason, index) => (
          <option key={index} value={reason}>
            {reason}
          </option>
        ))}
      </select>

      {selectedReason === "Other" && (
        <>
          <label>Enter custom reason:</label>
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Describe your issue..."
          />
        </>
      )}

      <button onClick={handleRaiseDispute}>Raise Dispute</button>
    </div>
  );
}
