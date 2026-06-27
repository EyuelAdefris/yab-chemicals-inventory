const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { successResponse, errorResponse } = require('../utils/responseHelper');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return errorResponse(res, 'Username and password are required', 400);
    }

    const result = await pool.query(
      'SELECT id, full_name, username, password_hash, role, is_active FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 'Invalid username or password', 401);
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return errorResponse(res, 'Account is deactivated. Contact the owner.', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return errorResponse(res, 'Invalid username or password', 401);
    }

    const payload = {
      userId: user.id,
      role: user.role,
      fullName: user.full_name,
      username: user.username
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });

    return successResponse(res, {
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        role: user.role
      }
    }, `Welcome back, ${user.full_name}!`, 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const createStaff = async (req, res) => {
  try {
    const { full_name, username, password, role } = req.body;
    if (!full_name || !username || !password || !role) {
      return errorResponse(res, 'All fields are required', 400);
    }

    const validRoles = ['finance', 'marketer', 'storekeeper'];
    if (!validRoles.includes(role)) {
      return errorResponse(res, 'Invalid role. Must be finance, marketer, or storekeeper', 400);
    }

    const userCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return errorResponse(res, 'Username already taken', 409);
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      'INSERT INTO users (full_name, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, username, role, is_active, created_at',
      [full_name, username, password_hash, role]
    );

    return successResponse(res, newUser.rows[0], 'Staff account created successfully', 201);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const getAllStaff = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, username, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    return successResponse(res, result.rows, 'Staff list retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return errorResponse(res, 'Both current_password and new_password are required', 400);
    }
    if (new_password.length < 6) {
      return errorResponse(res, 'New password must be at least 6 characters', 400);
    }

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
    if (result.rows.length === 0) {
      return errorResponse(res, 'User not found', 404);
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect', 401);
    }

    const new_password_hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [new_password_hash, req.user.userId]);

    return successResponse(res, null, 'Password changed successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role } = req.body;

    if (!full_name && !role) {
      return errorResponse(res, 'Provide at least full_name or role to update', 400);
    }

    if (role && !['finance', 'marketer', 'storekeeper'].includes(role)) {
      return errorResponse(res, 'Invalid role', 400);
    }

    let query = 'UPDATE users SET ';
    const values = [];
    let count = 1;

    if (full_name) {
      query += `full_name = $${count}, `;
      values.push(full_name);
      count++;
    }

    if (role) {
      query += `role = $${count}, `;
      values.push(role);
      count++;
    }

    query = query.slice(0, -2);
    query += ` WHERE id = $${count} RETURNING id, full_name, username, role, is_active, created_at`;
    values.push(id);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return errorResponse(res, 'Staff member not found', 404);
    }

    return successResponse(res, result.rows[0], 'Staff updated successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const toggleStaffActive = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.userId) {
      return errorResponse(res, 'You cannot deactivate your own account', 400);
    }

    const checkResult = await pool.query('SELECT is_active FROM users WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return errorResponse(res, 'Staff member not found', 404);
    }

    const currentStatus = checkResult.rows[0].is_active;
    const newStatus = !currentStatus;

    const result = await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, full_name, username, role, is_active, created_at',
      [newStatus, id]
    );

    const statusWord = newStatus ? 'activated' : 'deactivated';
    return successResponse(res, result.rows[0], `Account ${statusWord} successfully`, 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

module.exports = {
  login,
  createStaff,
  getAllStaff,
  changePassword,
  updateStaff,
  toggleStaffActive
};
