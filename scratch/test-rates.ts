import { getExchangeRates } from '../lib/rates';

async function test() {
  console.log('Fetching exchange rates...');
  try {
    const rates = await getExchangeRates();
    console.log('Rates fetched successfully:');
    console.log(JSON.stringify(rates, null, 2));
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

test();
