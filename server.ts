import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PYTHON_API_PORT = Number(process.env.PYTHON_API_PORT || 5001);
const PYTHON_HOST = '127.0.0.1';

let pythonProc: ChildProcess | null = null;

function startPythonBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const backendEntry = path.resolve(__dirname, 'backend', 'app.py');
    pythonProc = spawn('python3', [backendEntry], {
      cwd: __dirname,
      env: {
        ...process.env,
        PYTHON_API_PORT: String(PYTHON_API_PORT),
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    pythonProc.stdout?.on('data', (chunk) => {
      process.stdout.write(`[python-api] ${chunk}`);
    });
    pythonProc.stderr?.on('data', (chunk) => {
      process.stderr.write(`[python-api] ${chunk}`);
    });
    pythonProc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.error(`[python-api] exited unexpectedly with code ${code}`);
      }
    });

    const startedAt = Date.now();
    const pollHealth = () => {
      const req = http.get(`http://${PYTHON_HOST}:${PYTHON_API_PORT}/api/health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt > 15000) {
        reject(new Error('Python Flask/SQLite backend failed to start within 15s'));
        return;
      }
      setTimeout(pollHealth, 150);
    };

    pollHealth();
  });
}

function proxyApiToPython(req: express.Request, res: express.Response): void {
  const options: http.RequestOptions = {
    hostname: PYTHON_HOST,
    port: PYTHON_API_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${PYTHON_HOST}:${PYTHON_API_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 500);
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value !== undefined) {
        res.setHeader(key, value);
      }
    }
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[proxy error]', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Python backend unavailable', details: err.message });
    }
  });

  req.pipe(proxyReq);
}

async function bootstrap() {
  await startPythonBackend();

  const app = express();

  // Proxy all /api/* routes directly to Python REST API + SQLite
  app.use('/api', proxyApiToPython);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lab Equipment Fault Reporter running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    server.close();
    if (pythonProc && !pythonProc.killed) {
      pythonProc.kill('SIGTERM');
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  if (pythonProc && !pythonProc.killed) {
    pythonProc.kill('SIGTERM');
  }
  process.exit(1);
});
