export default function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{title}</h1>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13.5 }}>
        Este modulo se construye en la siguiente fase.
      </p>
    </div>
  )
}
