const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', 'uploads-komiknesia');

const deleteFile = (filePath) => {
  if (!filePath) return;

  if (!filePath.startsWith('/uploads/')) {
    return;
  }

  try {
    const filename = filePath.replace('/uploads/', '');
    const fullPath = path.join(uploadsDir, filename);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`Deleted file: ${fullPath}`);
    }
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
  }
};

module.exports = {
  deleteFile,
};

