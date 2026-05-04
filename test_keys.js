require('@babel/register');
const gongsManager = require('./lib/gongsManager');
const scheduleManager = require('./lib/scheduleManager');

gongsManager.init();
setTimeout(() => {
  console.log("All automatic gongs map:", gongsManager.automaticGongsMap.size);
  const arr = gongsManager.automaticGongsMap.get(1777150800000);
  console.log("Length of timedGongsArray:", arr ? arr.length : 'none');
  if (arr) {
    arr.forEach(g => {
      console.log("Gong in array:", new Date(g.time).toISOString(), g.time);
    });
  }
  process.exit(0);
}, 2000);
