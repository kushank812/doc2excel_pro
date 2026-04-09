import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import UploadPage from "./pages/UploadPage";
import DocumentDetailPage from "./pages/DocumentDetailPage";
import SmartExtract from "./pages/SmartExtract";

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #f8fbff 0%, #f4f7fb 40%, #eef3f9 100%)",
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Navbar />

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "28px 16px 40px",
          boxSizing: "border-box",
        }}
      >
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/smart-extract" element={<SmartExtract />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}