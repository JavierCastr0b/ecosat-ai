CROP_KNOWLEDGE = {
    "maiz": [
        "En maiz, caidas de NDMI durante crecimiento vegetativo suelen justificar revisar riego antes de que caiga el vigor.",
        "NDRE medio o bajo puede sugerir revisar nitrogeno, especialmente antes de etapas de alta demanda nutricional.",
        "Variabilidad alta dentro del lote puede indicar diferencias de suelo, riego o emergencia del cultivo.",
    ],
    "cacao": [
        "En cacao, el estres hidrico sostenido afecta brotacion, floracion y llenado de frutos.",
        "NDRE bajo debe cruzarse con observacion de hojas y manejo de sombra antes de fertilizar.",
        "La variabilidad por sectores puede estar asociada a sombra, drenaje o diferencias de suelo.",
    ],
    "cafe": [
        "En cafe, humedad baja y vigor bajo pueden anticipar estres en floracion o llenado.",
        "NDRE bajo debe revisarse junto con fertilizacion, sombra y analisis foliar.",
        "Los cambios deben leerse por tendencia porque la respuesta del cultivo puede ser gradual.",
    ],
    "arroz": [
        "En arroz, NDMI bajo puede indicar problemas de disponibilidad de agua o manejo de lamina.",
        "NDVI bajo con NDMI aceptable puede orientar a revisar nutricion, plagas o establecimiento.",
        "La uniformidad por sectores es importante para manejo de agua y fertilizacion.",
    ],
}


def knowledge_for_crop(crop_type):
    return CROP_KNOWLEDGE.get((crop_type or "").lower(), [
        "Cruza los indices con observacion de campo antes de aplicar riego o fertilizacion.",
        "Prioriza manejo por sectores cuando minimos y maximos muestran alta variabilidad.",
        "Usa el historial temporal para distinguir una alerta puntual de una tendencia real.",
    ])
