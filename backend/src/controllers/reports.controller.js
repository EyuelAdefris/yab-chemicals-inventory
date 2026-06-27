const pool = require('../db/pool');
const { successResponse, errorResponse } = require('../utils/responseHelper');

const getExpiringSoon = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cb.id,
        cb.batch_number,
        cb.expiration_date,
        cb.total_containers,
        cc.name AS category_name,
        is_table.containers_available,
        (cb.expiration_date - CURRENT_DATE) AS days_remaining
      FROM chemical_batches cb
      JOIN chemical_categories cc ON cb.category_id = cc.id
      JOIN inventory_stock is_table ON cb.id = is_table.batch_id
      WHERE cb.status = 'active'
        AND cb.expiration_date <= CURRENT_DATE + INTERVAL '2 months'
      ORDER BY cb.expiration_date ASC
    `);

    return successResponse(res, result.rows, 'Expiring batches retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

module.exports = { getExpiringSoon };
