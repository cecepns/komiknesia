-- Migration: Update votes table to support multiple vote types
-- Changes vote_type from ENUM('up', 'down') to VARCHAR(50) to support: senang, biasaAja, kecewa, marah, sedih

USE komiknesia;

-- Alter vote_type column to VARCHAR
ALTER TABLE votes 
MODIFY COLUMN vote_type VARCHAR(50) NOT NULL DEFAULT 'senang';

-- Add index on vote_type for better query performance
CREATE INDEX idx_vote_type ON votes(vote_type);

