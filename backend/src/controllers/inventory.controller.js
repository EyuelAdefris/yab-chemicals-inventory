const pool = require('../db/pool');
const { successResponse, errorResponse } = require('../utils/responseHelper');

const createBatch = async (req, res) => {
  const client = await pool.connect();
  try {
    const { category_id, batch_number, manufacturer_date, expiration_date, total_containers, unit_weight_kg } = req.body;
    
    if (!category_id || !batch_number || !manufacturer_date || !expiration_date || total_containers === undefined || unit_weight_kg === undefined) {
      return errorResponse(res, 'All fields are required', 400);
    }
    
    if (!Number.isInteger(Number(total_containers)) || Number(total_containers) <= 0) {
      return errorResponse(res, 'total_containers must be a positive number', 400);
    }
    
    if (Number(unit_weight_kg) <= 0) {
      return errorResponse(res, 'unit_weight_kg must be a positive number', 400);
    }
    
    if (new Date(expiration_date) <= new Date()) {
      return errorResponse(res, 'Expiration date must be in the future', 400);
    }
    
    const checkBatch = await client.query('SELECT id FROM chemical_batches WHERE batch_number = $1', [batch_number]);
    if (checkBatch.rows.length > 0) {
      return errorResponse(res, 'Batch number already exists', 409);
    }
    
    await client.query('BEGIN');
    
    const newBatch = await client.query(
      `INSERT INTO chemical_batches 
       (category_id, batch_number, manufacturer_date, expiration_date, total_containers, unit_weight_kg, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [category_id, batch_number, manufacturer_date, expiration_date, total_containers, unit_weight_kg, 'pending_price', req.user.userId]
    );
    
    const batchId = newBatch.rows[0].id;
    
    await client.query(
      `INSERT INTO inventory_stock (batch_id, containers_available, containers_reserved)
       VALUES ($1, $2, $3)`,
      [batchId, total_containers, 0]
    );
    
    const notificationMessage = `New batch requires pricing. Details:
- Batch Number: ${batch_number}
- Category ID: ${category_id}
- Manufacturer Date: ${manufacturer_date}
- Expiration Date: ${expiration_date}
- Total Containers: ${total_containers}
- Unit Weight: ${unit_weight_kg} Kg
Please set the Unit Buy Price to publish it to inventory.`;

    await client.query(
      `INSERT INTO notifications (recipient_role, related_batch_id, message)
       VALUES ($1, $2, $3)`,
      ['owner', batchId, notificationMessage]
    );
    
    await client.query(
      `INSERT INTO notifications (recipient_role, related_batch_id, message)
       VALUES ($1, $2, $3)`,
      ['finance', batchId, notificationMessage]
    );
    
    await client.query('COMMIT');
    
    return successResponse(res, newBatch.rows[0], 'Batch logged successfully. Awaiting price assignment.', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  } finally {
    client.release();
  }
};

const setBatchPrice = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { unit_buy_price } = req.body;
    
    if (unit_buy_price === undefined || Number(unit_buy_price) < 0) {
      return errorResponse(res, 'Valid unit_buy_price is required', 400);
    }
    
    const checkBatch = await client.query('SELECT status FROM chemical_batches WHERE id = $1', [id]);
    
    if (checkBatch.rows.length === 0) {
      return errorResponse(res, 'Batch not found', 404);
    }
    
    if (checkBatch.rows[0].status !== 'pending_price') {
      return errorResponse(res, 'Batch is already priced and published', 400);
    }
    
    await client.query('BEGIN');
    
    const updatedBatch = await client.query(
      `UPDATE chemical_batches 
       SET unit_buy_price = $1, status = 'active', published_at = NOW()
       WHERE id = $2 RETURNING *`,
      [unit_buy_price, id]
    );
    
    await client.query(
      `UPDATE notifications SET is_read = true WHERE related_batch_id = $1`,
      [id]
    );
    
    await client.query('COMMIT');
    
    return successResponse(res, updatedBatch.rows[0], 'Price set successfully. Batch is now live in inventory.', 200);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  } finally {
    client.release();
  }
};

const getAllBatches = async (req, res) => {
  try {
    const { role } = req.user;
    
    let query = `
      SELECT 
        cb.id, cb.batch_number, cb.manufacturer_date, cb.expiration_date, 
        cb.total_containers, cb.unit_weight_kg, cb.status, cb.published_at, cb.created_at,
        cc.name as category_name,
        u.full_name as created_by_name,
        "is".containers_available
    `;
    
    if (role === 'owner' || role === 'finance') {
      query += `, cb.unit_buy_price`;
    }
    
    query += `
      FROM chemical_batches cb
      JOIN chemical_categories cc ON cb.category_id = cc.id
      JOIN users u ON cb.created_by = u.id
      JOIN inventory_stock "is" ON cb.id = "is".batch_id
    `;
    
    if (role === 'storekeeper' || role === 'marketer') {
      query += ` WHERE cb.status = 'active'`;
    }
    
    query += ` ORDER BY cb.created_at DESC`;
    
    const result = await pool.query(query);
    
    return successResponse(res, result.rows, 'Batches retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const getBatchById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    let query = `
      SELECT 
        cb.id, cb.batch_number, cb.manufacturer_date, cb.expiration_date, 
        cb.total_containers, cb.unit_weight_kg, cb.status, cb.published_at, cb.created_at,
        cc.name as category_name,
        u.full_name as created_by_name,
        "is".containers_available
    `;
    
    if (role === 'owner' || role === 'finance') {
      query += `, cb.unit_buy_price`;
    }
    
    query += `
      FROM chemical_batches cb
      JOIN chemical_categories cc ON cb.category_id = cc.id
      JOIN users u ON cb.created_by = u.id
      JOIN inventory_stock "is" ON cb.id = "is".batch_id
      WHERE cb.id = $1
    `;
    
    if (role === 'storekeeper' || role === 'marketer') {
      query += ` AND cb.status = 'active'`;
    }
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 'Batch not found', 404);
    }
    
    return successResponse(res, result.rows[0], 'Batch retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const getCategories = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM chemical_categories ORDER BY name ASC');
    return successResponse(res, result.rows, 'Categories retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return errorResponse(res, 'Category name is required', 400);
    }
    
    const checkCategory = await pool.query('SELECT id FROM chemical_categories WHERE name = $1', [name]);
    if (checkCategory.rows.length > 0) {
      return errorResponse(res, 'Category already exists', 409);
    }
    
    const result = await pool.query(
      'INSERT INTO chemical_categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    
    return successResponse(res, result.rows[0], 'Category created successfully', 201);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

module.exports = {
  createBatch,
  setBatchPrice,
  getAllBatches,
  getBatchById,
  getCategories,
  createCategory
};
