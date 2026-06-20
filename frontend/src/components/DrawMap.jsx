import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
})

function DrawControl({ onGeometryChange }) {
  const map = useMap()
  const callbackRef = useRef(onGeometryChange)
  callbackRef.current = onGeometryChange

  useEffect(() => {
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new L.Control.Draw({
      position: 'topright',
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: { color: '#16a34a', fillOpacity: 0.25, weight: 2 },
          drawError: { color: '#ef4444', message: 'No se permiten líneas que se crucen' },
        },
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      },
    })
    map.addControl(drawControl)

    const handleCreated = (e) => {
      drawnItems.clearLayers()
      drawnItems.addLayer(e.layer)
      callbackRef.current(e.layer.toGeoJSON().geometry)
    }
    const handleEdited = (e) => {
      e.layers.eachLayer((layer) => {
        callbackRef.current(layer.toGeoJSON().geometry)
      })
    }
    const handleDeleted = () => callbackRef.current(null)

    map.on(L.Draw.Event.CREATED, handleCreated)
    map.on(L.Draw.Event.EDITED, handleEdited)
    map.on(L.Draw.Event.DELETED, handleDeleted)

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated)
      map.off(L.Draw.Event.EDITED, handleEdited)
      map.off(L.Draw.Event.DELETED, handleDeleted)
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
    }
  }, [map])

  return null
}

export default function DrawMap({ onGeometryChange }) {
  return (
    <div>
      <div className="mb-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
        <strong>Cómo dibujar:</strong> haz clic en el ícono de polígono (barra derecha) → clic para agregar cada vértice → <strong>doble clic en el último punto</strong> para cerrar el lote.
      </div>
      <MapContainer
        center={[-9, -75]}
        zoom={6}
        style={{ height: '420px', width: '100%', borderRadius: '0.5rem' }}
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
        <DrawControl onGeometryChange={onGeometryChange} />
      </MapContainer>
    </div>
  )
}
