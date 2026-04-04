export default function SiteFooter() {
  return (
    <footer style={{ padding: '30px 18px' }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          borderRadius: 22,
          padding: 20,
          background: 'rgba(8,26,49,0.88)',
        }}
      >
        © {new Date().getFullYear()} TenAceIQ
      </div>
    </footer>
  )
}