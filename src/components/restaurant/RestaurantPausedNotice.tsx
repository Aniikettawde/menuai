type RestaurantPausedNoticeProps = {
  message?: string | null
  reason?: string | null
}

export default function RestaurantPausedNotice({
  message,
  reason,
}: RestaurantPausedNoticeProps) {
  return (
    <div
      style={{
        margin: 16,
        padding: 18,
        borderRadius: 16,
        background:
          'rgba(245, 158, 11, 0.10)',
        border:
          '1px solid rgba(245, 158, 11, 0.25)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#f59e0b',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 6,
        }}
      >
        Temporarily unavailable
      </div>

      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'inherit',
          marginBottom: 5,
        }}
      >
        {reason || 'Closed today'}
      </div>

      <div
        style={{
          fontSize: 13,
          opacity: 0.7,
          lineHeight: 1.5,
        }}
      >
        {message ||
          'Please visit us again tomorrow.'}
      </div>
    </div>
  )
}