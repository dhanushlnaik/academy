const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Configuration - Replace these with your actual values
const TEAM_ID = '2R2CQNX632'; // Found in Apple Developer account membership
const CLIENT_ID = 'com.eipsinsight.webapp.signin'; 
const KEY_ID = 'M7N46GNRXN'; 
const PRIVATE_KEY_FILE = 'AuthKey_M7N46GNRXN.p8'; 

// Path to the private key file (should be in the same directory as this script)
const PRIVATE_KEY_PATH = path.join(__dirname, PRIVATE_KEY_FILE);

try {
  // Check if the private key file exists
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('❌ Error: Private key file not found!');
    console.error(`Looking for: ${PRIVATE_KEY_PATH}`);
    console.error('\nPlease:');
    console.error('1. Download your .p8 file from Apple Developer console');
    console.error('2. Place it in the scripts/ directory');
    console.error('3. Update PRIVATE_KEY_FILE in this script with the correct filename');
    process.exit(1);
  }

  // Validate configuration
  if (TEAM_ID === 'YOUR_TEAM_ID_HERE' || KEY_ID === 'YOUR_KEY_ID_HERE') {
    console.error('❌ Error: Please update the configuration in this script!');
    console.error('\nYou need to replace:');
    console.error('- TEAM_ID: Your Apple Team ID');
    console.error('- CLIENT_ID: Your Services ID (e.g., com.eipsinsight.webapp.signin)');
    console.error('- KEY_ID: Your Sign In with Apple Key ID');
    console.error('- PRIVATE_KEY_FILE: Name of your .p8 file');
    process.exit(1);
  }

  // Read the private key
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

  // Generate the JWT token
  const token = jwt.sign(
    {}, 
    privateKey, 
    {
      algorithm: 'ES256',
      expiresIn: '180d', // Apple allows max 6 months
      audience: 'https://appleid.apple.com',
      issuer: TEAM_ID,
      subject: CLIENT_ID,
      keyid: KEY_ID
    }
  );

  console.log('✅ Apple Client Secret generated successfully!\n');
  console.log('Copy this token to your .env file as APPLE_CLIENT_SECRET:\n');
  console.log('─'.repeat(80));
  console.log(token);
  console.log('─'.repeat(80));
  console.log('\n⚠️  Important: This token is valid for 180 days');
  console.log('You will need to regenerate it after:', new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString());
  console.log('\nAdd to .env:');
  console.log(`APPLE_CLIENT_SECRET=${token}`);

} catch (error) {
  console.error('❌ Error generating Apple client secret:', error.message);
  process.exit(1);
}
