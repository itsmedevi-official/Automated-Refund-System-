import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AdminSettings from "./pages/AdminSettings";
import BuyerDashboard from "./pages/BuyerDashboard";
import CreateDeal from "./pages/CreateDeal";
import DealDetails from "./pages/DealDetails";
import DeliveryAgentDashboard from "./pages/DeliveryAgentDashboard";
import EscrowAgentDashboard from "./pages/EscrowAgentDashboard";
import Explorer from "./pages/Explorer";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import SellerDashboard from "./pages/SellerDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="buyer" element={<BuyerDashboard />} />
        <Route path="buyer/new" element={<CreateDeal />} />
        <Route path="seller" element={<SellerDashboard />} />
        <Route path="delivery" element={<DeliveryAgentDashboard />} />
        <Route path="agent" element={<EscrowAgentDashboard />} />
        <Route path="deals" element={<Explorer />} />
        <Route path="deals/:dealId" element={<DealDetails />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="explorer" element={<Navigate to="/deals" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
