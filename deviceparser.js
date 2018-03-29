require('dotenv').config();
import axios from 'axios';
import fs from 'fs';
import { logger } from 'ms-logging';
import queue from 'queue';

let q = queue();
q.concurrency = 10;

const outputFile = `./output/devices-parsed-${new Date().getTime()}.csv`;
fs.writeFileSync(outputFile, 'Device, Platform, Price Category(L/M/H), Sim Type \n');

const lineReader = require('readline').createInterface({
  input: require('fs').createReadStream(`./devices.csv`)
});

let jobsCounter = 0;
let completedCounter = 0;

lineReader.on('line', (line) => {
  const tab = line.split(',');
  logger.info(tab[0])
  jobsCounter += 1;
  q.push((cb) => {
    setTimeout(async () => {
      try {
        const { deviceValue, deviceSim } = await queryPhoneType(tab[0]);
        fs.appendFileSync(outputFile, `${tab[0]}, ${tab[1]}, ${deviceValue}, ${deviceSim} \n`);
      } catch (err) {
        logger.error(err);
        fs.appendFileSync(outputFile, `${tab[0]}, ${tab[1]}, error, error \n`);
      }
      cb();
    }, 100)
  })
})

lineReader.on('close', async () => {
  q.start(function (err) {
    if (err) logger.error(err);
    logger.info(`done - saved to: ${outputFile}`);
  })
})

q.on('success', () => {
  completedCounter += 1;
  logger.info(`completed ${completedCounter} / ${jobsCounter}`);
})

// (async function() {
//   await queryPhoneType('Galaxy S8')
// })()

logger.debug(process.env.FRESHPI_APITOKEN)

/**
 * 
 * @param {*} deviceName 
 */
async function queryPhoneType(deviceName) {
  try {
    const response = await axios.post('https://fonoapi.freshpixl.com/v1/getdevice', {
      token: process.env.FRESHPI_APITOKEN,
      limit: 1,
      device: deviceName,
      position: 0,
    })
    // logger.verbose(parseResponse(deviceName, response.data));
    return parseResponse(deviceName, response.data);
  } catch (err) {
    logger.error(err);
    return {
      deviceValue: 'low',
      deviceSim: 'single',
    };
  }
}

/**
 * 
 * @param {*} deviceName 
 * @param {*} response 
 */
function parseResponse(deviceName, response) {
  let deviceValue = 'low';
  let deviceSim = 'single';
  // logger.database(response);
  if (response[0]) {
    // sometimes more than 1 result is returned despite limit = 1;
    let price = null;
    const sim = response[0].sim;
    const year = response[0].announced.substring(0, 4);
    for (const device of response) {
      if (device.price && year === device.announced.substring(0, 4)) {
        price = device.price;
        break;
      }
    }
    logger.debug(`${deviceName} | ${price} | ${sim}`);
    if (price) {
      const value = parseInt(price.match(/([\d])\w+/g)[0], 10);
      switch (true) {   
        case (value <= 200): 
          deviceValue = 'low';
          break;
        case (value <= 450):
          deviceValue = 'medium';
          break;
        case (value > 450): 
          deviceValue = 'high';
          break;
        default: 
          deviceValue = 'low';
      }
    }
    // manual override for apple
    if (response[0].Brand === 'Apple') deviceValue = 'high';
    if (sim && /dual/gi.test(sim)) deviceSim = 'dual';
  }
  return {
    deviceValue,
    deviceSim,
  };
}
