const removePricingFields = (data) => {
  if (Array.isArray(data)) {
    return data.map(item => removePricingFields(item));
  } else if (data !== null && typeof data === 'object') {
    delete data.unit_buy_price;
    delete data.sell_price_per_unit;

    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        data[key] = removePricingFields(data[key]);
      }
    }
    return data;
  }
  return data;
};

const pricingGuard = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (body) {
    if (req.user && req.user.role === 'storekeeper') {
      body = removePricingFields(body);
    }
    return originalJson.call(res, body);
  };

  next();
};

module.exports = pricingGuard;
