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
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* TOP NAVBAR (Logo is inside this) */}
      <Navbar />

      {/* MAIN CONTENT */}
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "24px 16px",
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