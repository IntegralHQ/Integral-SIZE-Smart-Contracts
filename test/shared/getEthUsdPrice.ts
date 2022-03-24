import fetch from 'node-fetch'

export async function getEthUsdPrice(): Promise<number> {
  try {
    const res = await fetch('https://api.coinpaprika.com/v1/tickers/eth-ethereum')
    const data = await res.json()
    return data.quotes.USD.price
  } catch (err) {
    console.error(err)
    return 0
  }
}
