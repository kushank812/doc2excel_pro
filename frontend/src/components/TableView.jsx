export default function TableView({ table }) {
  if (!table) return null;

  const columns = table.normalized_columns || table.columns || [];
  const rows = table.rows || [];

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            {columns.map((col, index) => (
              <th key={index} style={{
                textAlign: 'left',
                padding: 12,
                background: '#0f172a',
                color: '#fff',
                borderBottom: '1px solid #334155'
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, colIndex) => (
                <td key={colIndex} style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>
                  {String(value ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
