import { providers, Wallet, utils, BigNumber } from 'ethers'
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle'
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
const KEY_KORBAN = '0x..PrivateKey' // ini di isi private key wallet korban yang terhack
const CONTRACT_ADDRESS = '0x..ContractTokenAddress'

const main = async () => {
  if (KEY_OWNER === undefined || KEY_KORBAN === undefined) {
    console.error('Private key nya di isi dulu gan di KEY_OWNER & KEY_KORBAN')
    exit(1)
  }

  const provider = new providers.JsonRpcProvider(
    'https://eth-goerli.public.blastapi.io' // RPC, Cari Rpc di chainlist.org kalau rpc ini gk aktif
  )

  const authSigner = Wallet.createRandom() //Ini buat wallet baru, jangan diubah" karena ini gk ngaruh, cuma signer ke relay aja buat verifikasi jaringan
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    RELAY,
    'goerli'
  )


  const abi = ['function transfer(address,uint256) external']
  const iface = new utils.Interface(abi)

  const owner = new Wallet(KEY_OWNER).connect(provider)
  const korban = new Wallet(KEY_KORBAN).connect(provider)

  const block = await provider.getBlock("latest");
  const maxBaseFeeInFutureBlock = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock( BigNumber.from(block.baseFeePerGas), 1);
  const priorityFee = BigNumber.from(10).pow(9);

  // const maxPriority = '10'
  // const maxFee = '200'


  const signedTransactions = await flashbotsProvider.signBundle(
      [
          {
            signer: owner,
            transaction: {
              chainId: 5,
              type: 2,
              to: korban.address,
              value: utils.parseEther('0.05'),
              gasLimit: 30000,
              maxFeePerGas: priorityFee.add(maxBaseFeeInFutureBlock),
              maxPriorityFeePerGas: priorityFee,
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
              maxPriorityFeePerGas: priorityFee,
              data: iface.encodeFunctionData('transfer', [
                owner.address, //kiriw ke alamat owner yg aman
                utils.parseEther('1') //total token yg ingin dikirim dari wallet korban
              ])
            }
          }
        ])
  
        const blockNumber = await provider.getBlockNumber();

        const simulation = await flashbotsProvider.simulate(
          signedTransactions,
          blockNumber + 1
        );
      
        // Using TypeScript discrimination
        if ("error" in simulation) {
          console.log(`Simulation Error: ${simulation.error.message}`);
        } else {
          console.log(
            `Simulation Success: ${blockNumber} ${JSON.stringify(
              simulation,
              null,
              2
            )}`
          );
        }
      
        for (var i = 1; i <= 10; i++) {
          const bundleSubmission = flashbotsProvider.sendRawBundle(
            signedTransactions,
            blockNumber + i
          );
          console.log("submitted for block # ", blockNumber + i);
        }
        console.log("bundles submitted");
}

main()
