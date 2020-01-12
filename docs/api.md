# API

_Italic_ arguments are **required**.

## Endpoints

### Stats of pools and miners

#### `/stats`

Returns the config, stats of the pool and chart data

#### `/live_stats`

Returns the same as `/stats`

#### `/stats_address`

Returns the stats for the address, payments, chart data and all workers for that address

#### `/get_payments`

Returns all payments before `time`

Arguments:

* _`time`_: UNIX Timestamp

#### `/get_blocks`

Returns all blocks found by the pool before `height`

Arguments:

* _`height`_: Block height

#### `/get_market`

Returns the market data

Arguments:

* _`tickers[]`_: Tickers (can be used multiple times in the request)

#### `/get_top10miners`

Returns the top 10 miners

### Miner settings

#### `/get_miner_payout_level`

Returns the miner payout level

Arguments:

* _`address`_: Wallet address

#### `/set_miner_payout_level`

Sets the minimum payout for a miner

Arguments:

* _`address`_: Wallet address
* _`ip`_: IP of the miner
* _`level`_: Payout level to be set

#### `/get_miner_email_notifications`

Returns the email of the miner

Arguments:

* _`address`_: Wallet address

#### `/set_miner_email_notifications`

Sets the minimum payout for a miner

Arguments:

* _`address`_: Wallet address
* _`ip`_: IPof the miner
* _`level`_: Payout level to be set

#### `/get_telegram_notifications`

Returns the telegram username of the miner

#### `/set_telegram_notifications`

Sets the minimum payout for a miner

Arguments:

* _`address`_: Wallet address
* _`ip`_: IP of the miner
* _`level`_: Payout level to be set

### Miners/workers hashrate (for charts)

#### `/miners_hashrate`

Returns the hashrate, sorted by miners

Arguments:

* _`password`_: Admin password

#### `/workers_hashrate`

Returns the hashrate, sorted by workers

Arguments:

* _`password`_: Admin password

### Pool administration

#### `/admin_stats`

Returns the entire stats of the pool

Arguments:

* _`password`_: Admin password

#### `/admin_monitoring`

Returns the monitoring of the pool

Arguments:

* _`password`_: Admin password

#### `/admin_log`

Returns the log of the pool

Arguments:

* _`password`_: Admin password
* _`file`_: The file

#### `/admin_users`

Returns the users of the pool

Arguments:

* _`password`_: Admin password

#### `/admin_ports`

Returns the ports of the pool with the connected workers

Arguments:

* _`password`_: Admin password

#### `/test_email_notification`

Sends an email notification

Arguments:

* _`password`_: Admin password

#### `/test_telegram_notification`

Sends an telegram notification

Arguments:

* _`password`_: Admin password
