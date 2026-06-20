function metricRows(metrics = {}) {
  return ['NDVI', 'NDMI', 'NDRE', 'SAVI'].map((key) => `
    <tr>
      <td>${key}</td>
      <td>${metrics[key] == null ? '-' : Number(metrics[key]).toFixed(3)}</td>
    </tr>
  `).join('')
}

function listItems(items = []) {
  if (!items.length) return '<li>Sin datos registrados.</li>'
  return items.map((item) => `<li>${item}</li>`).join('')
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
        <p>${report?.date_start ?? '-'} a ${report?.date_end ?? '-'}</p>

        <h2>Resumen IA</h2>
        <p class="summary">${report?.resumen ?? 'Sin resumen disponible.'}</p>

        <h2>Índices espectrales</h2>
        <table>
          <thead><tr><th>Índice</th><th>Promedio</th></tr></thead>
          <tbody>${metricRows(report?.metrics)}</tbody>
        </table>

        <h2>Recomendaciones</h2>
        <ul>${listItems(report?.recomendaciones)}</ul>

        <h2>Acciones inmediatas</h2>
        <ul>${listItems(report?.acciones_inmediatas)}</ul>

        <h2>Plan de temporada</h2>
        <ul>${listItems(report?.plan_temporada)}</ul>

        ${previous ? `
          <h2>Comparación disponible</h2>
          <p class="muted">Este lote tiene reportes anteriores guardados. Usa el historial de EcoSat AI para comparar tendencias entre fechas.</p>
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
