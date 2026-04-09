import { Link, useLocation } from "react-router-dom";

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
          padding: "8px 14px 8px 6px", // very small left padding
          boxSizing: "border-box",
        }}
      >
        {/* LEFT CORNER LOGO */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            minWidth: 0,
            margin: 0,
            padding: 0,
          }}
        >
          <img
            src="/logo.png"
            alt="Sofvent"
            style={{
              height: "48px",
              width: "auto",
              display: "block",
              margin: 0,
              padding: 0,
              objectFit: "contain",
            }}
          />
        </div>

        {/* RIGHT SIDE NAV */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginLeft: "auto",
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
    outline: "none",
    boxShadow: "none",
  };
}