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

const getProfitSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let dateFilter = '';

    if (from && to) {
      dateFilter = 'AND sor.requested_at BETWEEN $1 AND $2';
      params.push(from, to);
    }

    const result = await pool.query(`
      SELECT 
        cc.name AS category_name,
        COUNT(DISTINCT cb.id) AS total_batches,
        COUNT(sor.id) AS total_transactions,
        SUM(sor.quantity_containers) AS total_units_sold,
        SUM(sor.quantity_containers * cb.unit_buy_price) AS total_buy_cost,
        SUM(sor.total_sell_price) AS total_sell_revenue,
        SUM(sor.total_sell_price) - SUM(sor.quantity_containers * cb.unit_buy_price) AS net_profit,
        CASE 
          WHEN SUM(sor.total_sell_price) > 0 
          THEN ROUND(
            ((SUM(sor.total_sell_price) - SUM(sor.quantity_containers * cb.unit_buy_price)) 
            / SUM(sor.total_sell_price) * 100)::numeric, 2)
          ELSE 0 
        END AS profit_margin_percentage
      FROM chemical_categories cc
      LEFT JOIN chemical_batches cb ON cc.id = cb.category_id
        AND cb.unit_buy_price IS NOT NULL
      LEFT JOIN stock_out_requests sor ON cb.id = sor.batch_id
        AND sor.status = 'approved'
        ${dateFilter}
      GROUP BY cc.id, cc.name
      ORDER BY net_profit DESC NULLS LAST
    `, params);

    return successResponse(res, result.rows, 'Profit summary retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const getRevenueSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let dateFilter = '';

    if (from && to) {
      dateFilter = 'AND sor.requested_at BETWEEN $1 AND $2';
      params.push(from, to);
    }

    const summaryResult = await pool.query(`
      SELECT
        COUNT(sor.id) AS total_transactions,
        COALESCE(SUM(sor.total_sell_price), 0) AS total_revenue,
        COALESCE(SUM(sor.quantity_containers * cb.unit_buy_price), 0) AS total_cost,
        COALESCE(SUM(sor.total_sell_price) - SUM(sor.quantity_containers * cb.unit_buy_price), 0) AS net_profit,
        COUNT(DISTINCT cb.category_id) AS categories_sold,
        COUNT(DISTINCT sor.requested_by) AS active_marketers
      FROM stock_out_requests sor
      JOIN chemical_batches cb ON sor.batch_id = cb.id
      WHERE sor.status = 'approved'
        ${dateFilter}
    `, params);

    const topMarketerResult = await pool.query(`
      SELECT 
        u.full_name,
        COUNT(sor.id) AS total_sales,
        SUM(sor.total_sell_price) AS total_revenue
      FROM stock_out_requests sor
      JOIN users u ON sor.requested_by = u.id
      WHERE sor.status = 'approved'
        ${dateFilter}
      GROUP BY u.id, u.full_name
      ORDER BY total_revenue DESC
      LIMIT 1
    `, params);

    return successResponse(res, {
      summary: summaryResult.rows[0],
      topMarketer: topMarketerResult.rows[0] || null
    }, 'Revenue summary retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

module.exports = { getExpiringSoon, getProfitSummary, getRevenueSummary };
