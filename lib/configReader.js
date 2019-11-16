/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Configuration Reader
 **/

// Load required modules
let fs = require('fs');

// Set pool software version
global.version = "v2.0.0";

/**
 * Load pool configuration
 **/
 
// Get configuration file path
let configFile = (function(){
    for (let i = 0; i < process.argv.length; i++){
        if (process.argv[i].indexOf('-config=') === 0)
            return process.argv[i].split('=')[1];
    }
    return 'config.json';
})();

// Read configuration file data
try {
    global.config = JSON.parse(fs.readFileSync(configFile));
}
catch(e){
    console.error('Failed to read config file ' + configFile + '\n\n' + e);
    return;
}

/**
 * Developper donation addresses -- thanks for supporting my works!
 **/
 
let donationAddresses = {
    BTC: '34GDVuVbuxyYdR8bPZ7g6r12AhPPCrNfXt',
    BCH: 'qpl0gr8u3yu7z4nzep955fqy3w8m6w769sec08u3dp',
    ETH: '0xd4d9a4f22475039f115824b15999a5a8143d424c',
    LTC: 'LW169WygGDMBN1PGSr8kNbrFBx94emGWfB',
    DERO: 'dERirD3WyQi4udWH7478H66Ryqn3syEU8bywCQEu3k5ULohQRcz4uoXP12NjmN4STmEDbpHZWqa7bPRiHNFPFgTBPmcBmB4yyCF8mZmNUanDb',
    GRFT: 'GMPHYf5KRkcAyik7Jw9oHRfJtUdw2Kj5f4VTFJ25AaFVYxofetir8Cnh7S76Q854oMXzwaguL8p5KEz1tm3rn1SA6r6p9dMjuV81yqXCgi',
    LTHN: 'NaWe5B5NqvZ3TV2Mj1pxYtTgrnTBwQDMDNtqVzMR6Xa5ejxu6hbi6KULHTqd732ebc5qTHvKXonokghUBd3pjLa8czn8PNg57mR2XqEcvr7w',
    MSR: '5t5mEm254JNJ9HqRjY9vCiTE8aZALHX3v8TqhyQ3TTF9VHKZQXkRYjPDweT9kK4rJw7dDLtZXGjav2z9y24vXCdRc3DY4daikoNTeK1v4e',
    XMR: '4Cf2TfMKhCgJ2vsM3HeBUnYe52tXrvv8X1ajjuQEMUQ8iU8kvUzCSsCEacxFhEmeb2JgPpQ5chdyw3UiTfUgapJBhHdmH87gYyoDR6NMZj',
    SUMO: 'SumipDETyjLYi8rqkmyE9c4SftzYzWPCGA3XvcXbGuBYcqDQJWe8wp8NEwNicFyzZgKTSjCjnpuXTitwn6VdBcFZEFXLcUYThVkF1dR9Q1uxEa',
    XHV: 'hvi1aCqoAZF19J8pijvqnrUkeAeP8Rvr4XyfDMGJcarhbL15KgYKM1hN7kiHMu3fer5k8JJ8YRLKCahDKFgLFgJMYAfngJjDmkZAVuiRP15qv',
    XTL: 'SEiStP7SMy1bvjkWc9dd1t2v1Et5q2DrmaqLqFTQQ9H7JKdZuATcPHUbUL3bRjxzxTDYitHsAPqF8EeCLw3bW8ARe8rYRNQQwys1JcJAs3qSH',
    BLOC: 'abLoc7JNzYXijnKnPf7tSFUNSWBuwKrmUPMevvPkH4jc3b1K9LmS76DKpPamgQ5AYAC2CW9dJfTJ91AnXHYDNXAKRqPx5ZrtR49+9ea139b03f8ec0fce656096ad336a3c7b7041210b56386808dfbe4d1be8186c8',
    AEON: 'WzWP347dSczJVmPpw65AsAGi5WhT85z5n66D8vcT3RcxRBBj4tFiDcd2CVFcQ1bBpjNQD5Z5kbXrLjVidvoKFaFK6uj4vyX3yrB1ap6jvPzB',
    COAL: 'CoFbPDzEmLDHntwuC4WHkw3hQ4cX7g2JdVSGzqndAcDca4XgKyR4Wca7tkJw56eVX12iAQNGRzNPNXsegXmoJvUDSmkUKhL+3f128d248560b076805004a589de88bf6546bc9a0e0011dd56d6040d99b5d622',
    XVG: 'DKSE7UW9Pwssq2ZF7rMvQVBG2EDio1GZHP',
    BCN: '24WXh1qTEZzgDG3Ly1MtCJX7fRbDNqbzC4iEzpQBVhLwZ9jBeSs7GFQgu1bYxpHFKyjBQvABXicZ2MJ7si6rVBcQKQBCgLj+f122a0901996579ca5e8a7b5bdfb958a8e8d9fde470faeb7794315c3473b9aaa',
    TRTL: 'TRTLv1Hqo3wHdqLRXuCyX3MwvzKyxzwXeBtycnkDy8ceFp4E23bm3P467xLEbUusH6Q1mqQUBiYwJ2yULJbvr5nKe8kcyc4uyps+0f2404e298d6e6c132b300713bcd723d7fa61dd1206ee4b5975c254c67783686',
    KRB: 'KdAXXrRCGcENDhuRqEkocjZ5tpPfu17U35mqhgDEJTjTFBfs4hxhiBKK95XEpAuY8V9nomNcMeTz1E6tehWEvU6h8vCBs51+b7480fabf430e71b4702fbcf35e2454acba69be935e289fa84c485c2f07f5e63',
    CIV: 'CM2ieMxxePe5z1BUkeNm9p5pmpn3k4juX1',
    DASH: 'XhVA4JaYjtqvuSLSNFgxYUQKJaJnRhi1ww',
    NAH: 'SWNNDA4wUvTkFVYvvhDP24yiCrR2p7SZbt',
    PCN: 'P9GzJEnyYRgA6GHfdwtr7FhYq3s365ASKS',
    LUX: 'LgozXD5vaHT3BDkNVRLWCBaNvSBmJxn5NT',
    TUBE: 'bi1b95WYJRES7oBrvRo2eQV53ExLzFAzjKVM4wp9H9B6irCR6UuQxHf183XsJwemdoQm5PUHhQVwS67Hf5yUE7qg4SwbJJfAjLE1PH6T9V667',
    DOGE: 'DM6FYmmLw4R5uFaSNdtYMrBLYuy1ank39R',
    NBR: 'NDysWekoQnxeUquciujUQFPvVXTaU2D23eLbbboNFavCDozx2157EB3KzyKxk3mdyJRU1YfarvN35EfkGFbNEAQ4KHbkwy2+643750a2037d089470b8889d3a13edf673fdb0738e9c9bc4812ce41ded0644a7',
    XUN: 'Xun3jQ4dLmfdRCnBuavjukJRm8EMntWqhL27JKJqeEf73rwi8nRoMYaMusv8pD9s5Y7oK8aHYCieB9rcNJ4uDfzZ8HUmzRq8yQ+cb22ae07df149caf85050ff14fd8b82d18fd0d62601a714b969855461046111b',
    WAE: 'KfDMEcEpi7HANXK5N6vgAorWDLNqFfLnMk',
    IRD: 'ir2btddJ78sicpKntYo3oRMLQh91VktzBfZzWbhwZnQxS815QLiG5WCAH9sgVGC5uwLZuMJCwW5CdFigNbJ3WTxU2CG5GnUDe+fe88be6c5a157ab1c97242ec0c6be699f48c604f752def45259097d20405a035',
    D: 'DSHxGR1RFja4dwoqG2VXvFoSK5uS35pBWA',
    PLURA: 'Pv8xzGjaY4TBPQUc8mLqcPGXCpWJbAYAjZ1uwZJK9Cfg1qvQBx3zZHqGF4XWnZHeYDKfkQVA8yDSjVdE56nz2Jab2Xu16PGb1+bda64dd03e45d67fd6fa4b99d91b507c02230bfe21cf2e862e436f18143d547a',
    BTCP: 'b1B64ofQxHBPYXPYJvkuM9z1nexV8NSXtj6',
    PIVX: 'DAE6oWhR1TwD8vFSxQHGaTMwyymHcCsmDH',
    BSM: 'Sm4gdR5meAJAets9DwXCtq9tRZofxg6uubw6rYPKqYi7EN1MKADYG6obJczbjCmwfS752ThxYHUr3gBqY8KDWrB91dPcCbhJe',
    OMB: 'casiLpKfELY6hyxUqS1zYjjAMTSWrcUm5Cpc1bSdwNyCEmP2ii8EfVWLvvjysm2YXBXM2vGvpkGUs42RD1ihi9uDATCr5crEjvw8AfnGHwkaw',
    LOKI: 'LK8CGQ17G9R3ys3Xf33wCeViD2B95jgdpjAhcRsjuheJ784dumXn7g3RPAzedWpFq364jJKYL9dkQ8mY66sZG9BiCvqjvv6LgsyHf6H2gy',
    BKC: 'bkc1o8uPqS7YD6Eo4yoaGp9N2MgbUrU7pUChtFFXS3K6fWF5hT9SrP2dGJfsTnn6pWZtQckuPYUSbJy5qv2MnLGo8eFS3t6qJw+29c6c1a056b3bc2598d0d57ab396c2d9c0053642dd9b8cbb7cb5bd63742f1eea',
    SOLACE: 'Siz7GSHywyu3RxHDAcuW9iBKVLfgjjftDj5p9AucrNb9YV1jkPZNBdjDiWxcjMZK94Kdo97BzMuSZAU87U7UCzUL4JeRiP2zFz87AgfgBiFUW',
    RTO: 'ALJj1xFnU8854yRhkrQKLyKeZYUxTt1oFQ4nEpbNsJoneXMBHyCgCJCW9xq2QZLVnbB4hBwxbEopSdWEmiyXXFiC66VQvaF+b40b160bf2f6efda8e56213c5907e960518633c8152f79c4645dbfda637c5122',
    ITA: 'iz4FdJrFNkGNEmLSJAA39bT4cuQBVAgQTa818Gqshzg32PadREJSuWWEHFunmdfS8rjHGSHTxZoja5nWSZ8zWwiW51F2SAPWRN42mdXBvWe6',
    INTU: 'intuvSUykQhFXJj22j2KJqC5CRMv3AWar467CtzZFVAVBxLUwb8yQi1LF72LzLRHtvAoNGkCYr3EZHYUJmeSqcZCLhxK73jJZDF+e35f3bdc1581764e8d8d778c2acbfd1acb838a2da61553ef637c980765bc3a26',
    WOW: 'So2ifgjqGMZJhCrqpFMotQQAiJAiATuJLNAK2HrPLoNzK8hkqNbf9t8gmx6bzAQrXRMnWnoELoiD6GTv8guPBRwH5yoUvyBK1Ku1YYpQf2x8',
    XMV: '4Cd7rzeiqwQJe8dCZbQeQxeNHUV4P4w7hAJ2g8U2ciiEao2AmqN9tXEfngQaPGV6T2Sx9mEtCaEMzaCR53iQRJqEgha9Dv26d83ML2wMiT',
    XMC: '4H6kZARSRW9WAfxooKC2hkSpNf3RHo7ERBZWFdHN2BiX5BRxoiP5881EEK7P9wdzCZZmUxGWCZNuMjYdKFL1UuqdNUSZQs3uWGhCd4s4Xe',
    WTIP: 'WtiptjGr6oRdZVFqumdfLbVd1XMtCYWKBT6dXppmCWA3TAk4tvesMCsbFLewv4rnmQHKimvwvcsbzC5FgWRrkGmc1DXreHk7sS+b319cf450209a800ea35c7f0d66754d0e243314650fe89ffd5db352733d9b9db',
    BBS: 'fyT3HPm3Qrh87dR64wwLCi855A6bgYdF13mqtSHvX3RB67XEBb8aRrtVGsHa8u9juzByX8Mv6CPDjeuJwHhfqrjA19e7t2Fad+38adf2a9aadf58bf65374a683853ccbc169f75c9a38dc89cecb1beba3788c764',
    XNV: 'NizKdaicW4bVfYB3AVhnsq9qnvUYSKe568YaNV2KQCYCDrNGzpvxqBo6mxF8cBkiQDU5xkgB2PrUGFKf66wVDVoNbQBhu2JRacy6uhsLoUyBJ',
    XRN: 'PiyAfA1u1bNH9XjsPjXc5M64sip7LCj6ziBKEneKPmbVWM6kPMMAQs17h26tnCogW5Q72c5pVGJ4QW3kSKso4MW4h6hQJAVW23z6w2YMYKdHB',
    XTRI: 'TixxgPgBkxgC4JM39WZuacjMLnJqm9YbjPq1YAR4BJbLXiCzf345r9SVbNuKMAG1CcjRMsv7kpatt7gStpUE3gGJRb8cbvWQHfk6L4pEbmdF7',
    RVN: 'RFQvccQyLF3YMhKQby3bKvNXJczhgzEofu',
    ETNXP: 'f4VR74XR616Tw2wAMMfaLV1vmYBSBBbmWXBUtaV8YDb6DHsfKRoYkFaCvhPhsGDDfm1afhzLNuf5XGFmNrvodPoQ6m4qGwXTuNt3gNnTEMYVA',
    ZEL: 't1gsjJAhgGDB45ohJnJkbxtvr8WcUSzahyr',
    RYO: 'SumipDETyjLYi8rqkmyE9c4SftzYzWPCGA3XvcXbGuBYcqDQJWe8wp8NEwNicFyzZgKTSjCjnpuXTitwn6VdBcFZEFXLcSos83oaS9wV7CJdKY',
    INC: 'i9ajAmx77JLPtZL7JEs3ZEVbErmXqvQeGbg7PywpCaRKQGyypTv4TTpDYLMtrdGBGXMJM2mugBf14csz4wmNitZuGdXmy2c4hbG2iiUscAxQ',
    QUAN: 'QRm4DREddkpmmC48CqXqkhV6S75fhtciBo',
    PURK: 'PK2TdygFzH7X9jZPAdjvgQFHBR5bdNmsr6xefs2yQsDRHkKuoAsqQ7hX73nLgjWpiji4GqJMmNx357eu98TpU9Yr2es6SBBtQ+1246e3b3c4fdba89cbcad2113d0dff839d0f1f0a8a6f648b1c292b9bd8a0f8c2',
    ACM: 'PDo5Z3pqN8weHSbfqayJEiSeAkAyr32NB3',
    ARQ: 'aRi1cDd6LkAcc1p6W58dkPi8xSfbZ5EuYFrHxwH3py1MQ9rFrzmSaghguD4GGpCfHSMmKXWJrd4e5CkabC3viWJKfHuDLYqHNGs9D83sj6BPX',
    NCP: 'cczJxhhLKTg7oNGiy1kmFadqTcKDschTb3LUKGvQdhxrVepPo9KjfxjSeqXBUKWVFwcHZRTGLi3k6USWHF1YP82e2TWRse4KD6+70fa2954af5cfc9fd292ce1643e276c8899b769255108c84caf2dcc406ea0678',
    XGS: 'GTqypwunRe5ZkNdmAr26B9mmeMoGwhgoCV',
    SUQA: 'Sic7A6F5r8RkjBvHjRwA9jWhHawXNrFxFX',
    SHB: 'SVSEb9adxGpWckC2KuwuNbD1ved2x7YWTj',
    GPKR: 'GdQ4ewDqJyhMU4BpchEs5uyn8U5VeHii7V',
    ETNX: 'f4VR74XR616Tw2wAMMfaLV1vmYBSBBbmWXBUtaV8YDb6DHsfKRoYkFaCvhPhsGDDfm1afhzLNuf5XGFmNrvodPoQ6m4qTKUkc8Y2dL6d97BZw',
    LMO: 'darkWdeodDHM5YWWGBHKa821DrL3HSzeaBNaVmXTr3svd75GUVcUBbxdSdFqJFUgTWfxfZJJcGTg58rfKct5hedk3Gz9dFLa6U',
    TTNZ: 'Tri1J1prCp9VWj3AyjSTHU5aH1kVt4hsJ9xv7jbMauBzCLcqgKzJB2SATr2aypSFfmBW2dNfDVxMW3sQ4ys147Pz5pRgJvKzVS',
    FHV: 'fh3ddFK3JqWNRZFsiL7xB5bGa79ejPfBNVbSdXVzdKiR7vRXHC3osL51vg9PyHKmxvWgz4ymZeHzcRZNRTJ5kwzM2BtrZMiq7',
    SAFEX: 'Safex5zXVvH6GYJY2tnL4GcJy4W72GRutjhV1aCaRiPhYnfv4CyDjmGfLYQDd4GaJvHEKrpE7r9ux6UMCv5i1PmvjNwxA4r4Roi3K',
    MUTX: 'ZYZZZDAz8vEfwGL3QfuRpMHneGuMbm6uTCtJ4h1kyhYkSi8Yjp62fBQWuHEviGoUdcXmSuYM3mDVa6tR9Rv5zRMra5i1F5UKvSXZc8X7MwHCki',
    BTCN: 'MvweZSjjwTTdwrKJcRL2SzRZm9YrEAthNNeyzGjdbbeujoPsayzLM4efBhLZQoV6GreZTNgHv2gBZ9Hzz7SkTYVN2EgTbqh',
    ARMS: 'gunsGSAGHJweDXBXGwCQrwUqACk67GkZB991b4HHkze8a7bnif8XwPF1NMdoY6oRhm8qjbPu2Jh7F4egLD3mpFTN1oQNydPdNv'
};

global.donations = {};

let percent = config.blockUnlocker.devDonation;
let wallet = donationAddresses[config.symbol];
if (percent && wallet) {
    global.donations[wallet] = percent;
}
