import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import FabricDetail from "./pages/FabricDetail";
import Login from "./auth/Login";
import { RequireAuth } from "./auth/RequireAuth";
import AdminLayout from "./admin/AdminLayout";
import Dashboard from "./admin/Dashboard";
import FabricList from "./admin/FabricList";
import FabricForm from "./admin/FabricForm";
import FabricImport from "./admin/FabricImport";
import DictManager from "./admin/DictManager";
import UserManager from "./admin/UserManager";
import AuditLog from "./admin/AuditLog";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/fabric/:id" element={<FabricDetail />} />
      <Route path="/index.html" element={<Navigate to="/" replace />} />

      <Route path="/admin/login" element={<Login />} />
      <Route
        path="/admin/*"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="fabrics" element={<FabricList />} />
        <Route path="fabrics/new" element={<FabricForm />} />
        <Route path="fabrics/import" element={<FabricImport />} />
        <Route path="fabrics/:id/edit" element={<FabricForm />} />
        <Route path="dict/:type" element={<DictManager />} />
        <Route
          path="users"
          element={
            <RequireAuth role="admin">
              <UserManager />
            </RequireAuth>
          }
        />
        <Route
          path="audit"
          element={
            <RequireAuth role="admin">
              <AuditLog />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
