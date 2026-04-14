import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // WellTegra Harvester API Endpoints
  app.get('/api/harvester/status', (req, res) => {
    res.json({ status: 'ONLINE', version: '1.2.0', lastSync: new Date().toISOString() });
  });

  app.post('/api/harvester/run', (req, res) => {
    const { assetId } = req.body || { assetId: 'stella' };
    
    // Simulate the Python Harvester Logic
    const reported = assetId === 'stella' ? 10500 : 15200;
    const drift = assetId === 'stella' ? 0.865 : 0.985;
    
    const audit = {
      wellId: assetId === 'stella' ? 'ST-01' : 'GN-04',
      timestamp: new Date().toISOString(),
      reportedProduction: reported,
      forensicProduction: reported * drift,
      delta: `${Math.round((1 - drift) * 100)}%`,
      confidence: 0.94,
      source: 'NSTA ArcGIS',
      validator: 'WellTegra Physics v1.2'
    };

    setTimeout(() => {
      res.json({ success: true, audit });
    }, 1500); // Simulate processing time
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WellTegra Forensic Server running on http://localhost:${PORT}`);
  });
}

startServer();
