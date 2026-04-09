import { Link, useLocation } from "react-router-dom";
import logo from "../assets/sofvent-logo.png"; // ✅ THIS IS KEY

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
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px 6px 0", // LEFT SIDE = 0
          boxSizing: "border-box",
        }}
      >
        {/* LEFT CORNER LOGO */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: 0,
            padding: 0,
          }}
        >
          <img
            src={logo}   // ✅ USE IMPORTED IMAGE
            alt="Sofvent"
            style={{
              height: "52px",
              width: "auto",
              display: "block",
              objectFit: "contain",
            }}
          />
        </div>

        {/* RIGHT NAV */}
        <nav
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginLeft: "auto",
            paddingRight: "10px",
          }}
        >
          <Link to="/" style={{ textDecoration: "none" }}>
            <button style={btnStyle(isActive("/"))}>AI Extract ⭐</button>
          </Link>

          <Link to="/smart-extract" style={{ textDecoration: "none" }}>
            <button style={btnStyle(isActive("/smart-extract"))}>
              Basic Extract
            </button>
          </Link>

          <Link to="/history" style={{ textDecoration: "none" }}>
            <button style={btnStyle(isActive("/history"))}>History</button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function btnStyle(active) {
  return {
    padding: "10px 16px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    background: active ? "#0f172a" : "#ffffff",
    color: active ? "#ffffff" : "#0f172a",
    fontWeight: 600,
    fontSize: "15px",
    cursor: "pointer",
  };
}