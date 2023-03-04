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
const KEY_OWNER = '0x...PrivaateKey' // ini di isi private key pribadi buat ngirim eth ke wallet korban buat gas fee
const KEY_KORBAN = '0x...PrivaateKey' // ini di isi private key wallet korban yang terhack
const CONTRACT_ADDRESS = '0x..ContractAddress'

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

  const abi = ['function transfer(address,uint256) external']
  const iface = new utils.Interface(abi)
  
  const owner = new Wallet(KEY_OWNER).connect(provider)
  const korban = new Wallet(KEY_KORBAN).connect(provider)


  // const maxFee = '600'
  // const maxPriority = '10'

  const block = await provider.getBlock("latest");
  const maxBaseFeeInFutureBlock = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(BigNumber.from(block.baseFeePerGas), 1);
  const priorityFee = BigNumber.from(10).pow(9);

  const maxFee = '5' // naikin fee ini kalau transaksi gk tereksekusi atau ganti rpc

  


//##################################################################################################
/*
  DI AREA INI KITA DEKLARASI TRANSAKSI KIRIM TOKEN , 
  LIAT DIBAWAH ADA "signer: owner" ? itu artinya kita kirim eth dari wallet owner ke wallet yang ke hack atau wallet korban,
  dengan jumlah 0.01 eth, cek di bagian "value: utils.parseEther('0.01')".

  di bagian kedua dibawah ditandai mulai dari "signer: korban", kita bikin transaksi ke 2.. yaitu kirim token dari wallet korban ke wallet owner
  kita kirim transaksi nya ke alamat contract dari token yg mau dikirim di bagian ini, to: CONTRACT_ADDRESS
  lalu kita isi parameter nya di bagian "data:"
  dibagian "data:" ini kita panggil fungsi 'transfer' ke smart contract, 
  lalu kita isi alamat owner untuk penerima nya, dan isi jumlah token yg mau dikirim berapa biji

  Jadi nya komplit kodenya kaya gini dibawah

  data: iface.encodeFunctionData('transfer',[
    owner.address, 
      utils.parseEther('5') 
  ])


  NOTE: di bawah kita udah isi address nya dengan owner.address jadi gaperlu di isi pake address "0x...address"

  owner.address itu artinya apa bang messi?
  artinya adalah kita ambil address eth dari private key diatas yg udah kita isi

  terakhir.. kalian ganti variabel "CONTRACT_ADDRESS" diatas sesuai smart contract token yg mau dikirim
*/

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
          maxPriorityFeePerGas: utils.parseUnits(maxFee, 'gwei'),
        }
      },
      {
        signer: korban,
        transaction: {
          chainId: 5,
          type: 2,
          to: CONTRACT_ADDRESS,
          gasLimit: 200000,
          maxFeePerGas: priorityFee.add(maxBaseFeeInFutureBlock),
          maxPriorityFeePerGas: utils.parseUnits(maxFee, 'gwei'),
          data: iface.encodeFunctionData('transfer', 
          [
            owner.address, //kiriw ke alamat owner yg aman
            utils.parseEther('5000') //total token yg ingin dikirim dari wallet korban
          ])
        }
      }
    ])

//###################################################################################################



//###################################################################################################
/*
  DI AREA INI JANGAN DIUBAH" KALO GK PAHAM, AREA INI CUMA SEKUMPULAN FUNCTION UNTUK KIRIM TRANSAKSI KE BLOCKCHAIN
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
      console.log(`Transaksi Sukses!!, Transaksi di eksekusi di Block: ${targetBlockNumber}`);
      bundleSubmission.bundleTransactions.map((asd) => {
        console.log(`Tx Hash: \nhttps://goerli.etherscan.io/tx/${asd.hash}`)
      })
      exit(0);
    } else if (resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
      console.log(`Transaksi gk ke eksekusi di block: ${targetBlockNumber} \nMencari blok lain...\n`);
    } else if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log("Nonce Ketinggian, Hmm..");
      exit(1);
    }

//###################################################################################################

})
}

main()
