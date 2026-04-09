import { useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

function getFilenameFromDisposition(contentDisposition, fallback = "basic_extract.xlsx") {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }

  return fallback;
}

async function downloadExcelResponse(res, fallbackName) {
  const blob = await res.blob();
  const contentDisposition = res.headers.get("content-disposition") || "";
  const fileName = getFilenameFromDisposition(contentDisposition, fallbackName);

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);

  return fileName;
}

async function parseError(res) {
  const contentType = res.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return data?.detail || data?.message || data?.error || `HTTP ${res.status}`;
    }

    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export default function SmartExtract() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [lastDownloadedFile, setLastDownloadedFile] = useState("");

  async function handleUpload(e) {
    e.preventDefault();
    setErr("");
    setSuccess("");
    setLastDownloadedFile("");

    if (!file) {
      setErr("Please select a file first.");
      return;
    }

    try {
      setLoading(true);

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${API_BASE}/api/documents/upload-extract-export`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const message = await parseError(res);
        throw new Error(message);
      }

      const downloadedName = await downloadExcelResponse(
        res,
        `${file.name.replace(/\.[^/.]+$/, "") || "basic_extract"}_extracted.xlsx`
      );

      setLastDownloadedFile(downloadedName);
      setSuccess("Excel file downloaded successfully.");
    } catch (e) {
      setErr(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroHeaderStyle}>
          <div style={heroTextWrapStyle}>
            <div style={heroBadgeStyle}>Fallback Mode • Basic Extract</div>
            <h1 style={titleStyle}>Basic Document to Excel</h1>
            <p style={mutedStyle}>
              Upload a PDF or image and extract structured data into Excel using
              the basic parser. The generated Excel file is downloaded directly
              after processing.
            </p>
          </div>

          <div style={heroSideCardStyle}>
            <div style={heroSideTitleStyle}>Best for</div>
            <div style={heroPointsStyle}>
              <div>• Cleaner PDFs</div>
              <div>• Simple layouts</div>
              <div>• Lower-cost extraction</div>
              <div>• Backup/fallback usage</div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleUpload}
          style={{ display: "grid", gap: 16, marginTop: 24 }}
        >
          <label style={uploadBoxStyle}>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />

            <div style={uploadIconStyle}>⇪</div>
            <div style={uploadTitleStyle}>
              {file ? "File selected successfully" : "Choose a PDF or image"}
            </div>
            <div style={uploadSubStyle}>
              Supported: PDF, PNG, JPG, JPEG, WEBP
            </div>
          </label>

          {file ? (
            <div style={fileCardStyle}>
              <div style={fileCardGridStyle}>
                <div>
                  <div style={labelMiniStyle}>File Name</div>
                  <div style={valueMiniStyle}>{file.name}</div>
                </div>
                <div>
                  <div style={labelMiniStyle}>Size</div>
                  <div style={valueMiniStyle}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <div>
                  <div style={labelMiniStyle}>Type</div>
                  <div style={valueMiniStyle}>{file.type || "Unknown"}</div>
                </div>
              </div>
            </div>
          ) : null}

          {err ? <div style={errorStyle}>{err}</div> : null}

          {success ? (
            <div style={successStyle}>
              <div style={successTitleStyle}>{success}</div>
              {lastDownloadedFile ? (
                <div style={successSubStyle}>Downloaded file: {lastDownloadedFile}</div>
              ) : null}
            </div>
          ) : null}

          <div style={buttonRowStyle}>
            <button disabled={loading} type="submit" style={buttonStyle}>
              {loading ? "Extracting..." : "Basic Extract"}
            </button>

            <div style={helperTextStyle}>
              Best used for cleaner files or when AI mode is unnecessary.
            </div>
          </div>
        </form>
      </section>

      <section style={infoGridStyle}>
        <div style={miniCardStyle}>
          <div style={miniCardTitleStyle}>Basic Parsing</div>
          <div style={miniCardTextStyle}>
            Uses the basic extraction flow for simpler documents.
          </div>
        </div>
        <div style={miniCardStyle}>
          <div style={miniCardTitleStyle}>Direct Download</div>
          <div style={miniCardTextStyle}>
            The extracted workbook downloads immediately after processing.
          </div>
        </div>
        <div style={miniCardStyle}>
          <div style={miniCardTitleStyle}>Fallback Mode</div>
          <div style={miniCardTextStyle}>
            A useful backup when you do not need the full AI pipeline.
          </div>
        </div>
      </section>
    </div>
  );
}

const pageStyle = {
  display: "grid",
  gap: 24,
};

const heroCardStyle = {
  background:
    "linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 28,
  boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
};

const heroHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(260px, 0.9fr)",
  gap: 18,
};

const heroTextWrapStyle = {
  display: "grid",
  gap: 10,
};

const heroBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#334155",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 0.4,
};

const heroSideCardStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  alignSelf: "start",
};

const heroSideTitleStyle = {
  fontSize: 14,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 10,
};

const heroPointsStyle = {
  display: "grid",
  gap: 8,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.5,
};

const titleStyle = {
  marginTop: 0,
  marginBottom: 0,
  fontSize: 34,
  fontWeight: 900,
  color: "#0f172a",
  lineHeight: 1.1,
};

const mutedStyle = {
  color: "#64748b",
  margin: 0,
  fontSize: 15,
  lineHeight: 1.7,
  maxWidth: 760,
};

const uploadBoxStyle = {
  border: "1.5px dashed #94a3b8",
  borderRadius: 16,
  background: "#ffffff",
  padding: 24,
  display: "grid",
  gap: 8,
  justifyItems: "center",
  cursor: "pointer",
  textAlign: "center",
};

const uploadIconStyle = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  background: "#f1f5f9",
  color: "#334155",
  fontSize: 24,
  fontWeight: 900,
};

const uploadTitleStyle = {
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
};

const uploadSubStyle = {
  color: "#64748b",
  fontSize: 14,
};

const fileCardStyle = {
  padding: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
};

const fileCardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
};

const labelMiniStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const valueMiniStyle = {
  color: "#0f172a",
  fontWeight: 700,
  wordBreak: "break-word",
};

const errorStyle = {
  color: "#b91c1c",
  background: "#fef2f2",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #fecaca",
  fontWeight: 600,
};

const successStyle = {
  color: "#166534",
  background: "#ecfdf5",
  padding: 14,
  borderRadius: 12,
  border: "1px solid #86efac",
};

const successTitleStyle = {
  fontWeight: 800,
};

const successSubStyle = {
  marginTop: 4,
  fontSize: 14,
};

const buttonRowStyle = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
};

const buttonStyle = {
  background: "#0f172a",
  color: "#fff",
  border: "none",
  padding: "14px 22px",
  borderRadius: 12,
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 15,
  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.12)",
};

const helperTextStyle = {
  color: "#64748b",
  fontSize: 14,
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const miniCardStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
};

const miniCardTitleStyle = {
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 8,
};

const miniCardTextStyle = {
  color: "#64748b",
  lineHeight: 1.6,
  fontSize: 14,
};