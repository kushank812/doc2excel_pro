import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, apiPost, fileUrl } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import TableView from '../components/TableView';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      const data = await apiGet(`/api/documents/${id}`);
      setDoc(data);
    } catch (err) {
      setError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function runAction(path, successMessage) {
    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      const data = await apiPost(path, {});
      if (data.download_url) {
        setMessage(successMessage || 'Done');
        window.open(fileUrl(data.download_url), '_blank');
      } else {
        setDoc(data);
        setMessage(successMessage || 'Done');
      }
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error && !doc) return <div style={errorStyle}>{error}</div>;
  if (!doc) return <div>Document not found.</div>;

  const extraction = doc.organized || doc.extraction;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h1 style={{ marginTop: 0, marginBottom: 8 }}>{doc.original_name}</h1>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={doc.status} />
              <span style={metaPill}>{doc.document_type}</span>
              <span style={metaPill}>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button disabled={actionLoading} style={buttonStyle} onClick={() => runAction(`/api/documents/${id}/extract`, 'Extraction completed')}>
              Extract
            </button>
            <button disabled={actionLoading || !doc.extraction} style={secondaryButtonStyle} onClick={() => runAction(`/api/documents/${id}/organize`, 'Organization completed')}>
              AI Organize
            </button>
            <button disabled={actionLoading || (!doc.extraction && !doc.organized)} style={successButtonStyle} onClick={() => runAction(`/api/documents/${id}/export`, 'Export completed')}>
              Export Excel
            </button>
          </div>
        </div>
        {message && <div style={successStyle}>{message}</div>}
        {error && <div style={{ ...errorStyle, marginTop: 12 }}>{error}</div>}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitle}>Header fields</h2>
        {extraction?.header_fields && Object.keys(extraction.header_fields).length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Field</th>
                  <th style={thStyle}>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(extraction.header_fields).map(([key, value]) => (
                  <tr key={key}>
                    <td style={tdStyle}>{key}</td>
                    <td style={tdStyle}>{String(value ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div style={mutedStyle}>No header fields yet. Run extraction first.</div>}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitle}>Detected tables</h2>
        {extraction?.tables?.length ? extraction.tables.map((table, idx) => (
          <div key={idx} style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
            <strong>{table.name}</strong>
            <TableView table={table} />
          </div>
        )) : <div style={mutedStyle}>No tables detected.</div>}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitle}>Raw text</h2>
        <div style={rawTextStyle}>{(extraction?.raw_text || doc.raw_text || '').trim() || 'No text extracted yet.'}</div>
      </section>
    </div>
  );
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
};
const buttonStyle = { background: '#0f172a', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' };
const secondaryButtonStyle = { background: '#e2e8f0', color: '#0f172a', border: 'none', padding: '12px 16px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' };
const successButtonStyle = { background: '#166534', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' };
const successStyle = { color: '#166534', background: '#f0fdf4', padding: 12, borderRadius: 10, border: '1px solid #bbf7d0', marginTop: 12 };
const errorStyle = { color: '#b91c1c', background: '#fef2f2', padding: 12, borderRadius: 10, border: '1px solid #fecaca' };
const mutedStyle = { color: '#64748b' };
const metaPill = { background: '#f1f5f9', padding: '6px 10px', borderRadius: 999, fontWeight: 600, color: '#334155', fontSize: 12 };
const sectionTitle = { marginTop: 0, marginBottom: 14 };
const thStyle = { textAlign: 'left', padding: 12, background: '#0f172a', color: '#fff' };
const tdStyle = { padding: 12, borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' };
const rawTextStyle = { whiteSpace: 'pre-wrap', lineHeight: 1.6, background: '#f8fafc', border: '1px solid #e2e8f0', padding: 16, borderRadius: 12, maxHeight: 500, overflow: 'auto' };
