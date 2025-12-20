-- Komiknesia Database Structure
-- Created for manga reading application

CREATE DATABASE IF NOT EXISTS komiknesia;
USE komiknesia;

-- Categories table
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Manga table
CREATE TABLE manga (
    id INT PRIMARY KEY AUTO_INCREMENT,
    westmanga_id INT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    alternative_name TEXT,
    author VARCHAR(255),
    synopsis TEXT,
    thumbnail VARCHAR(500),
    cover_background VARCHAR(500),
    category_id INT,
    content_type VARCHAR(50),
    country_id VARCHAR(10),
    color BOOLEAN DEFAULT TRUE,
    hot BOOLEAN DEFAULT FALSE,
    is_project BOOLEAN DEFAULT FALSE,
    is_safe BOOLEAN DEFAULT TRUE,
    is_input_manual BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,1) DEFAULT 0,
    bookmark_count INT DEFAULT 0,
    views INT DEFAULT 0,
    `release` INT,
    status ENUM('ongoing', 'completed', 'hiatus') DEFAULT 'ongoing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_slug (slug),
    INDEX idx_westmanga_id (westmanga_id),
    INDEX idx_category (category_id),
    INDEX idx_status (status),
    INDEX idx_content_type (content_type),
    INDEX idx_country_id (country_id),
    INDEX idx_is_input_manual (is_input_manual),
    INDEX idx_hot (hot),
    INDEX idx_rating (rating)
);

-- Manga Genres junction table (many-to-many relationship)
CREATE TABLE manga_genres (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manga_id INT NOT NULL,
    category_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE KEY unique_manga_category (manga_id, category_id),
    INDEX idx_manga (manga_id),
    INDEX idx_category (category_id)
);

-- Chapters table
CREATE TABLE chapters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    westmanga_chapter_id INT NULL,
    manga_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    chapter_number VARCHAR(50) NOT NULL,
    cover VARCHAR(500),
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
    UNIQUE KEY unique_manga_chapter (manga_id, chapter_number),
    INDEX idx_manga (manga_id),
    INDEX idx_slug (slug),
    INDEX idx_westmanga_chapter_id (westmanga_chapter_id),
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


-- Insert categories
INSERT INTO categories (name, slug) VALUES
('4-Koma', '4-koma'),
('Action', 'action'),
('Adult', 'adult'),
('Adventure', 'adventure'),
('Anthology', 'anthology'),
('Comedy', 'comedy'),
('Comedy. Ecchi', 'comedy-ecchi'),
('Cooking', 'cooking'),
('Crime', 'crime'),
('Crossdressing', 'crossdressing'),
('Demon', 'demon'),
('Demons', 'demons'),
('Drama', 'drama'),
('Ecchi', 'ecchi'),
('Ecchi. Comedy', 'ecchi-comedy'),
('Fantasy', 'fantasy'),
('Game', 'game'),
('Gender Bender', 'gender-bender'),
('Genderswap', 'genderswap'),
('genre drama', 'genre-drama'),
('Ghosts', 'ghosts'),
('Gore', 'gore'),
('Gyaru', 'gyaru'),
('Harem', 'harem'),
('Historical', 'historical'),
('Horror', 'horror'),
('Isekai', 'isekai'),
('Isekai Action', 'isekai-action'),
('Josei', 'josei'),
('Long Strip', 'long-strip'),
('Magic', 'magic'),
('Magical Girls', 'magical-girls'),
('Manga', 'manga'),
('Manhua', 'manhua'),
('Martial Art', 'martial-art'),
('Martial arts', 'martial-arts'),
('Mature', 'mature'),
('Mecha', 'mecha'),
('Medical', 'medical'),
('Military', 'military'),
('mons', 'mons'),
('Monster', 'monster'),
('Monster girls', 'monster-girls'),
('Monsters', 'monsters'),
('Music', 'music'),
('Mystery', 'mystery'),
('Ninja', 'ninja'),
('Novel', 'novel'),
('Office Workers', 'office-workers'),
('Oneshot', 'oneshot'),
('Philosophical', 'philosophical'),
('Police', 'police'),
('Project', 'project'),
('Psychological', 'psychological'),
('Regression', 'regression'),
('Reincarnation', 'reincarnation'),
('Reverse Harem', 'reverse-harem'),
('Romance', 'romance'),
('School', 'school'),
('School life', 'school-life'),
('Sci fi', 'sci-fi'),
('Seinen', 'seinen'),
('SeinenAction', 'seinenaction'),
('Shotacon', 'shotacon'),
('Shoujo', 'shoujo'),
('Shoujo Ai', 'shoujo-ai'),
('Shounen', 'shounen'),
('Si-fi', 'si-fi'),
('Slice of Life', 'slice-of-life'),
('Smut', 'smut'),
('Sports', 'sports'),
('Super Power', 'super-power'),
('Supernatural', 'supernatural'),
('Survival', 'survival'),
('Suspense', 'suspense'),
('System', 'system'),
('Thriller', 'thriller'),
('Time Travel', 'time-travel'),
('Tragedy', 'tragedy'),
('Urban', 'urban'),
('Vampire', 'vampire'),
('Video Games', 'video-games'),
('Villainess', 'villainess'),
('Virtual Reality', 'virtual-reality'),
('Webtoons', 'webtoons'),
('Yuri', 'yuri'),
('Zombies', 'zombies');

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
    COUNT(DISTINCT mg.category_id) as genre_count,
    MAX(ch.created_at) as last_chapter_date
FROM manga m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN manga_genres mg ON m.id = mg.manga_id
LEFT JOIN chapters ch ON m.id = ch.manga_id
LEFT JOIN votes v ON m.id = v.manga_id
GROUP BY m.id;