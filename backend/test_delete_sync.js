const { deleteLockPasscode } = require('./tuyaClient');

async function test() {
  const deviceId = 'a3e1f66xgo76vpw6';
  const passwordId = '23383118';
  try {
    console.log(`Deleting passcode ID ${passwordId} from lock ${deviceId}...`);
    await deleteLockPasscode(deviceId, passwordId);
    console.log('Successfully deleted!');
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
