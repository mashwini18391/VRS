-- ═══════════════════════════════════════════════════
-- VRS Database Schema — MySQL
-- Trust, Validation & Anti-Fraud System
-- ═══════════════════════════════════════════════════

-- Create database
CREATE DATABASE IF NOT EXISTS vrs_db;
USE vrs_db;

-- ── Mechanics Table ──
CREATE TABLE IF NOT EXISTS mechanics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  specialization VARCHAR(100),
  rating DECIMAL(2,1) DEFAULT 0.0,
  total_reviews INT DEFAULT 0,
  completed_bookings INT DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  trust_score DECIMAL(3,1) DEFAULT 0.0,
  verified_at TIMESTAMP NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Services & Pricing Table ──
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  description TEXT,
  estimated_time_minutes INT DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Vehicles Table ──
CREATE TABLE IF NOT EXISTS vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  make VARCHAR(50),
  model VARCHAR(50),
  year INT,
  license_plate VARCHAR(20),
  color VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Bookings Table ──
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  mechanic_id INT,
  service_id INT,
  status ENUM('pending','accepted','in_progress','completed','cancelled') DEFAULT 'pending',
  vehicle_type VARCHAR(50),
  issue_description TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  total_price DECIMAL(10,2),
  is_emergency BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (mechanic_id) REFERENCES mechanics(id) ON DELETE SET NULL,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);

-- ── Reviews Table ──
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id VARCHAR(20) UNIQUE,
  user_id VARCHAR(255) NOT NULL,
  mechanic_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (mechanic_id) REFERENCES mechanics(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_mechanic (user_id, mechanic_id),
  INDEX idx_mechanic (mechanic_id),
  INDEX idx_rating (rating)
);

-- ── Admin Actions Audit Log ──
CREATE TABLE IF NOT EXISTS admin_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  action_type ENUM('approve_mechanic','reject_mechanic','remove_review','flag_booking') NOT NULL,
  target_id VARCHAR(255) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin (admin_id),
  INDEX idx_action (action_type)
);

-- ═══════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════

-- ── Seed Mechanics ──
INSERT INTO mechanics (name, phone, specialization, rating, total_reviews, completed_bookings, verified, trust_score, verified_at, latitude, longitude, is_available) VALUES
('Rajesh Kumar', '+91-9876543210', 'Engine Specialist', 4.8, 156, 180, TRUE, 9.6, '2025-12-01 10:00:00', 11.94500000, 79.81200000, TRUE),
('Priya Patel', '+91-9876543211', 'Electrical & Battery', 4.6, 89, 102, TRUE, 8.4, '2025-12-15 10:00:00', 11.93800000, 79.82000000, TRUE),
('Ajay Singh', '+91-9876543212', 'Tire & Suspension', 4.9, 234, 260, TRUE, 10.0, '2025-11-20 10:00:00', 11.95200000, 79.80500000, TRUE),
('Sneha Deshmukh', '+91-9876543213', 'General Mechanic', 4.5, 67, 75, FALSE, 5.2, NULL, 11.93200000, 79.82500000, FALSE),
('Rahul Mehta', '+91-9876543214', 'AC & Cooling', 4.7, 112, 130, TRUE, 9.0, '2026-01-10 10:00:00', 11.94800000, 79.80000000, TRUE),
('Amit Verma', '+91-9876543215', 'Brake Specialist', 4.4, 45, 50, FALSE, 4.5, NULL, 11.95500000, 79.81800000, TRUE);

-- ── Seed Services ──
INSERT INTO services (name, category, base_price, description, estimated_time_minutes) VALUES
('Flat Tire Repair', 'tire', 500.00, 'Puncture repair or spare tire mounting', 30),
('Tire Replacement', 'tire', 3500.00, 'New tire fitting and balancing', 45),
('Battery Jump Start', 'battery', 800.00, 'Battery jump start with portable booster', 20),
('Battery Replacement', 'battery', 4500.00, 'Old battery removal and new battery installation', 30),
('Engine Diagnosis', 'engine', 1500.00, 'OBD-II scan and engine fault diagnosis', 60),
('Engine Oil Change', 'engine', 1200.00, 'Complete engine oil and filter change', 45),
('Brake Pad Replacement', 'brake', 2500.00, 'Front or rear brake pad replacement', 90),
('Brake Fluid Refill', 'brake', 600.00, 'Brake fluid top-up and bleeding', 30),
('Emergency Fuel Delivery', 'fuel', 600.00, '5L emergency fuel delivery', 25),
('Towing Service', 'other', 2000.00, 'Vehicle towing up to 20km', 45),
('AC Gas Refill', 'other', 1800.00, 'AC refrigerant recharge', 40),
('Coolant Refill', 'other', 500.00, 'Engine coolant top-up', 15),
('Spark Plug Replacement', 'engine', 800.00, 'Spark plug inspection and replacement', 30),
('Headlight/Taillight Fix', 'other', 400.00, 'Bulb replacement for headlights or taillights', 20);

-- ── Seed Vehicles ──
INSERT INTO vehicles (user_id, make, model, year, license_plate, color) VALUES
('demo-user-123', 'Hyundai', 'i20', 2022, 'MH-12-AB-1234', 'Silver'),
('demo-user-123', 'Honda', 'Activa', 2023, 'MH-12-CD-5678', 'Black');

-- ── Seed Bookings ──
INSERT INTO bookings (id, user_id, mechanic_id, service_id, status, vehicle_type, issue_description, latitude, longitude, total_price, created_at, completed_at) VALUES
('BK001', 'demo-user-123', 3, 1, 'completed', 'car', 'Flat tire on highway', 11.94160000, 79.80830000, 1200.00, '2026-03-18 10:30:00', '2026-03-18 11:15:00'),
('BK002', 'demo-user-123', 2, 3, 'completed', 'car', 'Battery dead, car won''t start', 11.94200000, 79.81000000, 800.00, '2026-03-15 14:15:00', '2026-03-15 14:45:00'),
('BK003', 'demo-user-123', 1, 5, 'completed', 'bike', 'Engine overheating', 11.94000000, 79.80700000, 3500.00, '2026-03-10 09:00:00', '2026-03-10 10:30:00');

-- ── Seed Reviews ──
INSERT INTO reviews (booking_id, user_id, mechanic_id, rating, comment) VALUES
('BK001', 'demo-user-123', 3, 5, 'Excellent service! Fixed the tire in 20 minutes.'),
('BK002', 'demo-user-123', 2, 4, 'Quick response, got my car running again.'),
('BK003', 'demo-user-123', 1, 5, 'Very knowledgeable, fixed the issue permanently.');
