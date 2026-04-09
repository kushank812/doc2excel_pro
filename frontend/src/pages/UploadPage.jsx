import { useMemo, useRef, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

function getFilenameFromDisposition(contentDisposition, fallback = "ai_extract.xlsx") {
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

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function getFileCategory(file) {
  if (!file) return "";
  if (file.type === "application/pdf") return "PDF Document";
  if (file.type.startsWith("image/")) return "Image File";
  return file.type || "Unknown";
}

export default function UploadPage() {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastDownloadedFile, setLastDownloadedFile] = useState("");

  const acceptedText = useMemo(
    () => "PDF, PNG, JPG, JPEG, WEBP",
    []
  );

  function validateFile(selectedFile) {
    if (!selectedFile) return "Please select a file first.";

    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpg",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowed.includes(selectedFile.type)) {
      return "Only PDF, PNG, JPG, JPEG, and WEBP files are supported.";
    }

    return "";
  }

  function handleFileSelection(selectedFile) {
    const validationError = validateFile(selectedFile);

    if (validationError) {
      setFile(null);
      setError(validationError);
      setSuccess("");
      setLastDownloadedFile("");
      return;
    }

    setFile(selectedFile);
    setError("");
    setSuccess("");
    setLastDownloadedFile("");
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function onInputChange(e) {
    const selectedFile = e.target.files?.[0] || null;
    handleFileSelection(selectedFile);
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    setDragging(false);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const selectedFile = e.dataTransfer.files?.[0] || null;
    handleFileSelection(selectedFile);
  }

  async function handleUpload(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLastDownloadedFile("");

    if (!file) {
      setError("Please select a file first.");
      return;
    }

    try {
      setLoading(true);

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${API_BASE}/api/documents/ai-upload-extract-export`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const message = await parseError(res);
        throw new Error(message);
      }

      const downloadedName = await downloadExcelResponse(
        res,
        `${file.name.replace(/\.[^/.]+$/, "") || "ai_extract"}_extracted.xlsx`
      );

      setLastDownloadedFile(downloadedName);
      setSuccess("Excel file downloaded successfully.");
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={glowTopRightStyle} />
        <div style={glowBottomLeftStyle} />

        <div style={heroHeaderStyle}>
          <div style={heroTextWrapStyle}>
            <div style={heroBadgeStyle}>Main Mode • AI Extract</div>
            <h1 style={titleStyle}>AI Document to Excel</h1>
            <p style={mutedStyle}>
              Upload a PDF or image and extract structured data into Excel using
              AI-powered extraction. The generated Excel file is downloaded directly
              after processing.
            </p>
          </div>

          <div style={heroSideCardStyle}>
            <div style={heroSideTitleStyle}>Best for</div>
            <div style={heroPointsStyle}>
              <div style={pointRowStyle}><span style={pointDotStyle} />Multi-page PDFs</div>
              <div style={pointRowStyle}><span style={pointDotStyle} />Scanned documents</div>
              <div style={pointRowStyle}><span style={pointDotStyle} />Messy layouts</div>
              <div style={pointRowStyle}><span style={pointDotStyle} />Table-heavy files</div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleUpload}
          style={{ display: "grid", gap: 18, marginTop: 28, position: "relative", zIndex: 1 }}
        >
          <label
            style={{
              ...uploadBoxStyle,
              ...(dragging ? uploadBoxDraggingStyle : null),
            }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={openPicker}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={onInputChange}
              style={{ display: "none" }}
            />

            <div style={uploadIconShellStyle}>
              <div style={uploadIconStyle}>⤴</div>
            </div>

            <div style={uploadTitleStyle}>
              {file ? "File selected successfully" : "Drag & drop your file here"}
            </div>

            <div style={uploadSubStyle}>
              {file
                ? "Your file is ready. Click extract to generate the Excel file."
                : "Drop a PDF or image here, or click to browse from your device."}
            </div>

            <div style={supportBadgeStyle}>Supported: {acceptedText}</div>
          </label>

          {file ? (
            <div style={fileCardStyle}>
              <div style={fileCardGridStyle}>
                <div>
                  <div style={labelMiniStyle}>File Name</div>
                  <div style={valueMiniStyle} title={file.name}>
                    {file.name}
                  </div>
                </div>

                <div>
                  <div style={labelMiniStyle}>Size</div>
                  <div style={valueMiniStyle}>{formatBytes(file.size)}</div>
                </div>

                <div>
                  <div style={labelMiniStyle}>Type</div>
                  <div style={valueMiniStyle}>{getFileCategory(file)}</div>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <div style={errorStyle}>{error}</div> : null}

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
              {loading ? "Extracting with AI..." : "Upload and Extract"}
            </button>

            <div style={helperTextStyle}>
              Higher quality extraction with direct Excel download.
            </div>
          </div>
        </form>
      </section>

      <section style={infoGridStyle}>
        <div style={miniCardStyle}>
          <div style={miniCardTitleStyle}>AI Understanding</div>
          <div style={miniCardTextStyle}>
            Understands document structure, relationships, and layout — not just OCR text.
          </div>
        </div>

        <div style={miniCardStyle}>
          <div style={miniCardTitleStyle}>Direct Download</div>
          <div style={miniCardTextStyle}>
            The extracted workbook downloads immediately after processing for a smoother workflow.
          </div>
        </div>

        <div style={miniCardStyle}>
          <div style={miniCardTitleStyle}>Deployment Safe</div>
          <div style={miniCardTextStyle}>
            No permanent server storage is needed for uploads or generated files.
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
  position: "relative",
  overflow: "hidden",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,255,0.98) 55%, rgba(239,244,255,0.98) 100%)",
  border: "1px solid #dbe4f0",
  borderRadius: 28,
  padding: 32,
  boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
};

const glowTopRightStyle = {
  position: "absolute",
  top: -90,
  right: -90,
  width: 220,
  height: 220,
  borderRadius: "50%",
  background: "rgba(59,130,246,0.08)",
  pointerEvents: "none",
};

const glowBottomLeftStyle = {
  position: "absolute",
  bottom: -70,
  left: -70,
  width: 180,
  height: 180,
  borderRadius: "50%",
  background: "rgba(99,102,241,0.08)",
  pointerEvents: "none",
};

const heroHeaderStyle = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 0.9fr)",
  gap: 24,
};

const heroTextWrapStyle = {
  display: "grid",
  gap: 12,
};

const heroBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "10px 16px",
  borderRadius: 999,
  background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
  color: "#3730a3",
  fontWeight: 800,
  fontSize: 14,
  letterSpacing: 0.2,
  border: "1px solid #dbe4ff",
};

const heroSideCardStyle = {
  background: "rgba(255,255,255,0.94)",
  border: "1px solid #dbe4f0",
  borderRadius: 22,
  padding: 22,
  alignSelf: "start",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.05)",
};

const heroSideTitleStyle = {
  fontSize: 14,
  fontWeight: 900,
  color: "#64748b",
  marginBottom: 14,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const heroPointsStyle = {
  display: "grid",
  gap: 14,
  color: "#0f172a",
  fontSize: 16,
  lineHeight: 1.5,
  fontWeight: 700,
};

const pointRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const pointDotStyle = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
  boxShadow: "0 0 0 4px rgba(59,130,246,0.10)",
  flexShrink: 0,
};

const titleStyle = {
  marginTop: 0,
  marginBottom: 0,
  fontSize: "clamp(34px, 5vw, 56px)",
  fontWeight: 900,
  color: "#0f172a",
  lineHeight: 1.04,
  letterSpacing: "-0.03em",
};

const mutedStyle = {
  color: "#64748b",
  margin: 0,
  fontSize: 18,
  lineHeight: 1.8,
  maxWidth: 760,
};

const uploadBoxStyle = {
  border: "2px dashed rgba(148, 163, 184, 0.75)",
  borderRadius: 28,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  minHeight: 280,
  padding: 32,
  display: "grid",
  gap: 12,
  justifyItems: "center",
  alignContent: "center",
  cursor: "pointer",
  textAlign: "center",
  transition: "all 0.2s ease",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.45)",
};

const uploadBoxDraggingStyle = {
  border: "2px solid #2563eb",
  background: "linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%)",
  boxShadow: "0 16px 40px rgba(37,99,235,0.12)",
};

const uploadIconShellStyle = {
  width: 88,
  height: 88,
  borderRadius: 24,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.12))",
  boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.18)",
  marginBottom: 4,
};

const uploadIconStyle = {
  color: "#1d4ed8",
  fontSize: 34,
  fontWeight: 900,
  lineHeight: 1,
};

const uploadTitleStyle = {
  fontSize: 30,
  fontWeight: 900,
  color: "#0f172a",
  lineHeight: 1.15,
};

const uploadSubStyle = {
  color: "#64748b",
  fontSize: 17,
  lineHeight: 1.75,
  maxWidth: 760,
};

const supportBadgeStyle = {
  marginTop: 4,
  color: "#475569",
  fontSize: 14,
  fontWeight: 700,
  padding: "10px 14px",
  borderRadius: 999,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const fileCardStyle = {
  padding: 20,
  background: "rgba(255,255,255,0.95)",
  border: "1px solid #dbe4f0",
  borderRadius: 22,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
};

const fileCardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
};

const labelMiniStyle = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const valueMiniStyle = {
  color: "#0f172a",
  fontWeight: 800,
  wordBreak: "break-word",
  fontSize: 17,
};

const errorStyle = {
  color: "#991b1b",
  background: "#fef2f2",
  padding: 16,
  borderRadius: 16,
  border: "1px solid #fecaca",
  fontWeight: 700,
  boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
};

const successStyle = {
  color: "#166534",
  background: "#f0fdf4",
  padding: 16,
  borderRadius: 16,
  border: "1px solid #bbf7d0",
  boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
};

const successTitleStyle = {
  fontWeight: 900,
};

const successSubStyle = {
  marginTop: 6,
  fontSize: 14,
  fontWeight: 600,
};

const buttonRowStyle = {
  display: "flex",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
};

const buttonStyle = {
  background: "linear-gradient(135deg, #0f172a 0%, #111827 100%)",
  color: "#fff",
  border: "1px solid #0f172a",
  padding: "18px 28px",
  borderRadius: 18,
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 22,
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
  minWidth: 240,
};

const helperTextStyle = {
  color: "#64748b",
  fontSize: 17,
  fontWeight: 600,
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 18,
};

const miniCardStyle = {
  background: "rgba(255,255,255,0.94)",
  border: "1px solid #dbe4f0",
  borderRadius: 22,
  padding: 24,
  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)",
};

const miniCardTitleStyle = {
  fontSize: 28,
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 10,
  lineHeight: 1.12,
};

const miniCardTextStyle = {
  color: "#64748b",
  lineHeight: 1.8,
  fontSize: 17,
  fontWeight: 500,
};