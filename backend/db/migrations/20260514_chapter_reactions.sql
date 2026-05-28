-- Per-chapter reactions (same reaction_type values as manga votes: senang, biasaAja, kecewa, marah, sedih)
-- Run manually on MySQL if migrations are not auto-applied.

CREATE TABLE IF NOT EXISTS chapter_reactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  chapter_id INT NOT NULL,
  reaction_type VARCHAR(50) NOT NULL,
  user_id INT NULL,
  user_ip VARCHAR(45) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
  INDEX idx_chapter_reactions_chapter (chapter_id),
  INDEX idx_chapter_reactions_type (chapter_id, reaction_type)
);
