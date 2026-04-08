import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import UploadPage from "./pages/UploadPage";
import HistoryPage from "./pages/HistoryPage";
import DocumentDetailPage from "./pages/DocumentDetailPage";
import SmartExtract from "./pages/SmartExtract";

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <Navbar />

      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: 24,
        }}
      >
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/smart-extract" element={<SmartExtract />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}