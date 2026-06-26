const successResponse = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message: message,
    data: data,
    timestamp: new Date().toISOString()
  });
};

const errorResponse = (res, message = "An error occurred", statusCode = 400, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message: message,
    errors: errors,
    timestamp: new Date().toISOString()
  });
};

module.exports = { successResponse, errorResponse };
