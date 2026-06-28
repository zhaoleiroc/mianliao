import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Fabrics from "./pages/Fabrics";
import FabricDetail from "./pages/FabricDetail";
import Suppliers from "./pages/Suppliers";
import Compare from "./pages/Compare";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/fabrics" element={<Fabrics />} />
        <Route path="/fabrics/:id" element={<FabricDetail />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/about" element={<About />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
