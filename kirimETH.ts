import { providers, Wallet, utils, BigNumber } from 'ethers'
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle'
import { exit } from 'process'

/*
Dibawah ini relay ethereum mainnet, klo mau pake relay lain bisa dicari disini

https://boost-relay.flashbots.net/
https://github.com/flashbots/mev-boost-relay

WARNING!! link diatas bukan relay, tapi buat cari kumpulan relay yg aktif
*/

// klo mau pake di jaringan ethereum mainnet, ganti https://relay-goerli.flashbots.net jadi https://relay.flashbots.net dibawah

const RELAY = 'https://relay-goerli.flashbots.net'  // Relay url goerli, klo mau jalanin script di ethereum mainnet ganti pake relay mainnet
const KEY_OWNER = '0x..PrivateKey' // ini di isi private key pribadi buat ngirim eth ke wallet korban buat gas fee
const KEY_KORBAN = '0x..PrivateKey' // ini di isi wallet korban yang ter hack atau kena drainer

const main = async () => {
  if (KEY_OWNER === undefined || KEY_KORBAN === undefined) {
    console.error('Private key nya di isi dulu gan di KEY_OWNER & KEY_KORBAN')
    exit(1)
  }

  const provider = new providers.JsonRpcProvider(
    'https://rpc.ankr.com/eth_goerli' // RPC, Cari Rpc di chainlist.org kalau rpc ini gk aktif
  )

  const authSigner = Wallet.createRandom() //Ini buat wallet baru, jangan diubah" karena ini gk ngaruh, cuma signer ke relay aja buat verifikasi jaringan

  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    RELAY,
    'goerli'
  )

provider.on('block', async blockNumber => {
  console.log(`Sedang Mencari Block... \nBlock saat ini: ${blockNumber}
    `)
  const targetBlockNumber = blockNumber + 1


  const owner = new Wallet(KEY_OWNER).connect(provider)
  const korban = new Wallet(KEY_KORBAN).connect(provider)

  // const maxFee = '200'
  // const maxPriority = '10'


//##################################################################################################
/*
  DI AREA INI KITA DEKLARASI TRANSAKSI BIASA, KIRIM ETH ANTAR WALLET BUKAN KIRIM TOKEN ATAU NFT.
  KALAU MAU KIRIM TOKEN ATAU NFT, KITA UBAH VARIABEL const signedTransactions ini, kalau kalian awam dan gk paham sama sekali, gw udah siapin di file 1 lagi, jadi jangan pake file/script yang ini kalau mau kirim token atau nft
*/
const block = await provider.getBlock("latest");
const maxBaseFeeInFutureBlock = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(BigNumber.from(block.baseFeePerGas), 1);
const priorityFee = BigNumber.from(10).pow(9);
  const signedTransactions = await flashbotsProvider.signBundle(
    [
      {
        signer: owner,
        transaction: {
          chainId: 5,
          type: 2,
          to: korban.address,
          value: utils.parseEther('0.01'),
          gasLimit: 30000,
          maxFeePerGas: priorityFee.add(maxBaseFeeInFutureBlock),
          maxPriorityFeePerGas: priorityFee
        }
      },
      {
        signer: korban,
        transaction: {
          chainId: 5,
          type: 2,
          to: owner.address,
          value: utils.parseEther('0.005'),
          gasLimit: 21000,
          maxFeePerGas: priorityFee.add(maxBaseFeeInFutureBlock),
          maxPriorityFeePerGas: priorityFee
        }
      }
  ])
//###################################################################################################



//###################################################################################################
/*
  DI AREA INI JANGAN DIUBAH" KALO GK PAHAM, AREA INI CUMA SEKUMPULAN FUNCTION UNTUK KIRIM TRANSAKSI KE RELAY
*/


  const bundleSubmission = await flashbotsProvider.sendRawBundle(
    signedTransactions,
    targetBlockNumber
  )

  if ('error' in bundleSubmission) {
    console.log(bundleSubmission.error.message)
    return
  }

  const resolution = await bundleSubmission.wait()
  if (resolution === FlashbotsBundleResolution.BundleIncluded) {
      console.log('######################################################')
      console.log(`Mantapu jiwa!, Transaksi di eksekusi di Block: ${targetBlockNumber}`);
      bundleSubmission.bundleTransactions.map((asd) => {
        console.log(`Tx Hash: \nhttps://goerli.etherscan.io/tx/${asd.hash}`)
      })
      exit(0);
    } else if (
      resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion
    ) {
      console.log(`Transaksi gk ke eksekusi di block: ${targetBlockNumber} \nMencari blok lain...\n`);
    } else if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log("Nonce Ketinggian, Hmm..");
      exit(1);
    }

//###################################################################################################

})
}

main()
