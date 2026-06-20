const EARTH_RADIUS_M = 6378137

const toRadians = (degrees) => (degrees * Math.PI) / 180

function ringArea(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return 0

  let total = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lon1, lat1] = ring[i]
    const [lon2, lat2] = ring[i + 1]
    total += toRadians(lon2 - lon1) * (
      2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2))
    )
  }

  return (total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2
}

export function polygonAreaM2(geometry) {
  if (!geometry?.coordinates) return null

  if (geometry.type === 'Polygon') {
    const [outer, ...holes] = geometry.coordinates
    const holesArea = holes.reduce((sum, ring) => sum + Math.abs(ringArea(ring)), 0)
    return Math.max(Math.abs(ringArea(outer)) - holesArea, 0)
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.reduce((sum, polygon) => (
      sum + polygonAreaM2({ type: 'Polygon', coordinates: polygon })
    ), 0)
  }

  return null
}

export function areaStats(geometry) {
  const area_m2 = polygonAreaM2(geometry)
  if (area_m2 == null) return null

  return {
    area_m2,
    area_ha: area_m2 / 10000,
  }
}

export function formatArea(areaHa, areaM2) {
  const hectares = Number(areaHa ?? (areaM2 != null ? areaM2 / 10000 : NaN))
  const meters = Number(areaM2 ?? (Number.isFinite(hectares) ? hectares * 10000 : NaN))

  if (!Number.isFinite(meters)) return 'Área no disponible'
  return `${Math.round(meters).toLocaleString('es-PE')} m²`
}

export function parcelArea(parcel) {
  if (parcel?.area_ha != null || parcel?.area_m2 != null) {
    return {
      area_ha: parcel.area_ha,
      area_m2: parcel.area_m2,
    }
  }
  return areaStats(parcel?.geometry)
}
