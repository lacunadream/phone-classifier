require('dotenv').config();
import axios from 'axios';
import fs from 'fs';
import { logger } from 'ms-logging';
import queue from 'queue';

const q = queue();
q.concurrency = 10;
const inputFileName = process.argv[2];

logger.info(`file: ${inputFileName} | token: ${process.env.FRESHPI_APITOKEN}`);

const lineReader = require('readline').createInterface({
  input: require('fs').createReadStream(`./input/${inputFileName}`)
});

const outputFile = `./output/${inputFileName.substring(0, inputFileName.length - 4)}-parsed-${new Date().getTime()}.csv`;
fs.writeFileSync(outputFile, 'Device, Platform, Price Category(L/M/H), Sim Type \n');

let jobsCounter = 0;
let completedCounter = 0;

lineReader.on('line', (line) => {
  const tab = line.split(',');
  // logger.info(tab[0]);
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

/**
 * call api and return value/sim results
 * @param {string} deviceName 
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
 * process the response from the api
 * @param {string} deviceName 
 * @param {object} response 
 */
function parseResponse(deviceName, response) {
  let deviceValue = 'low';
  let deviceSim = 'single';
  // logger.verbose(response);
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
        // values are tailored to Malaysian market
        case (value <= 150): 
          deviceValue = 'low';
          break;
        case (value <= 420):
          deviceValue = 'medium';
          break;
        case (value > 420): 
          deviceValue = 'high';
          break;
        default: 
          deviceValue = 'low';
      }
    }
    // manual override for apple
    if (response[0].Brand === 'Apple' && parseInt(year, 10) >= 2015) deviceValue = 'high';
    if (sim && /dual/gi.test(sim)) deviceSim = 'dual';
  }
  return {
    deviceValue,
    deviceSim,
  };
}

// (async function() {
//   await queryPhoneType('Galaxy S8')
// })()
