const { errorResponse } = require('../utils/responseHelper');

const roleGuard = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized.', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, 'Forbidden. You do not have permission to access this resource.', 403);
    }

    next();
  };
};

module.exports = roleGuard;
