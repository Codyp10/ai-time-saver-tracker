import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Report } from "@/pages/Report";
import { History } from "@/pages/History";
import { Settings } from "@/pages/Settings";
import { MethodologyPage } from "@/pages/MethodologyPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="report/:monthKey" element={<Report />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
          <Route path="methodology" element={<MethodologyPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
