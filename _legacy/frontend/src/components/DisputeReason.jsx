import React, { useState } from "react";
import { getDisputeReason } from "../contract";

export default function DisputeReason() {
  const [currentReason, setCurrentReason] = useState("");

  const handleFetchReason = async () => {
    const fetchedReason = await getDisputeReason();
    setCurrentReason(fetchedReason);
  };

  return (
    <div>
      <h3>Current Dispute Reason:</h3>
      <button onClick={handleFetchReason}>Check Dispute Reason</button>
      {currentReason && <p>{currentReason}</p>}
    </div>
  );
}
