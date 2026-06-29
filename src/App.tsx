import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import FabricDetail from "./pages/FabricDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/fabric/:id" element={<FabricDetail />} />
      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
