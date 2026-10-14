const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initDb } = require('./database');

// Route modules
const roomsRouter         = require('./routes/rooms');
const publicSpacesRouter  = require('./routes/publicSpaces');
const bookingsRouter      = require('./routes/bookings');
const profilesRouter      = require('./routes/profiles');
const announcementsRouter = require('./routes/announcements');
const issuesRouter        = require('./routes/issues');
const myIssuesRouter      = require('./routes/myIssues');
const adminRouter         = require('./routes/admin');
const tuyaRouter          = require('./routes/tuya');
const usersRouter         = require('./routes/users');
const intakeRouter        = require('./routes/intake');

const app = express();

// ── Core Middleware ──────────────────────────────────────────────
app.use(helmet());

// CORS: restrict to known origins when ALLOWED_ORIGINS is set
// (comma-separated), otherwise stay permissive for local/dev use.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
if (allowedOrigins.length > 0) {
  app.use(cors({
    origin(origin, cb) {
      // allow same-origin / curl / server-to-server (no Origin header)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  }));
} else {
  app.use(cors());
}
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// ── Route Mounting ───────────────────────────────────────────────
app.use('/api/rooms',         roomsRouter);
app.use('/api/public-spaces', publicSpacesRouter);
app.use('/api/bookings',      bookingsRouter);
app.use('/api/profile',       profilesRouter);
app.use('/api/profiles',      profilesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/issues',        issuesRouter);
app.use('/api/my-issues',     myIssuesRouter);
app.use('/api/admin',         adminRouter);
app.use('/api/tuya',          tuyaRouter);
app.use('/api/users',         usersRouter);
app.use('/api/intake',        intakeRouter);

// ── Server Bootstrap ─────────────────────────────────────────────
module.exports = app;

// 只有直接執行（npm start / node index.js）才啟動 server；
// Vercel 函式（api/index.js、apps/console/api/index.js）與測試只引用 app。
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  initDb().then(() => {
    app.listen(PORT, () => console.log(`🚀 Space Booking Backend running on port ${PORT}`));
  }).catch(console.error);
}