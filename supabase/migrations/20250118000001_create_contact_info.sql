-- Create contact_info table for storing contact information
CREATE TABLE IF NOT EXISTS contact_info (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
);

-- Insert default contact info (optional)
INSERT INTO contact_info (email, whatsapp, description, is_active) 
VALUES ('contact@komiknesia.com', '+6281234567890', 'Hubungi kami untuk pertanyaan, saran, atau dukungan.', TRUE);



