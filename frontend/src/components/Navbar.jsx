import { Link, useLocation } from "react-router-dom";
import logo from "../assets/sofvent-logo.png";

export default function Navbar() {
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <header
      style={{
        width: "100%",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #e2e8f0",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "100%",
          minHeight: 78,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px 8px 6px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: 0,
            padding: 0,
          }}
        >
          <img
            src={logo}
            alt="Sofvent"
            style={{
              height: "54px",
              width: "auto",
              display: "block",
              objectFit: "contain",
            }}
          />
        </div>

        <nav
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginLeft: "auto",
          }}
        >
          <Link to="/" style={{ textDecoration: "none" }}>
            <button style={btnStyle(isActive("/"))}>AI Extract ✨</button>
          </Link>

          <Link to="/smart-extract" style={{ textDecoration: "none" }}>
            <button style={btnStyle(isActive("/smart-extract"))}>
              Basic Extract
            </button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function btnStyle(active) {
  return {
    padding: "11px 18px",
    borderRadius: "14px",
    border: active ? "1px solid #0f172a" : "1px solid #dbe1ea",
    background: active
      ? "linear-gradient(135deg, #0f172a 0%, #111827 100%)"
      : "#ffffff",
    color: active ? "#ffffff" : "#0f172a",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
    boxShadow: active
      ? "0 10px 24px rgba(15, 23, 42, 0.18)"
      : "0 4px 12px rgba(15, 23, 42, 0.05)",
    transition: "all 0.2s ease",
  };
}