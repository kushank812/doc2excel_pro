import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();

  function linkStyle(path) {
    const active = location.pathname === path;

    return {
      padding: "10px 16px",
      borderRadius: 8,
      textDecoration: "none",
      fontWeight: 600,
      border: active ? "2px solid #111" : "1px solid #ccc",
      background: active ? "#111" : "#fff",
      color: active ? "#fff" : "#111",
      transition: "all 0.2s",
    };
  }

  return (
    <div
      style={{
        width: "100%",
        borderBottom: "1px solid #e2e8f0",
        background: "#ffffff",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18 }}>
          Doc2Excel Pro
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/" style={linkStyle("/")}>
            AI Extract ⭐
          </Link>

          <Link to="/smart-extract" style={linkStyle("/smart-extract")}>
            Basic Extract
          </Link>

          <Link to="/history" style={linkStyle("/history")}>
            History
          </Link>
        </div>
      </div>
    </div>
  );
}