import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import sessionHandler from './api/session';
import aiHandler from './api/ai';
import chatHandler from './api/chat';
import convertStoryHandler from './api/convert-story';
import legalSourceSearchHandler from './api/legal-source-search';
import adminAnalysisHandler from './api/admin-analysis';
import judgesReviewHandler from './api/judges-review';
import casesHandler from './api/cases';
import adminRunsHandler from './api/admin-runs';
import healthHandler from './api/health';
import adminUsersHandler from './api/admin-users';
import auditLogHandler from './api/audit-log';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Frame-Options', 'DENY');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ limit: '4mb', extended: true }));

  // Lightweight process liveness endpoint for self-hosted platforms such as
  // Railway. It deliberately does not depend on Gemini or Redis so a healthy
  // web process can become ready while /api/health continues to report the
  // full dependency state.
  app.get('/api/live', (_req, res) => {
    res.status(200).json({ ok: true, service: 'qada' });
  });

  app.get('/api/health', (req, res) => {
    void healthHandler(req as any, res as any);
  });

  app.get('/robots.txt', (req, res) => {
    const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url></urlset>`
    );
  });

  // Local development and self-hosted production use the exact same API handlers
  // as Vercel. This prevents legal rules, authentication, and AI behavior from
  // drifting between environments.
  app.all('/api/session', (req, res) => {
    void sessionHandler(req as any, res as any);
  });

  app.post('/api/ai', (req, res) => {
    void aiHandler(req as any, res as any);
  });

  app.post('/api/chat', (req, res) => {
    void chatHandler(req as any, res as any);
  });

  app.post('/api/convert-story', (req, res) => {
    void convertStoryHandler(req as any, res as any);
  });

  app.post('/api/legal-source-search', (req, res) => {
    void legalSourceSearchHandler(req as any, res as any);
  });

  app.post('/api/admin-analysis', (req, res) => {
    void adminAnalysisHandler(req as any, res as any);
  });

  app.post('/api/judges-review', (req, res) => {
    void judgesReviewHandler(req as any, res as any);
  });

  app.all('/api/cases', (req, res) => {
    void casesHandler(req as any, res as any);
  });

  app.all('/api/admin-runs', (req, res) => {
    void adminRunsHandler(req as any, res as any);
  });

  app.all('/api/admin-users', (req, res) => {
    void adminUsersHandler(req as any, res as any);
  });

  app.all('/api/audit-log', (req, res) => {
    void auditLogHandler(req as any, res as any);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QADA server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
