Copy the `default/config.default.json` file to `config.json` then overview each options and change any to match your preferred setup.

### Global Options

| Parameter | Details |
| --------- | ------- |
| coin | Used for storage in redis so multiple coins can share the same redis instance. |
| symbol | Used for front-end display. |
| coinUnits | Minimum units in a single coin, see COIN constant in DAEMON_CODE/src/cryptonote_config.h |
| coinDecimalPlaces | Number of coin decimals places for notifications and front-end. |
| coinDifficultyTarget | Coin network time to mine one block, see DIFFICULTY_TARGET constant in DAEMON_CODE/src/cryptonote_config.h |

### Logging Options

| Parameter | Details |
| --------- | ------- |
| logging.files.enabled | To enable file logging |
| logging.files.level | Specifies the level of log output verbosity. This level and anything more severe will be logged. Options are: info, warn, or error. |
| logging.files.directory | Directory where to write log files. |
| logging.files.flushInterval | How often (in seconds) to append/flush data to the log files. |
| logging.console.level | Specifies the level of log output verbosity. This level and anything more severe will be logged. Options are: info, warn, or error. |
| logging.console.colors | Gives console output useful colors. If you direct that output to a log file then disable this feature to avoid nasty characters in the file. |

### Pool Server

| Parameter | Details |
| --------- | ------- |
| poolServer.enabled | Enable the pool server module. |
| poolServer.clusterForks | Set to "auto" by default which will spawn one process/fork/worker for each CPU core in your system. Each of these workers will run a separate instance of your pool(s), and the kernel will load balance miners using these forks. Optionally, the 'forks' field can be a number for how many forks will be spawned. |
| poolServer.address | Wallet address where block rewards go, and miner payments come from. |
| poolServer.blockRefreshInterval | Poll RPC daemons for new blocks every this many milliseconds. |
| poolServer.minerTimeout | How many seconds until we consider a miner disconnected. |
| poolServer.ssl.cert | The SSL certificate for SSL-enabled ports. |
| poolServer.ssl.key | The SSL private key for SSL-enabled ports. |
| poolServer.ssl.ca | The SSL certificate authority chain for SSL-enabled ports. |
| poolServer.ports | The pool server mining ports. |

For each mining ports you can set the following parameters:

| Parameter | Details |
| --------- | ------- |
| port | Port for mining apps to connect to. |
| difficulty | The initial difficulty miners are set to for this port. |
| desc | The description of the port. |
| ssl | Enable or Disable SSL on this port. |
| hidden | Define if its an hidden port. |

### Variable difficulty
Variable difficulty is a feature that will automatically adjust difficulty for individual miners based on their hashrate in order to lower networking and CPU overhead.

| Parameter | Details |
| --------- | ------- |
| varDiff.minDiff | Minimum difficulty. |
| varDiff.maxDiff | Maximum difficulty. |
| varDiff.targetTime | Try to get 1 share per this many seconds. |
| varDiff.retargetTime | Check to see if we should retarget every this many seconds. |
| varDiff.variancePercent | Allow time to vary this % from target without retargeting. |
| varDiff.maxJump | Limit diff percent increase/decrease in a single retargeting. |

### Fixed difficulty

| Parameter | Details |
| --------- | ------- |
| fixedDiff.enabled| Enable fixed difficulty. |
| fixedDiff.separator | Character separator between _address_ and _difficulty_. |

### Share trust
Feature to trust share difficulties from miners which can significantly reduce CPU load.
	
| Parameter | Details |
| --------- | ------- |
| shareTrust.enabled | Enable share trust. |
| shareTrust.min | Minimum percent probability for share hashing. |
| shareTrust.stepDown | Increase trust probability % this much with each valid share. |
| shareTrust.threshold | Amount of valid shares required before trusting begins. |
| shareTrust.penalty | Upon breaking trust require this many valid share before trusting. |

### Banning
If under low-diff share attack we can ban their IP to reduce system/network load.

| Parameter | Details |
| --------- | ------- |
| banning.enabled | Enable banning. |
| banning.time | How many seconds to ban worker for. |
| banning.invalidPercent | What percent of invalid shares triggers ban |
| banning.checkThreshold | Perform check when this many shares have been submitted. |

### Slush Mining system  
Slush Mining is a reward calculation technique which disincentivizes pool hopping and rewards 'loyal' miners by valuing younger shares higher than older shares. Remember adjusting the weight! More about it here: https://mining.bitcoin.cz/help/#!/manual/rewards

| Parameter | Details |
| --------- | ------- |
| slushMining.enabled | Enable slush mining. Recommended for pools catering to professional miners. |
| slushMining.weight | Defines how fast the score assigned to a share declines in time. The value should roughly be equivalent to the average round duration in seconds divided by 8. When deviating by too much numbers may get too high for JS. |
| slushMining.blockTime | |
| slushMining.lastBlockCheckRate | How often the pool checks the timestamp of the last block. Lower numbers increase load but raise precision of the share value. |

### Payments module
Module that sends payments to miners according to their submitted shares.

| Parameter | Details |
| --------- | ------- |
| payments.enabled | Enable the payments module. |
| payments.interval | How often to run in seconds. |
| payments.maxAddresses | Split up payments if sending to more than this many addresses. |
| payments.mixin | Number of transactions yours is indistinguishable from. |
| payments.priority | The transaction priority. |
| payments.transferFee | Fee to pay for each transaction. |
| payments.dynamicTransferFee | Enable dynamic transfer fee (fee is multiplied by number of miners). |
| payments.minerPayFee | Miner pays the transfer fee instead of pool owner when using dynamic transfer fee. |
| payments.minPayment | Miner balance required before sending payment. |
| payments.maxTransactionAmount | Split transactions by this amount (to prevent "too big transaction" error). |
| payments.denomination | Truncate to this precision and store remainder. |

### Blocks Unlocker module
Module that monitors the submitted block maturities and manages rounds. Confirmed blocks mark the end of a round where workers' balances are increased in proportion to their shares.

| Parameter | Details |
| --------- | ------- |
| blockUnlocker.enabled | Enable the block unlocker module. |
| blockUnlocker.interval | How often to check block statuses in seconds |
| blockUnlocker.depth | Block depth required for a block to unlocked/mature. Found in daemon source as the variable CRYPTONOTE_MINED_MONEY_UNLOCK_WINDOW. |
| blockUnlocker.poolFee | The pool fee. |
| blockUnlocker.devDonation | The developper donation. Thanks for supporting me! |
| blockUnlocker.networkFee | The network/Governance fee (used by some coins like Loki). |
| blockUnlocker.fixBlockHeightRPC | Some forknote coins have an issue with block height in RPC request, to fix you can enable this option. See: https://github.com/forknote/forknote-pool/issues/48 |

### Payment ID

| Parameter | Details |
| --------- | ------- |
| paymentId.separator | Character separator between _address_ and _paymentID_. |

### Application Programming Interface (API)
AJAX API used for front-end website

| Parameter | Details |
| --------- | ------- |
| api.enabled | Enable the pool API. |
| api.hashrateWindow | How many second worth of shares used to estimate hash rate. |
| api.updateInterval | Gather stats and broadcast every this many seconds. |
| api.bindIp | Bind API to a specific IP (set to 0.0.0.0 for all). |
| api.port | The API port. |
| api.blocks | Amount of blocks to send at a time. |
| api.payments | Amount of payments to send at a time. |
| api.password | Password required for admin statistics. |
| api.ssl.enabled | Enable SSL API.|
| api.ssl.port | The SSL API port. |
| api.ssl.cert | The SSL certificate |
| api.ssl.key | The SSL private key. |
| api.ssl.ca | The SSL certificate authority chain. |
| api.trustProxyIP | Proxy X-Forwarded-For support. |

### Coin daemon

| Parameter | Details |
| --------- | ------- |
| daemon.host | The coin daemon RPC host. |
| daemon.port | The coin daemon RPC port. |

### Wallet daemon

| Parameter | Details |
| --------- | ------- |
| wallet.host | The wallet daemon (simple wallet) RPC host. |
| wallet.port | The wallet daemon (simple wallet) RPC port. |

### Redis database

| Parameter | Details |
| --------- | ------- |
| redis.host | The redis database host. |
| redis.port | The redis database port. |
| redis.auth | If set, client will run redis auth command on connect. Use for remote db. |
| redis.db | Set the redis database to use (default to 0). |
| redis.cleanupInterval | Set the redis database cleanup interval (in days). |

### RPC services monitoring
Monitor the RPC services. Statistics will be displayed in Admin panel.

| Parameters group | Details |
| ---------------- | ------- |
| monitoring.daemon | The coin daemon monitoring. |
| monitoring.wallet | The wallet daemon monitoring. |

For each parameters group you can set the following parameters:

| Parameter | Details |
| --------- | ------- |
| checkInterval | Interval of sending rpcMethod request. |
| rpcMethod | The RPC method name. |

### Market prices
Prices settings for market and price charts.

| Parameter | Details |
| --------- | ------- |
| prices.source | Prices source (exchange). Supported values: cryptonator, altex, crex24, cryptopia, stocks.exchange, tradeogre |
| prices.currency | The prices currency. |
	    
### Charts data collectors
Collect pool statistics to display in frontend charts.

| Parameters group | Details |
| ---------------- | ------- |
| charts.pool.hashrate | The pool hashrate chart. |
| charts.pool.miners | The pool miners chart. |
| charts.pool.workers | The pool workers chart. |
| charts.pool.difficulty | The network difficulty chart. |
| charts.pool.price | The market price chart. |
| charts.pool.profit | The market profit chart. |
| charts.user.hashrate | The miner hashrate chart. |
| charts.user.payments | The miner payments chart. |

For each parameters group you can set the following parameters:

| Parameter | Details |
| --------- | ------- |
| enabled | Enable data collection and chart displaying in frontend. |
| updateInterval | How often to get current value. |
| stepInterval | Chart step interval calculated as average of all updated values. |
| maximumPeriod | Chart maximum periods (chart points number = maximumPeriod / stepInterval = 48). |

### Front-End settings

Edit the variables in the `website/config.js` file to use your pool's specific configuration.

| Variable Name | Details |
| ------------- | ------- |
| api | Must point to the API setup in your config.json file. |
| poolHost | Pool server host to instruct your miners to point to. |
| email | Contact email address for support. |
| telegram | The pool Telegram URL. |
| discord | The pool Discord URL. |
| marketCurrencies | The market currencies. |
| blockchainExplorer | The URL to get details for a block hash. |
| transactionExplorer | The URL to get details for a transaction hash. |
| themeCss | Any custom CSS theme for pool frontend. |
| defaultLang | The default pool interface language. |
