import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const COLORS = { NDVI: '#16a34a', NDMI: '#2563eb', NDRE: '#d97706', SAVI: '#7c3aed' }

export default function IndexChart({ series }) {
  if (!series || Object.keys(series).length === 0) return (
    <div className="flex h-48 items-center justify-center text-gray-400 text-sm">Sin datos de series temporales</div>
  )

  const allDates = [...new Set(
    Object.values(series).flatMap((pts) => pts.map((p) => p.date))
  )].sort()

  const data = allDates.map((date) => {
    const point = { date }
    Object.entries(series).forEach(([idx, pts]) => {
      const found = pts.find((p) => p.date === date)
      if (found) point[idx] = parseFloat(found.value.toFixed(3))
    })
    return point
  })

  const indices = Object.keys(series)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => v.toFixed(3)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {indices.map((idx) => (
          <Line
            key={idx}
            type="monotone"
            dataKey={idx}
            stroke={COLORS[idx] ?? '#6b7280'}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
