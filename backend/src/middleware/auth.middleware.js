const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/responseHelper');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Access denied. No token provided.', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token has expired. Please login again.', 401);
    }
    return errorResponse(res, 'Invalid token.', 401);
  }
};

module.exports = authMiddleware;
