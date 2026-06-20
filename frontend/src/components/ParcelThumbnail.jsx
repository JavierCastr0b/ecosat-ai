export default function ParcelThumbnail({ geometry, className = '' }) {
  if (!geometry?.coordinates) {
    return (
      <div className={`bg-zinc-800 flex items-center justify-center ${className}`}>
        <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
    )
  }

  const ring =
    geometry.type === 'Polygon' ? geometry.coordinates[0] :
    geometry.type === 'MultiPolygon' ? geometry.coordinates[0][0] : []

  if (!ring?.length) return null

  const lons = ring.map((c) => c[0])
  const lats = ring.map((c) => c[1])
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const rangeX = maxLon - minLon || 0.001
  const rangeY = maxLat - minLat || 0.001
  const pad = Math.max(rangeX, rangeY) * 0.35

  const bMinLon = minLon - pad
  const bMinLat = minLat - pad
  const bMaxLon = maxLon + pad
  const bMaxLat = maxLat + pad
  const bRangeX = bMaxLon - bMinLon
  const bRangeY = bMaxLat - bMinLat

  const esriUrl =
    `https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${bMinLon},${bMinLat},${bMaxLon},${bMaxLat}&bboxSR=4326&size=400,200&format=png&f=image`

  // Normalize polygon coords relative to padded bbox, Y-flipped (lat up → SVG y down)
  const pts = ring
    .map((c) => {
      const x = ((c[0] - bMinLon) / bRangeX) * 100
      const y = 100 - ((c[1] - bMinLat) / bRangeY) * 100
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Actual ESRI satellite imagery */}
      <img
        src={esriUrl}
        alt="Vista satelital"
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
      {/* Slight darkening so polygon line stands out */}
      <div className="absolute inset-0 bg-black/15" />
      {/* Polygon overlay — xMidYMid slice mirrors object-cover cropping */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <polygon points={pts} fill="rgba(74,222,128,0.18)" stroke="#4ade80" strokeWidth="1.2" strokeLinejoin="round" />
        {ring.slice(0, -1).map((c, i) => {
          const x = ((c[0] - bMinLon) / bRangeX) * 100
          const y = 100 - ((c[1] - bMinLat) / bRangeY) * 100
          return <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r="1.2" fill="#4ade80" />
        })}
      </svg>
    </div>
  )
}
