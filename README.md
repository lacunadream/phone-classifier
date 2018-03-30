# Phone Classifier

Classifies any csv list of phone models based on model value (low, medium, high) and sim type (single, dual). 

Phone characteristics data is obtained from [fonoApi](https://fonoapi.freshpixl.com)

### Pre-requisites

- [Node.js](nodejs.org) Node ^6

### Setup

- Retrieve an access token from [fonoApi](https://fonoapi.freshpixl.com/token/generate)
- Install dependencies `npm i`
- Place csv file of devices to be classified in `input`
- Run: `npm run start -- <filename>`
- Parsed files will be saved in `output`

### Environment Variables

Create a new `.env` file and store the token obtained in the previous section using the format `FRESHPI_APITOKEN='XXX'`

### YAGNI

[YAGNI](https://martinfowler.com/bliki/Yagni.html). Some parts of the script could be refactored to enable injection of custom handlers/price segmentation/throughput, but well, YAGNI. 
