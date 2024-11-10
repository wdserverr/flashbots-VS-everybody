require("dotenv").config()
const { providers, Wallet, utils, ethers } = require("ethers")
const { FlashbotsBundleProvider, FlashbotsBundleResolution } = require("@flashbots/ethers-provider-bundle")
const data = require("./data.json")
const { parseEther, formatEther } = require("ethers/lib/utils")


const RELAY = "https://relay.flashbots.net"
const provider = new providers.JsonRpcProvider('https://rpc.ankr.com/eth')


const korban = data.map((value) => {
    return new Wallet(value.korbanKey).connect(provider)
})
const owner = new Wallet(process.env.KEY_OWNER).connect(provider)

let korbanIndex = 0
async function main() {
    const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider,
        owner,
        RELAY
    )

    provider.on("block", async (blockNumber) => {
        const targetBlockNumber = blockNumber + 1
        const korbanSigner = korban[korbanIndex]
        try {
            const korbanNonce = await korbanSigner.getTransactionCount()
            const ownerBalance = await owner.getBalance()
            let nextKorbanNonce = 0

            const txOwner = await generateTransaction({
                from: owner.address,
                to: korbanSigner.address,
                value: utils.parseEther("0"),
                gasLimit: 21000,
            })

            const txKorbanGenerate = data[korbanIndex].txData.map(async (v, i) => {
                nextKorbanNonce = korbanNonce + i + 1
                return {
                    signer: korbanSigner,
                    transaction: await generateTransaction({
                        from: korbanSigner.address,
                        data: v.data,
                        gasLimit: v.gaslimit,
                        to: v.to,
                        nonce: korbanNonce + i,
                        value: parseEther(v.value.toString())
                    })
                }
            })

            const txs = await Promise.all(txKorbanGenerate)
            const feeKorbanTxs = []
            let maxFeePerGas = 0
            txs.map((korbanTx) => {
                feeKorbanTxs.push(
                    Number(korbanTx.transaction.maxFeePerGas) * korbanTx.transaction.gasLimit
                )
                maxFeePerGas = korbanTx.transaction.maxFeePerGas
            })
            let feeSum = feeKorbanTxs.reduce((acc, num) => acc + num, 0);

            if (Number(ownerBalance) > feeSum + (Number(maxFeePerGas) * 21000)) {
                txOwner.value = BigInt(feeSum)
                txs.unshift({
                    signer: owner,
                    transaction: txOwner
                })
                const signedTransactions = await flashbotsProvider.signBundle(txs)
                console.log(`Korban tx fee total: ${utils.formatEther(BigInt(feeSum)).slice(0, 8)} ETH`)
                const simulasion = await flashbotsProvider.simulate(signedTransactions, targetBlockNumber)
                if (!simulasion.firstRevert) {

                    const simulatedGasUsed = []
                    simulasion.results.map((v) => {
                        if (v.gasUsed > 22000) {
                            simulatedGasUsed.push(Number(maxFeePerGas) * v.gasUsed)
                        }
                    })

                    const calculatedFee = simulatedGasUsed.reduce((acc, num) => acc + num, 0);
                    const balanceLeft = feeSum - calculatedFee
                    const txBackValue = balanceLeft - ((Number(maxFeePerGas) * 21000))
                    console.log(`Balance Left: ${formatEther(BigInt(balanceLeft)).slice(0, 8)} ETH`)
                    console.log(`Sent back: ${formatEther(BigInt(txBackValue)).slice(0, 8)} ETH`)
                    sendBundle(flashbotsProvider, simulasion, signedTransactions, targetBlockNumber)
                    /* 
                    if (txBackValue > 0) {
                        const KorbanTxBack = await generateTransaction({
                            to: owner.address,
                            from: korbanSigner.address,
                            value: BigInt(txBackValue),
                            nonce: nextKorbanNonce
                        })
                        const signedTxBack = await korbanSigner.signTransaction(KorbanTxBack)
                        signedTransactions.push(signedTxBack)
                        const simulasion2 = await flashbotsProvider.simulate(signedTransactions, targetBlockNumber)
                        sendBundle(flashbotsProvider, simulasion2, signedTransactions, targetBlockNumber)
                    } else {
                    sendBundle(flashbotsProvider, simulasion, signedTransactions, targetBlockNumber)
                    }
                     */
                } else {
                    console.log(simulasion)
                }
            } else {
                console.log(`insufficient funds for gas\nBalance: ${formatEther(ownerBalance)}ETH\nGas Needed:${utils.formatEther(BigInt(feeSum)).slice(0, 8)} ETH`)
            }
        } catch (error) {
            console.log(error)
        }
    })
}

main()





async function sendBundle(flashbotsProvider, simulasion, signedTransactions, targetBlockNumber) {
    const bundleSubmission = await flashbotsProvider.sendRawBundle(
        signedTransactions,
        targetBlockNumber
    )
    if ("error" in bundleSubmission) {
        console.log(bundleSubmission.error.message)
        return
    }

    const resolution = await bundleSubmission.wait()
    if (resolution === FlashbotsBundleResolution.BundleIncluded) {
        console.log("######################################################")
        console.log(
            `Transaksi Sukses!!, Transaksi di eksekusi di Block: ${targetBlockNumber}`
        )
        bundleSubmission.bundleTransactions.map((asd) => {
            console.log(`Tx Hash: \nhttps://etherscan.io/tx/${asd.hash}`)
        })
        process.exit(0)
    } else if (
        resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion
    ) {
        console.log(
            `Transaksi gk ke eksekusi di block: ${targetBlockNumber} \nMencari blok lain...\n`
        )
    } else if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
        console.log("Nonce Ketinggian, Hmm..")
        process.exit(1)
    }
}





async function generateTransaction(params) {
    const tx = await owner.populateTransaction({
        to: owner.address,
        value: utils.parseEther("0")
    });
    tx.maxPriorityFeePerGas = tx.maxFeePerGas;

    for (const key in params) {
        switch (key) {
            case "data":
                tx.data = params.data;
                break;
            case "to":
                tx.to = params.to;
                break;
            case "nonce":
                tx.nonce = params.nonce;
                break;
            case "value":
                tx.value = params.value;
                break;
            case "gasLimit":
                tx.gasLimit = params.gasLimit;
                break;
            case "from":
                tx.from = params.from;
                break;
        }
    }

    return tx;
}
