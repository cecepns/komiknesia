-- User-defined readlists (custom manga lists per account). Run on MySQL if migrations are not auto-applied.

CREATE TABLE IF NOT EXISTS user_readlists (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_readlists_user (user_id)
);

CREATE TABLE IF NOT EXISTS user_readlist_manga (
  id INT PRIMARY KEY AUTO_INCREMENT,
  readlist_id INT NOT NULL,
  manga_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (readlist_id) REFERENCES user_readlists(id) ON DELETE CASCADE,
  FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
  UNIQUE KEY uq_readlist_manga (readlist_id, manga_id),
  INDEX idx_readlist_manga_readlist (readlist_id)
);
