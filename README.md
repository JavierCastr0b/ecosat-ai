# EcoSat AI

Análisis ambiental serverless con imágenes satelitales (Sentinel-2) e interpretación por LLM.
Arquitectura 100% serverless, basada en eventos y asíncrona (AWS Lambda + SQS + DynamoDB + S3).

## Estructura
- `backend/`  — Serverless Framework (Python): Lambdas, colas SQS, DynamoDB, S3
- `frontend/` — React + Leaflet

## Backend
    cd backend
    export GROQ_API_KEY="tu_key"
    sls deploy

## Frontend
    cd frontend
    npm run dev
