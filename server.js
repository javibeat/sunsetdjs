const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

// Añadir más logs
app.use((req, res, next) => {
  console.log(`📍 ${req.method} request to ${req.url}`);
  next();
});

// Cache simple en memoria
let cache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 60 * 60 * 1000 // 1 hora
};

// Headers de seguridad básicos
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Añadir manejo de errores para archivos estáticos
app.use((err, req, res, next) => {
  if (err) {
    console.error('Static file error:', err);
    res.status(500).send('Error serving static files');
  }
  next();
});

const PORT = 5001;

// Eliminar este CORS duplicado
// app.use(cors());

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: process.env.GOOGLE_TYPE,
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ÚNICO endpoint para manejar todas las peticiones
app.get('/schedule/:venue?', async (req, res) => {
  try {
    // Modificar cómo se maneja el parámetro venue
    let venue = 'DJs Schedule';
    if (req.params.venue) {
      // Convertir drift.html a DRIFT, etc.
      venue = req.params.venue.replace('.html', '').toUpperCase();
    }
    
    // Usar cache específico para cada venue
    const cacheKey = venue;
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < cache.CACHE_DURATION) {
      return res.json(cache[cacheKey]);
    }

    const spreadsheetId = process.env.SHEET_ID;
    const range = `${venue}!A1:I50`;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    if (!response.data.values) {
      return res.status(404).json({ error: `No data found in ${venue} sheet` });
    }

    // Actualizar cache específico para este venue
    cache[cacheKey] = {
      data: response.data.values,
      timestamp: Date.now()
    };

    res.json({ data: response.data.values });
  } catch (error) {
    console.error(`Error accessing sheet:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
  console.log(`🔄 CORS enabled`);
});