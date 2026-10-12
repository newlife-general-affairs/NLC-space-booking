const { supabase } = require('./database');

const getUserFromToken = async (token) => {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      if (error) console.error('[auth.getUser error]', error.message);
      return null;
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role, branch')
      .eq('id', data.user.id)
      .maybeSingle();

    if (roleError) {
      console.error('[user_roles lookup error]', roleError.message);
      throw roleError;
    }

    return {
      id: data.user.id,
      email: data.user.email,
      role: roleData ? roleData.role : 'user',
      branch: roleData ? roleData.branch : null
    };
  } catch (err) {
    console.error('[getUserFromToken error]', err);
    return null;
  }
};

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await getUserFromToken(token);

  if (!user) {
    return res.status(401).json({
      error: 'Unable to verify account. Check the backend Supabase service-role configuration.'
    });
  }

  req.user = user;
  next();
};

const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await getUserFromToken(token);

  if (user) {
    req.user = user;
  }

  next();
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: Insufficient privileges' });
    }
    next();
  };
};

module.exports = { authMiddleware, optionalAuthMiddleware, requireRole };
