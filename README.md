# Tutorial Singkat

https://youtu.be/vN7uk4pEga8

## Kirim ETH

Cara menjalankan script

```bash
  npm install
```

```bash
  npm install -g ts-node
```

```bash
  isi KEY_OWNER & KEY_KORBAN dengan private key
```

![Screenshot 2023-03-09 095036](https://user-images.githubusercontent.com/42107311/223985249-015e5ef1-4839-407c-be3a-d9363d947ebb.png)

```bash
  ts-node kirimETH.ts
```

## CONTOH

2 transaksi akan terkirim dalam 1 blok yg sama
![flasbot](https://user-images.githubusercontent.com/42107311/222519557-2d3587cb-6d1c-453a-ada6-d71c23eb9a9b.png)

## Kirim Token

```bash
  isi CONTRACT_ADDRESS dengan smart contract token yg mau dikirim
```

```bash
  isi KEY_OWNER & KEY_KORBAN dengan private key
```

```bash
  {
    signer: korban,
    transaction: {
      chainId: 5,
      type: 2,
      to: CONTRACT_ADDRESS,
      gasLimit: 150000,
      maxFeePerGas: utils.parseUnits(maxFee, 'gwei'),
      maxPriorityFeePerGas: utils.parseUnits(maxPriority, 'gwei'),
      data: iface.encodeFunctionData('transfer', [
        owner.address, //kiriw ke alamat owner yg aman
        utils.parseEther('5') <== total token yg ingin dikirim dari wallet korban silahkan ganti sesuai kebutuhan
      ])
    }
```

```bash
  ts-node kirimTOKEN.ts
```

## Note

ini hanya tutorial singkat, lengkap nya bisa cek di dalam script nya sudah sy kasih komentar arahan.

kalau masih bingung, dm saya aja di fb atau kirim di sini dibagian issue
