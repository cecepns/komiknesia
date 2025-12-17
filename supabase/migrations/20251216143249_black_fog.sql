-- Komiknesia Database Structure
-- Created for manga reading application

CREATE DATABASE IF NOT EXISTS komiknesia;
USE komiknesia;

-- Categories table
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Manga table
CREATE TABLE manga (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    author VARCHAR(100) NOT NULL,
    synopsis TEXT,
    thumbnail VARCHAR(500),
    cover_background VARCHAR(500),
    category_id INT,
    views INT DEFAULT 0,
    status ENUM('ongoing', 'completed', 'hiatus') DEFAULT 'ongoing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_slug (slug),
    INDEX idx_category (category_id),
    INDEX idx_status (status)
);

-- Chapters table
CREATE TABLE chapters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manga_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    chapter_number DECIMAL(5,1) NOT NULL,
    cover VARCHAR(500),
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
    UNIQUE KEY unique_manga_chapter (manga_id, chapter_number),
    INDEX idx_manga (manga_id),
    INDEX idx_chapter_number (chapter_number)
);

-- Chapter Images table
CREATE TABLE chapter_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chapter_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    page_number INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    INDEX idx_chapter (chapter_id),
    INDEX idx_page (page_number)
);

-- Votes table for manga voting system
CREATE TABLE votes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manga_id INT NOT NULL,
    vote_type ENUM('up', 'down') DEFAULT 'up',
    user_ip VARCHAR(45) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_manga_vote (manga_id, user_ip),
    INDEX idx_manga (manga_id)
);

-- Ads table for advertising system
CREATE TABLE ads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    image VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),
    ads_type ENUM('banner', 'sidebar', 'popup', 'inline') DEFAULT 'banner',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (ads_type),
    INDEX idx_active (is_active)
);

-- Optional Users table for future authentication (commented out for now)

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role)
);


-- Insert sample categories
INSERT INTO categories (name, description) VALUES
('Action', 'Manga dengan genre aksi dan pertarungan'),
('Romance', 'Manga dengan tema percintaan dan romantis'),
('Comedy', 'Manga dengan genre komedi dan humor'),
('Drama', 'Manga dengan cerita dramatis dan emosional'),
('Fantasy', 'Manga dengan unsur fantasi dan sihir'),
('Sci-Fi', 'Manga dengan tema science fiction'),
('Horror', 'Manga dengan genre horor dan thriller'),
('Slice of Life', 'Manga dengan cerita kehidupan sehari-hari');

-- Insert sample manga (optional)
INSERT INTO manga (title, slug, author, synopsis, category_id) VALUES
('Sample Manga 1', 'sample-manga-1', 'Author One', 'This is a sample manga description for testing purposes.', 1),
('Sample Manga 2', 'sample-manga-2', 'Author Two', 'Another sample manga with different genre and story.', 2);

-- Indexes for better performance
CREATE INDEX idx_manga_created_at ON manga(created_at);
CREATE INDEX idx_chapters_created_at ON chapters(created_at);
CREATE INDEX idx_votes_created_at ON votes(created_at);

-- Views for common queries
CREATE VIEW manga_with_stats AS
SELECT 
    m.*,
    c.name as category_name,
    COUNT(DISTINCT ch.id) as chapter_count,
    COUNT(DISTINCT v.id) as vote_count,
    MAX(ch.created_at) as last_chapter_date
FROM manga m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN chapters ch ON m.id = ch.manga_id
LEFT JOIN votes v ON m.id = v.manga_id
GROUP BY m.id;