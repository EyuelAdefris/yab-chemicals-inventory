const pool = require('../db/pool');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { sendToUser } = require('../sockets/index.js');

const createStockOutRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    const { batch_id, customer_name, quantity_containers, sell_price_per_unit } = req.body;

    if (!batch_id || !customer_name || quantity_containers === undefined || sell_price_per_unit === undefined) {
      return errorResponse(res, 'All fields are required', 400);
    }

    if (Number(quantity_containers) <= 0) {
      return errorResponse(res, 'Quantity must be greater than 0', 400);
    }

    if (Number(sell_price_per_unit) < 0) {
      return errorResponse(res, 'Sell price cannot be negative', 400);
    }

    const checkBatch = await client.query("SELECT status FROM chemical_batches WHERE id = $1", [batch_id]);
    if (checkBatch.rows.length === 0) {
      return errorResponse(res, 'Batch not found in inventory', 404);
    }
    if (checkBatch.rows[0].status !== 'active') {
      return errorResponse(res, 'Batch is not available for sale', 400);
    }

    const checkStock = await client.query("SELECT containers_available, containers_reserved FROM inventory_stock WHERE batch_id = $1", [batch_id]);
    if (checkStock.rows.length === 0) {
      return errorResponse(res, 'Batch not found in inventory', 404);
    }

    const stock = checkStock.rows[0];
    if (stock.containers_available < quantity_containers) {
      return errorResponse(res, `Insufficient stock. Available: ${stock.containers_available} containers`, 400);
    }

    await client.query('BEGIN');

    const total_sell_price = quantity_containers * sell_price_per_unit;

    const newRequest = await client.query(
      `INSERT INTO stock_out_requests 
       (batch_id, requested_by, customer_name, quantity_containers, sell_price_per_unit, total_sell_price, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [batch_id, req.user.userId, customer_name, quantity_containers, sell_price_per_unit, total_sell_price, 'pending']
    );

    await client.query(
      `UPDATE inventory_stock 
       SET containers_available = containers_available - $1, 
           containers_reserved = containers_reserved + $1, 
           last_updated = NOW() 
       WHERE batch_id = $2`,
      [quantity_containers, batch_id]
    );

    await client.query('COMMIT');

    return successResponse(res, newRequest.rows[0], 'Stock-out request submitted successfully. Awaiting storekeeper approval.', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  } finally {
    client.release();
  }
};

const approveStockOut = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const requestRes = await client.query('SELECT * FROM stock_out_requests WHERE id = $1 FOR UPDATE', [id]);
    if (requestRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return errorResponse(res, 'Request not found', 404);
    }

    const request = requestRes.rows[0];
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return errorResponse(res, 'Request is no longer pending', 400);
    }

    const { batch_id, quantity_containers, customer_name } = request;

    await client.query(
      `SELECT cb.id, is_table.containers_reserved, is_table.containers_available 
       FROM chemical_batches cb 
       JOIN inventory_stock is_table ON cb.id = is_table.batch_id 
       WHERE cb.id = $1 AND cb.status = 'active' 
       ORDER BY cb.expiration_date ASC 
       LIMIT 1`,
      [batch_id]
    );

    await client.query(
      `UPDATE inventory_stock 
       SET containers_reserved = containers_reserved - $1, 
           last_updated = NOW() 
       WHERE batch_id = $2`,
      [quantity_containers, batch_id]
    );

    const checkStock = await client.query('SELECT containers_available FROM inventory_stock WHERE batch_id = $1', [batch_id]);
    if (checkStock.rows[0].containers_available === 0) {
      await client.query("UPDATE chemical_batches SET status = 'depleted' WHERE id = $1", [batch_id]);
    }

    const updatedRequest = await client.query(
      `UPDATE stock_out_requests 
       SET status = 'approved', approved_by = $1, approved_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [req.user.userId, id]
    );

    await client.query('COMMIT');

    sendToUser(req.user.userId, {
      type: 'stock_out_approved',
      requestId: updatedRequest.rows[0].id,
      customerName: customer_name,
      quantityDeducted: quantity_containers,
      timestamp: new Date().toISOString()
    });

    return successResponse(res, updatedRequest.rows[0], 'Stock-out approved. FIFO deduction completed.', 200);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  } finally {
    client.release();
  }
};

const rejectStockOut = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const requestRes = await client.query('SELECT * FROM stock_out_requests WHERE id = $1', [id]);
    if (requestRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return errorResponse(res, 'Request not found', 404);
    }

    const request = requestRes.rows[0];
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return errorResponse(res, 'Request is no longer pending', 400);
    }

    await client.query(
      `UPDATE stock_out_requests 
       SET status = 'rejected', approved_by = $1, approved_at = NOW() 
       WHERE id = $2`,
      [req.user.userId, id]
    );

    await client.query(
      `UPDATE inventory_stock 
       SET containers_available = containers_available + $1, 
           containers_reserved = containers_reserved - $1, 
           last_updated = NOW() 
       WHERE batch_id = $2`,
      [request.quantity_containers, request.batch_id]
    );

    await client.query('COMMIT');

    return successResponse(res, null, 'Stock-out rejected. Reserved stock released.', 200);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  } finally {
    client.release();
  }
};

const getStockOutRequests = async (req, res) => {
  try {
    const { role, userId } = req.user;

    let filterClause = '';
    const queryParams = [];

    if (role === 'marketer') {
      filterClause = 'WHERE sor.requested_by = $1';
      queryParams.push(userId);
    } else if (role === 'storekeeper') {
      filterClause = "WHERE sor.status = 'pending'";
    }

    const query = `
      SELECT 
        sor.id, sor.customer_name, sor.quantity_containers, 
        sor.sell_price_per_unit, sor.total_sell_price, 
        sor.status, sor.requested_at, sor.approved_at,
        requester.full_name AS requested_by_name,
        approver.full_name AS approved_by_name,
        cb.batch_number,
        cc.name AS category_name
      FROM stock_out_requests sor
      JOIN users requester ON sor.requested_by = requester.id
      LEFT JOIN users approver ON sor.approved_by = approver.id
      JOIN chemical_batches cb ON sor.batch_id = cb.id
      JOIN chemical_categories cc ON cb.category_id = cc.id
      ${filterClause}
      ORDER BY sor.requested_at DESC
    `;

    const result = await pool.query(query, queryParams);
    return successResponse(res, result.rows, 'Requests retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

module.exports = {
  createStockOutRequest,
  approveStockOut,
  rejectStockOut,
  getStockOutRequests
};
