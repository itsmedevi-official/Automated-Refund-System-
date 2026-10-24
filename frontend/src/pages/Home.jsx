import { Link } from "react-router-dom";
import Notice from "../components/Notice";
import { useEscrowConfig } from "../hooks/useEscrow";
import { CONTRACT_ADDRESS, NETWORK_NAME, isConfigured } from "../services/contract";
import { formatAddress } from "../services/format";

const STEPS = [
  {
    title: "Deposit",
    text: "The buyer creates a deal and locks the agreed amount in the SmartEscrow contract.",
  },
  {
    title: "OTP",
    text: "The delivery agent generates a 4-digit code on-chain right before handing over the parcel.",
  },
  {
    title: "Verify",
    text: "The agent verifies the code together with their GPS position; the buyer's position is stored too.",
  },
  {
    title: "Settle",
    text: "No dispute within the window: the seller is paid. A dispute is settled by the distance rule or escalated.",
  },
];

const ROLES = [
  {
    to: "/buyer",
    title: "Buyer",
    text: "Create a deal, share the OTP, raise a dispute if the parcel never arrives.",
  },
  {
    to: "/seller",
    title: "Seller",
    text: "Track the locked funds and see when the escrow releases them.",
  },
  {
    to: "/delivery",
    title: "Delivery agent",
    text: "Generate the OTP and verify the drop-off location.",
  },
  {
    to: "/agent",
    title: "Escrow agent",
    text: "Review escalated cases and decide the outcome.",
  },
];

export default function Home() {
  const { config, loading, error } = useEscrowConfig();

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Blockchain escrow demo</span>
          <h1>Escrow that verifies the delivery, not just the promise.</h1>
          <p className="lead">
            Funds stay locked in a smart contract until delivery is proven with an OTP and an
            on-chain geolocation check. If something goes wrong the contract resolves the
            dispute itself - or hands it to the escrow agent when the evidence is not enough.
          </p>
          <div className="row wrap">
            <Link className="btn btn-primary" to="/buyer">
              Create an escrow deal
            </Link>
            <Link className="btn btn-ghost" to="/deals">
              Browse deals
            </Link>
          </div>
        </div>

        <aside className="hero-card">
          <h3>Live contract</h3>
          {loading && <p className="muted">Loading configuration…</p>}
          {error && <Notice tone="error">{error}</Notice>}
          {config && (
            <dl className="kv">
              <div>
                <dt>Deals created</dt>
                <dd>{config.totalDeals}</dd>
              </div>
              <div>
                <dt>Distance threshold</dt>
                <dd>{config.distanceThreshold} m</dd>
              </div>
              <div>
                <dt>Dispute window</dt>
                <dd>{config.disputeWindow} s</dd>
              </div>
              <div>
                <dt>Escrow agent</dt>
                <dd className="mono" title={config.escrowAgent}>
                  {formatAddress(config.escrowAgent)}
                </dd>
              </div>
            </dl>
          )}
          <p className="muted small">
            Network {NETWORK_NAME} · contract{" "}
            {isConfigured ? formatAddress(CONTRACT_ADDRESS, 6) : "not deployed"}
          </p>
        </aside>
      </section>

      <section className="page-section">
        <h2>How a deal works</h2>
        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="step-number">{index + 1}</span>
              <h3>{step.title}</h3>
              <p className="muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="page-section">
        <h2>Pick your role</h2>
        <div className="grid grid-2">
          {ROLES.map((role) => (
            <Link key={role.to} to={role.to} className="role-card">
              <h3>{role.title}</h3>
              <p className="muted">{role.text}</p>
              <span className="role-link">Open dashboard →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="page-section panel">
        <h2>Run the demo locally</h2>
        <p className="muted">
          Everything runs on a free Hardhat chain - no real ETH is involved. The backend deploys
          the contract, writes the address into the frontend and creates a few demo deals.
        </p>
        <pre className="code-block">{`cd backend
npx hardhat node                                    # terminal 1
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/seed-demo.js --network localhost
cd ../frontend && npm run dev                       # terminal 2`}</pre>
        <p className="muted small">
          Import the Hardhat test accounts into MetaMask (mnemonic
          <code> test test test test test test test test test test test junk</code>) and connect
          to <code>http://127.0.0.1:8545</code>, chain id 31337.
        </p>
      </section>
    </div>
  );
}
