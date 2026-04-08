export default function StatusBadge({ status }) {
  const normalized = String(status || '').toUpperCase();
  const styles = {
    UPLOADED: { background: '#e0f2fe', color: '#075985' },
    EXTRACTED: { background: '#dcfce7', color: '#166534' },
    ORGANIZED: { background: '#ede9fe', color: '#6d28d9' },
    EXPORTED: { background: '#fef3c7', color: '#92400e' },
    FAILED: { background: '#fee2e2', color: '#b91c1c' },
  };
  const style = styles[normalized] || { background: '#e5e7eb', color: '#374151' };

  return (
    <span style={{
      display: 'inline-block',
      padding: '6px 10px',
      borderRadius: 999,
      fontWeight: 700,
      fontSize: 12,
      ...style,
    }}>
      {normalized || 'UNKNOWN'}
    </span>
  );
}
