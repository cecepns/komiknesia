// Script to generate bcrypt hash for admin password
// Run: node backend/generate-admin-hash.js

import bcrypt from 'bcryptjs';

const password = '@backend/uploads-komiknesia/image-1766231072205-953873386.jpg';
const hash = await bcrypt.hash(password, 10);

console.log('\n=== Admin User Password Hash ===');
console.log('Password:', password);
console.log('Bcrypt Hash:', hash);
console.log('\nCopy the hash above to the migration file.\n');

