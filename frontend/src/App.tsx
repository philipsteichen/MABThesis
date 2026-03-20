import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import BasisAnalysis from "./pages/BasisAnalysis";
import BasisForecast from "./pages/BasisForecast";
import PriceForecast from "./pages/PriceForecast";
import RiskMetrics from "./pages/RiskMetrics";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analysis" element={<BasisAnalysis />} />
        <Route path="/forecast" element={<BasisForecast />} />
        <Route path="/price-forecast" element={<PriceForecast />} />
        <Route path="/risk" element={<RiskMetrics />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
