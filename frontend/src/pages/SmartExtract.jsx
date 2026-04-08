import { useMemo, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

function getStatusMeta(status) {
  if (status === "passed") {
    return {
      label: "Passed",
      bg: "#ecfdf5",
      border: "#86efac",
      text: "#166534",
      chipBg: "#dcfce7",
    };
  }

  if (status === "review_recommended") {
    return {
      label: "Review Recommended",
      bg: "#fffbeb",
      border: "#fcd34d",
      text: "#92400e",
      chipBg: "#fef3c7",
    };
  }

  if (status === "review_required") {
    return {
      label: "Review Required",
      bg: "#fef2f2",
      border: "#fca5a5",
      text: "#991b1b",
      chipBg: "#fee2e2",
    };
  }

  return {
    label: "Unknown",
    bg: "#f8fafc",
    border: "#cbd5e1",
    text: "#334155",
    chipBg: "#e2e8f0",
  };
}

function getWarningMeta(level) {
  if (level === "error") {
    return {
      bg: "#fef2f2",
      border: "#fecaca",
      text: "#991b1b",
    };
  }

  if (level === "warning") {
    return {
      bg: "#fffbeb",
      border: "#fde68a",
      text: "#92400e",
    };
  }

  return {
    bg: "#f8fafc",
    border: "#e2e8f0",
    text: "#334155",
  };
}

function getScoreMeta(score) {
  if (score >= 85) {
    return { text: "#166534", bar: "#22c55e", track: "#dcfce7" };
  }
  if (score >= 65) {
    return { text: "#92400e", bar: "#f59e0b", track: "#fef3c7" };
  }
  return { text: "#991b1b", bar: "#ef4444", track: "#fee2e2" };
}

export default function SmartExtract() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  async function handleUpload(e) {
    e.preventDefault();
    setErr("");
    setResult(null);

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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Upload failed");
      }

      setResult(data);
    } catch (e) {
      setErr(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  const validation = result?.validation || null;
  const warnings = validation?.warnings || [];
  const statusMeta = useMemo(
    () => getStatusMeta(validation?.status),
    [validation?.status]
  );
  const scoreMeta = useMemo(
    () => getScoreMeta(validation?.confidence_score || 0),
    [validation?.confidence_score]
  );

  return (
    <div style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroHeaderStyle}>
          <div style={heroTextWrapStyle}>
            <div style={heroBadgeStyle}>Fallback Mode • Basic Extract</div>
            <h1 style={titleStyle}>Basic Document to Excel</h1>
            <p style={mutedStyle}>
              Upload a PDF or image and extract structured data into Excel using
              the basic parser with OCR fallback. Use this mode when you want a
              simpler, cheaper option.
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
            Uses normal parsing and OCR fallback instead of full AI extraction.
          </div>
        </div>
        <div style={miniCardStyle}>
          <div style={miniCardTitleStyle}>Validation Included</div>
          <div style={miniCardTextStyle}>
            Still checks workbook quality, warnings, and confidence score.
          </div>
        </div>
        <div style={miniCardStyle}>
          <div style={miniCardTitleStyle}>Fallback Mode</div>
          <div style={miniCardTextStyle}>
            A useful backup when you do not need the full AI pipeline.
          </div>
        </div>
      </section>

      {result ? (
        <section style={resultCardStyle}>
          <div style={resultHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Extraction Complete</h2>
              <div style={resultMetaGridStyle}>
                <div>
                  <strong>Mode:</strong> {result.mode || "basic"}
                </div>
                <div>
                  <strong>Document ID:</strong> {result.document_id}
                </div>
                <div>
                  <strong>Original File:</strong> {result.original_name}
                </div>
              </div>
            </div>

            <div style={actionRowStyle}>
              <a
                href={`${API_BASE}${result.excel_download_url}`}
                target="_blank"
                rel="noreferrer"
                style={downloadButtonStyle}
              >
                Download Excel
              </a>

              <a
                href={`${API_BASE}${result.json_download_url}`}
                target="_blank"
                rel="noreferrer"
                style={secondaryButtonStyle}
              >
                Download JSON
              </a>
            </div>
          </div>

          {validation ? (
            <div
              style={{
                ...validationCardStyle,
                background: statusMeta.bg,
                border: `1px solid ${statusMeta.border}`,
                color: statusMeta.text,
              }}
            >
              <div style={validationTopRowStyle}>
                <div>
                  <div style={validationTitleStyle}>Validation Result</div>
                  <div style={validationSummaryStyle}>
                    {validation.summary || "Validation summary not available."}
                  </div>
                </div>

                <div
                  style={{
                    ...statusChipStyle,
                    background: statusMeta.chipBg,
                    color: statusMeta.text,
                  }}
                >
                  {statusMeta.label}
                </div>
              </div>

              <div style={scorePanelStyle}>
                <div style={scoreLabelRowStyle}>
                  <span style={scoreLabelStyle}>Confidence Score</span>
                  <span style={{ ...scoreValueStyle, color: scoreMeta.text }}>
                    {validation.confidence_score ?? 0}/100
                  </span>
                </div>

                <div
                  style={{
                    ...scoreTrackStyle,
                    background: scoreMeta.track,
                  }}
                >
                  <div
                    style={{
                      ...scoreBarStyle,
                      background: scoreMeta.bar,
                      width: `${Math.max(
                        0,
                        Math.min(100, validation.confidence_score ?? 0)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div style={warningHeaderWrapStyle}>
                <h3 style={warningTitleStyle}>Warnings</h3>
                <div style={warningCountStyle}>
                  {warnings.length} item{warnings.length === 1 ? "" : "s"}
                </div>
              </div>

              {warnings.length > 0 ? (
                <div style={warningListStyle}>
                  {warnings.map((warning, index) => {
                    const meta = getWarningMeta(warning.level);
                    return (
                      <div
                        key={`${warning.code || "warning"}-${index}`}
                        style={{
                          ...warningCardStyle,
                          background: meta.bg,
                          border: `1px solid ${meta.border}`,
                          color: meta.text,
                        }}
                      >
                        <div style={warningMetaStyle}>
                          <span style={warningPillStyle}>
                            {warning.level || "info"}
                          </span>
                          <span>
                            <strong>Code:</strong> {warning.code || "-"}
                          </span>
                          <span>
                            <strong>Sheet:</strong> {warning.sheet || "-"}
                          </span>
                        </div>
                        <div style={warningMessageStyle}>{warning.message}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={noWarningStyle}>No warnings found.</div>
              )}
            </div>
          ) : null}

          <div style={{ marginTop: 24 }}>
            <h3 style={previewTitleStyle}>Workbook Preview</h3>
            <pre style={previewStyle}>
              {JSON.stringify(result.preview, null, 2)}
            </pre>
          </div>
        </section>
      ) : null}
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

const resultCardStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
};

const resultHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const resultMetaGridStyle = {
  display: "grid",
  gap: 8,
  color: "#334155",
};

const actionRowStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const downloadButtonStyle = {
  display: "inline-block",
  background: "#0f172a",
  color: "#fff",
  textDecoration: "none",
  padding: "12px 18px",
  borderRadius: 12,
  fontWeight: 800,
};

const secondaryButtonStyle = {
  display: "inline-block",
  background: "#fff",
  color: "#0f172a",
  textDecoration: "none",
  border: "1px solid #cbd5e1",
  padding: "12px 18px",
  borderRadius: 12,
  fontWeight: 800,
};

const validationCardStyle = {
  marginTop: 22,
  borderRadius: 18,
  padding: 18,
};

const validationTopRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const validationTitleStyle = {
  fontSize: 18,
  fontWeight: 900,
};

const statusChipStyle = {
  padding: "8px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const validationSummaryStyle = {
  marginTop: 8,
  lineHeight: 1.6,
  maxWidth: 760,
};

const scorePanelStyle = {
  marginTop: 18,
};

const scoreLabelRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 8,
};

const scoreLabelStyle = {
  fontWeight: 800,
  color: "#0f172a",
};

const scoreValueStyle = {
  fontWeight: 900,
  fontSize: 16,
};

const scoreTrackStyle = {
  height: 12,
  borderRadius: 999,
  overflow: "hidden",
};

const scoreBarStyle = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.3s ease",
};

const warningHeaderWrapStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 12,
  marginTop: 20,
  marginBottom: 12,
};

const warningTitleStyle = {
  margin: 0,
  fontSize: 17,
  fontWeight: 900,
  color: "#0f172a",
};

const warningCountStyle = {
  color: "#64748b",
  fontWeight: 700,
};

const warningListStyle = {
  display: "grid",
  gap: 10,
};

const warningCardStyle = {
  borderRadius: 14,
  padding: 14,
};

const warningMetaStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 8,
  fontSize: 13,
};

const warningPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.55)",
  fontWeight: 900,
  textTransform: "uppercase",
  fontSize: 11,
};

const warningMessageStyle = {
  lineHeight: 1.6,
};

const noWarningStyle = {
  padding: 14,
  borderRadius: 12,
  background: "#ecfdf5",
  border: "1px solid #86efac",
  color: "#166534",
  fontWeight: 700,
};

const previewTitleStyle = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
};

const previewStyle = {
  overflowX: "auto",
  padding: 16,
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 14,
  fontSize: 12,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};