function getInitials(text) {
  if (!text) return '?'
  const parts = text.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function Avatar({ name, size = 34 }) {
  return (
    <div
      className="avatar-initials"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {getInitials(name)}
    </div>
  )
}
