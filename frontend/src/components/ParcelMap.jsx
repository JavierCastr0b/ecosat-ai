import { useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function FitBounds({ geometry }) {
  const map = useMap()
  useEffect(() => {
    if (!geometry) return
    try {
      const layer = L.geoJSON(geometry)
      map.fitBounds(layer.getBounds(), { padding: [20, 20] })
    } catch (_) {}
  }, [map, geometry])
  return null
}

export default function ParcelMap({ geometry, height = '260px' }) {
  return (
    <MapContainer
      center={[4, -74]}
      zoom={6}
      style={{ height, width: '100%', borderRadius: '0.5rem' }}
    >
      {/* Satellite base */}
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP and the GIS User Community'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      {/* Labels overlay */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
      />
      {geometry && (
        <>
          <GeoJSON
            key={JSON.stringify(geometry)}
            data={geometry}
            style={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.25, weight: 2 }}
          />
          <FitBounds geometry={geometry} />
        </>
      )}
    </MapContainer>
  )
}
