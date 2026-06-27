-- TABLE 1: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner','finance','marketer','storekeeper')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- TABLE 2: chemical_categories
CREATE TABLE chemical_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- TABLE 3: chemical_batches
CREATE TABLE chemical_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES chemical_categories(id),
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    manufacturer_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    total_containers INTEGER NOT NULL CHECK (total_containers > 0),
    unit_weight_kg DECIMAL(10,2) NOT NULL CHECK (unit_weight_kg > 0),
    unit_buy_price DECIMAL(12,2) DEFAULT NULL CHECK (unit_buy_price IS NULL OR unit_buy_price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending_price' CHECK (status IN ('pending_price','active','depleted','expired')),
    created_by UUID NOT NULL REFERENCES users(id),
    published_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- TABLE 4: inventory_stock
CREATE TABLE inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID UNIQUE NOT NULL REFERENCES chemical_batches(id),
    containers_available INTEGER NOT NULL DEFAULT 0 CHECK (containers_available >= 0),
    containers_reserved INTEGER NOT NULL DEFAULT 0 CHECK (containers_reserved >= 0),
    last_updated TIMESTAMP DEFAULT NOW()
);

-- TABLE 5: stock_out_requests
CREATE TABLE stock_out_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES chemical_batches(id),
    requested_by UUID NOT NULL REFERENCES users(id),
    customer_name VARCHAR(150) NOT NULL,
    quantity_containers INTEGER NOT NULL CHECK (quantity_containers > 0),
    sell_price_per_unit DECIMAL(12,2) NOT NULL CHECK (sell_price_per_unit >= 0),
    total_sell_price DECIMAL(14,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
    approved_by UUID REFERENCES users(id) DEFAULT NULL,
    requested_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP DEFAULT NULL
);

-- TABLE 6: notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_role VARCHAR(20) NOT NULL CHECK (recipient_role IN ('owner','finance','storekeeper','marketer')),
    related_batch_id UUID REFERENCES chemical_batches(id) DEFAULT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- TABLE 7: audit_logs
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    role_at_time VARCHAR(20) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    entity_table VARCHAR(50),
    entity_id UUID DEFAULT NULL,
    payload JSONB DEFAULT NULL,
    ip_address INET DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_batches_status ON chemical_batches(status);
CREATE INDEX idx_batches_expiration ON chemical_batches(expiration_date);
CREATE INDEX idx_batches_category ON chemical_batches(category_id);
CREATE INDEX idx_stock_batch ON inventory_stock(batch_id);
CREATE INDEX idx_requests_status ON stock_out_requests(status);
CREATE INDEX idx_requests_batch ON stock_out_requests(batch_id);
CREATE INDEX idx_requests_requester ON stock_out_requests(requested_by);
CREATE INDEX idx_notifications_role ON notifications(recipient_role);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_action ON audit_logs(action_type);

-- SEED DATA
INSERT INTO users (full_name, username, password_hash, role)
VALUES (
  'Ababi Yirga',
  'owner',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'owner'
);
