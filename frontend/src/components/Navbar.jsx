// src/components/Navbar.jsx

import { Link, useLocation } from "react-router-dom";
import logo from "../assets/sofvent-logo.png";

export default function Navbar() {
  const location = useLocation();

  function isActive(path) {
    return location.pathname === path;
  }

  return (
    <div
      style={{
        width: "100%",
        borderBottom: "1px solid #e5e7eb",
        background: "#ffffff",
        padding: "10px 20px",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* LEFT: LOGO ONLY (NO TEXT NEEDED NOW) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <img
            src={logo}
            alt="Sofvent Logo"
            style={{
              height: "45px",       // IMPORTANT: control height only
              width: "auto",        // keeps aspect ratio correct
              objectFit: "contain",
            }}
          />
        </div>

        {/* RIGHT: NAV BUTTONS */}
        <div style={{ display: "flex", gap: "10px" }}>
          <Link to="/">
            <button
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                background: isActive("/") ? "#000" : "#fff",
                color: isActive("/") ? "#fff" : "#000",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              AI Extract ⭐
            </button>
          </Link>

          <Link to="/basic">
            <button
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                background: isActive("/basic") ? "#000" : "#fff",
                color: isActive("/basic") ? "#fff" : "#000",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Basic Extract
            </button>
          </Link>

          <Link to="/history">
            <button
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                background: isActive("/history") ? "#000" : "#fff",
                color: isActive("/history") ? "#fff" : "#000",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              History
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}