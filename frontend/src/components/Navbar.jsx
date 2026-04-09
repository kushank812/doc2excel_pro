// src/components/Navbar.jsx

import { Link, useLocation } from "react-router-dom";
import logo from "../assets/sofvent-logo.png";

export default function Navbar() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header
      style={{
        width: "100%",
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          width: "100%",                 // FULL WIDTH
          padding: "10px 20px",          // small side padding
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* LEFT LOGO */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <img
            src={logo}
            alt="Sofvent"
            style={{
              height: "45px",
              width: "auto",
              display: "block",
            }}
          />
        </div>

        {/* RIGHT NAV */}
        <nav style={{ display: "flex", gap: "10px" }}>
          <Link to="/">
            <button style={btnStyle(isActive("/"))}>
              AI Extract ⭐
            </button>
          </Link>

          <Link to="/basic">
            <button style={btnStyle(isActive("/basic"))}>
              Basic Extract
            </button>
          </Link>

          <Link to="/history">
            <button style={btnStyle(isActive("/history"))}>
              History
            </button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function btnStyle(active) {
  return {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : "#111827",
    fontWeight: "500",
    cursor: "pointer",
  };
}