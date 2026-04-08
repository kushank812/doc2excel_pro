import { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function HistoryPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/documents/history`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.detail || "Failed");

      setData(json);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1>Document History</h1>

      {loading && <p>Loading...</p>}

      {err && (
        <div style={{ color: "red" }}>
          {err}
        </div>
      )}

      {!loading && data.length === 0 && (
        <div
          style={{
            background: "#fff3cd",
            padding: 12,
            borderRadius: 8,
          }}
        >
          No documents processed yet
        </div>
      )}

      {data.map((doc) => (
        <div
          key={doc.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 16,
            marginBottom: 12,
            background: "#fff",
          }}
        >
          <div><b>{doc.file_name}</b></div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {new Date(doc.timestamp).toLocaleString()}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <a
              href={`${API_BASE}${doc.excel_url}`}
              target="_blank"
            >
              Download Excel
            </a>

            <a
              href={`${API_BASE}${doc.json_url}`}
              target="_blank"
            >
              JSON
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}