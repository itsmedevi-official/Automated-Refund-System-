import { NavLink, Outlet } from "react-router-dom";
import WalletButton from "./WalletButton";
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  NETWORK_NAME,
  isConfigured,
} from "../services/contract";
import { formatAddress } from "../services/format";
import { useWallet } from "../hooks/useWallet";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/buyer", label: "Buyer" },
  { to: "/seller", label: "Seller" },
  { to: "/delivery", label: "Delivery agent" },
  { to: "/agent", label: "Escrow agent" },
  { to: "/deals", label: "Explorer" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  const { error, clearError } = useWallet();

  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            SE
          </span>
          <span className="brand-text">
            <strong>SmartEscrow</strong>
            <small>OTP + geolocation escrow</small>
          </span>
        </NavLink>
        <WalletButton />
      </header>

      <nav className="app-nav" aria-label="Main navigation">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {error && (
        <div className="banner banner-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="notice-close" onClick={clearError} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {!isConfigured && (
        <div className="banner banner-danger" role="alert">
          No contract address found in <code>src/config.json</code>. Start the chain and run
          <code> npx hardhat run scripts/deploy.js --network localhost</code> from the backend.
        </div>
      )}

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <span>
          Local Hardhat demo · chain {CHAIN_ID} · {NETWORK_NAME}
        </span>
        <span>Contract {isConfigured ? formatAddress(CONTRACT_ADDRESS, 6) : "not deployed"}</span>
      </footer>
    </div>
  );
}
