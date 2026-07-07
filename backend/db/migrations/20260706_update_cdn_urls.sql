-- Update cover images/thumbnails in manga table from old R2 dev URL to new custom cdn domain
UPDATE manga 
SET thumbnail = REPLACE(thumbnail, 'https://pub-d73aa928fbfb420d978c85ef29b78158.r2.dev', 'https://cdn.komiknesia.net')
WHERE thumbnail LIKE 'https://pub-d73aa928fbfb420d978c85ef29b78158.r2.dev%';

-- Update chapter page images in chapter_images table from old R2 dev URL to new custom cdn domain
UPDATE chapter_images
SET image_path = REPLACE(image_path, 'https://pub-d73aa928fbfb420d978c85ef29b78158.r2.dev', 'https://cdn.komiknesia.net')
WHERE image_path LIKE 'https://pub-d73aa928fbfb420d978c85ef29b78158.r2.dev%';
