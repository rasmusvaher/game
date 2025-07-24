const { PrivyClient } = require('@privy-io/server-auth');

const privy = new PrivyClient(
  'cmd65x2wt03gmld0mpfldjm07',
  '2UmRLDAEkDeeQEqVzzmwqPapvTQevinXgvjVNEMwA7ZzeQWrNaXo1ZMmHoR2Fxut7JwNrq5D6bFE94gt6veS3iAC'
);

console.log('Privy client methods:', Object.keys(privy));

module.exports = privy; 