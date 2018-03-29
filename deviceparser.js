require('dotenv').config();
import axios from 'axios';
import fs from 'fs';
import { logger } from 'ms-logging';
import queue from 'queue';

let q = queue();
q.concurrency = 5;

const outputFile = `./output/devices-parsed-${new Date().getTime()}.csv`;
fs.writeFileSync(outputFile, 'Device, Platform, Price Category(L/M/H)');

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
        const phonePrice = await queryPhoneType(tab[0]);
        fs.appendFileSync(outputFile, `${tab[0]}, ${tab[1]}, ${phonePrice} \n`);
      } catch (err) {
        logger.error(err);
        fs.appendFileSync(outputFile, `${tab[0]}, ${tab[1]}, error \n`);
      }
      cb();
    }, 200)
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
    return 'low';
  }
}

/**
 * 
 * @param {*} deviceName 
 * @param {*} response 
 */
function parseResponse(deviceName, response) {
  let deviceValue = '';
  logger.database(response);
  if (response[0]) {
    logger.debug(`${deviceName} | ${response[0].price}`);
    if (response[0].Brand === 'Apple') return 'high';
    if (response[0].price) {
      const value = parseInt(response[0].price.match(/([\d])\w+/g)[0], 10);
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
      return deviceValue;
    }
  }
  return 'low';
}
