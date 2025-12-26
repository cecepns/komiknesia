-- Create featured_items table for managing featured manga (banner, popular, update terbaru, etc.)
CREATE TABLE IF NOT EXISTS featured_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manga_id INT NOT NULL,
    featured_type ENUM('banner', 'popular_daily', 'popular_weekly', 'popular_monthly', 'update_terbaru', 'rekomendasi') NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
    INDEX idx_type (featured_type),
    INDEX idx_active (is_active),
    INDEX idx_order (display_order),
    UNIQUE KEY unique_manga_type (manga_id, featured_type)
);






