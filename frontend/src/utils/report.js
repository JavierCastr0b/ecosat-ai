function metricRows(metrics = {}) {
  return ['NDVI', 'NDMI', 'NDRE', 'SAVI'].map((key) => `
    <tr>
      <td>${key}</td>
      <td>${metrics[key] == null ? '-' : Number(metrics[key]).toFixed(3)}</td>
    </tr>
  `).join('')
}

function metricValue(value, digits = 3) {
  return value == null ? '-' : Number(value).toFixed(digits)
}

function listItems(items = []) {
  if (!items.length) return '<li>Sin datos registrados.</li>'
  return items.map((item) => `<li>${item}</li>`).join('')
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = parseDate(value)
  if (!date) return value ?? '-'
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date).replace('.', '')
}

function formatPeriod(report) {
  return `${formatDate(report?.date_start)} - ${formatDate(report?.date_end)}`
}

function sortedAnalyses(analyses = []) {
  return [...analyses].sort((a, b) => (
    (a.date_end ?? a.created_at ?? '').localeCompare(b.date_end ?? b.created_at ?? '')
  ))
}

function trendRows(trend = {}) {
  const entries = Object.entries(trend)
  if (!entries.length) {
    return '<tr><td colspan="4">Sin comparación disponible.</td></tr>'
  }
  return entries.map(([key, value]) => `
    <tr>
      <td>${key}</td>
      <td>${value.direction ?? '-'}</td>
      <td>${value.delta == null ? '-' : `${value.delta > 0 ? '+' : ''}${Number(value.delta).toFixed(3)}`}</td>
      <td>${value.percent == null ? '-' : `${value.percent > 0 ? '+' : ''}${Number(value.percent).toFixed(1)}%`}</td>
    </tr>
  `).join('')
}

function seriesRows(analyses = []) {
  const rows = sortedAnalyses(analyses)
  if (!rows.length) return '<tr><td colspan="6">Sin serie temporal registrada.</td></tr>'
  return rows.map((item) => `
    <tr>
      <td>${formatPeriod(item)}</td>
      <td>${metricValue(item.metrics?.NDVI)}</td>
      <td>${metricValue(item.metrics?.NDMI)}</td>
      <td>${metricValue(item.metrics?.NDRE)}</td>
      <td>${metricValue(item.metrics?.SAVI)}</td>
      <td>${item.estado_cultivo ?? '-'}</td>
    </tr>
  `).join('')
}

function epochChangeRows(analyses = []) {
  const rows = sortedAnalyses(analyses)
  if (rows.length < 2) return '<tr><td colspan="6">Se necesitan al menos dos análisis para comparar épocas.</td></tr>'

  const metrics = ['NDVI', 'NDMI', 'NDRE', 'SAVI']
  const changes = []
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1]
    const current = rows[i]
    metrics.forEach((metric) => {
      const oldValue = prev.metrics?.[metric]
      const newValue = current.metrics?.[metric]
      if (oldValue == null || newValue == null) return
      const delta = newValue - oldValue
      changes.push(`
        <tr>
          <td>${formatDate(prev.date_end)} -> ${formatDate(current.date_end)}</td>
          <td>${metric}</td>
          <td>${metricValue(oldValue)}</td>
          <td>${metricValue(newValue)}</td>
          <td>${delta > 0 ? '+' : ''}${delta.toFixed(3)}</td>
          <td>${delta > 0 ? 'Subió' : delta < 0 ? 'Bajó' : 'Estable'}</td>
        </tr>
      `)
    })
  }
  return changes.join('') || '<tr><td colspan="6">Sin cambios calculables.</td></tr>'
}

function imageSection(report) {
  const assets = report?.visual_assets || {}
  const context = assets.context_rgb_thumbnail_url
  const rgb = assets.rgb_thumbnail_url
  const ndvi = assets.ndvi_thumbnail_url
  if (!context && !rgb && !ndvi) {
    return `
      <h2>Capturas satelitales</h2>
      <p class="muted">Este reporte no tiene capturas guardadas. Genera un nuevo análisis para incluir RGB y NDVI visual.</p>
    `
  }
  return `
    <h2>Capturas satelitales</h2>
    ${context ? `
      <div class="image-card context">
        <div class="image-label">Contexto Sentinel-2 del periodo</div>
        <img src="${context}" alt="Contexto Sentinel-2" />
      </div>
    ` : ''}
    <div class="images">
      <div class="image-card">
        <div class="image-label">RGB satelital</div>
        ${rgb ? `<img src="${rgb}" alt="RGB satelital" />` : '<div class="empty">RGB no disponible</div>'}
      </div>
      <div class="image-card">
        <div class="image-label">NDVI vigor</div>
        ${ndvi ? `<img src="${ndvi}" alt="NDVI vigor" />` : '<div class="empty">NDVI no disponible</div>'}
        <div class="legend"><span>Bajo vigor</span><b></b><span>Buen vigor</span></div>
      </div>
    </div>
  `
}

export function openReportPdf({ parcel, collection, report, analyses = [] }) {
  const title = `Reporte EcoSat AI - ${parcel?.name ?? 'Lote'}`
  const previous = analyses.find((item) => item.analysis_id !== report?.analysis_id)
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { margin: 18mm; }
          body { font-family: Arial, sans-serif; color: #1f271c; line-height: 1.45; }
          header { border-bottom: 3px solid #9EE832; padding-bottom: 14px; margin-bottom: 22px; }
          h1 { margin: 0; font-size: 26px; }
          h2 { margin: 24px 0 8px; font-size: 16px; color: #3D6B0C; }
          .muted { color: #6B6259; font-size: 12px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 16px 0; }
          .card { border: 1px solid #D9D5CC; border-radius: 10px; padding: 12px; }
          .label { font-size: 10px; color: #6B6259; text-transform: uppercase; letter-spacing: .08em; }
          .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border-bottom: 1px solid #E4DFD4; padding: 8px; text-align: left; }
          th { font-size: 11px; color: #6B6259; text-transform: uppercase; }
          ul { margin-top: 8px; padding-left: 18px; }
          li { margin-bottom: 6px; }
          .summary { background: #F7FAEF; border-left: 4px solid #9EE832; padding: 12px; }
          .images { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
          .image-card { border: 1px solid #D9D5CC; border-radius: 10px; overflow: hidden; background: #F7F3EA; }
          .image-card.context { margin-top: 10px; margin-bottom: 12px; }
          .image-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; padding: 8px 10px; background: #1f271c; color: white; }
          .image-card img { display: block; width: 100%; height: 210px; object-fit: cover; }
          .image-card.context img { height: 260px; }
          .empty { height: 210px; display: flex; align-items: center; justify-content: center; color: #6B6259; font-size: 12px; }
          .legend { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; padding: 8px 10px; font-size: 10px; color: #6B6259; }
          .legend b { display: block; height: 7px; border-radius: 999px; background: linear-gradient(90deg, #8C2415, #F6C343, #1F7A1F); }
          .page-break { break-before: page; }
          .footer { margin-top: 28px; font-size: 11px; color: #6B6259; border-top: 1px solid #E4DFD4; padding-top: 10px; }
        </style>
      </head>
      <body>
        <header>
          <h1>EcoSat AI · Reporte de lote</h1>
          <p class="muted">Generado el ${new Date().toLocaleString('es-PE')}</p>
        </header>

        <section class="grid">
          <div class="card"><div class="label">Finca</div><div class="value">${collection?.name ?? '-'}</div></div>
          <div class="card"><div class="label">Lote</div><div class="value">${parcel?.name ?? '-'}</div></div>
          <div class="card"><div class="label">Cultivo</div><div class="value">${parcel?.crop_type ?? '-'}</div></div>
        </section>

        <section class="grid">
          <div class="card"><div class="label">Estado</div><div class="value">${report?.estado_cultivo ?? '-'}</div></div>
          <div class="card"><div class="label">Humedad</div><div class="value">${report?.humedad ?? '-'}</div></div>
          <div class="card"><div class="label">Prioridad</div><div class="value">${report?.prioridad ?? '-'}</div></div>
        </section>

        <h2>Periodo analizado</h2>
        <p>${formatPeriod(report)}</p>

        ${imageSection(report)}

        <h2>Resumen IA</h2>
        <p class="summary">${report?.resumen ?? 'Sin resumen disponible.'}</p>

        <h2>Índices espectrales</h2>
        <table>
          <thead><tr><th>Índice</th><th>Promedio</th></tr></thead>
          <tbody>${metricRows(report?.metrics)}</tbody>
        </table>

        <h2>Cambios frente al análisis anterior</h2>
        <table>
          <thead><tr><th>Índice</th><th>Dirección</th><th>Delta</th><th>%</th></tr></thead>
          <tbody>${trendRows(report?.trend)}</tbody>
        </table>

        <h2>Recomendaciones</h2>
        <ul>${listItems(report?.recomendaciones)}</ul>

        <h2>Acciones inmediatas</h2>
        <ul>${listItems(report?.acciones_inmediatas)}</ul>

        <h2>Plan de temporada</h2>
        <ul>${listItems(report?.plan_temporada)}</ul>

        <div class="page-break"></div>

        <h2>Serie temporal del lote</h2>
        <table>
          <thead><tr><th>Periodo</th><th>NDVI</th><th>NDMI</th><th>NDRE</th><th>SAVI</th><th>Estado</th></tr></thead>
          <tbody>${seriesRows(analyses)}</tbody>
        </table>

        <h2>Cambios entre épocas</h2>
        <table>
          <thead><tr><th>Época</th><th>Índice</th><th>Anterior</th><th>Actual</th><th>Cambio</th><th>Lectura</th></tr></thead>
          <tbody>${epochChangeRows(analyses)}</tbody>
        </table>

        ${previous ? `
          <p class="muted">La comparación usa los reportes históricos guardados para el mismo lote. Valida decisiones críticas con inspección de campo.</p>
        ` : ''}

        <p class="footer">${report?.limitaciones ?? 'Los resultados deben validarse con observación de campo.'}</p>
        <script>
          window.onload = () => { window.print() }
        </script>
      </body>
    </html>
  `
  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}
