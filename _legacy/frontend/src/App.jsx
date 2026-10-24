//3-3-2025 refactor App.jsx

import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import BuyerPage from "./Pages/BuyerPage";
import DisputePage from "./Pages/DisputePage";
import DeliveryVerificationPage from "./Pages/DeliveryVerificationPage";
import './App.css';

export default function App() {
  return (
    <Router>
      <div className="container">
        <h2>Welcome to Blockchain Escrow</h2>
        <nav className="navbar">
          <Link to="/buyer"><button className="nav-button buyer-btn">Buyer Dashboard</button></Link>
          <Link to="/dispute"><button className="nav-button dispute-btn">Dispute Management</button></Link>
          <Link to="/delivery-verification"><button className="nav-button delivery-btn">Delivery Verification</button></Link>
        </nav>

        <div className="content">
        <Routes>
          <Route path="/" element={<h3>Select a Page</h3>} />
          <Route path="/buyer" element={<BuyerPage />} />
          <Route path="/dispute" element={<DisputePage />} />
          <Route path="/delivery-verification" element={<DeliveryVerificationPage />} />
        </Routes>
        </div>
      </div>
    </Router>
  );
}
