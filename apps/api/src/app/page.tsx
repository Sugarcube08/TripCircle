export default function HomePage() {
  return (
    <main style={{ maxWidth: 700, margin: '0 auto', lineHeight: 1.6 }}>
      <h1 style={{ color: '#0F172A' }}>tripCircle API Server</h1>
      <p style={{ color: '#475569' }}>
        The backend API for tripCircle is running. Collaborative trip expense tracking,
        transparent financial records, and simplified group settlement.
      </p>
      <ul>
        <li><a href="/api/v1/health">/api/v1/health</a> — Service health check</li>
        <li><a href="/api/v1/docs">/api/v1/docs</a> — OpenAPI Specification</li>
      </ul>
    </main>
  );
}
