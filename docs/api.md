# API

__Underlined__ arguments are **required**.

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

* __`time`__: UNIX Timestamp

#### `/get_blocks`

Returns all blocks found by the pool before `height`

Arguments:

* __`height`__: Block height

#### `/get_market`

Returns the market data

Arguments:

* __`tickers[]`__: Tickers (can be used multiple times in the request)

#### `/get_top10miners`

Returns the top 10 miners

### Miner settings

#### `/get_miner_payout_level`

Returns the miner payout level

Arguments:

* __`address`__: Wallet address

#### `/set_miner_payout_level`

Sets the minimum payout for a miner

Arguments:

* __`address`__: Wallet address
* __`ip`__: IP of the miner
* __`level`__: Payout level to be set

#### `/get_miner_email_notifications`

Returns the email of the miner

Arguments:

* __`address`__: Wallet address

#### `/set_miner_email_notifications`

Sets the minimum payout for a miner

Arguments:

* __`address`__: Wallet address
* __`ip`__: IP of the miner
* __`level`__: Payout level to be set

#### `/get_telegram_notifications`

Returns the telegram username of the miner

#### `/set_telegram_notifications`

Sets the minimum payout for a miner

Arguments:

* __`address`__: Wallet address
* __`ip`__: IP of the miner
* __`level`__: Payout level to be set

### Miners/workers hashrate (for charts)

#### `/miners_hashrate`

Returns the hashrate, sorted by miners

Arguments:

* __`password`__: Admin password

#### `/workers_hashrate`

Returns the hashrate, sorted by workers

Arguments:

* __`password`__: Admin password

### Pool administration

#### `/admin_stats`

Returns the entire stats of the pool

Arguments:

* __`password`__: Admin password

#### `/admin_monitoring`

Returns the monitoring of the pool

Arguments:

* __`password`__: Admin password

#### `/admin_log`

Returns the log of the pool

Arguments:

* __`password`__: Admin password
* __`file`__: The file

#### `/admin_users`

Returns the users of the pool

Arguments:

* __`password`__: Admin password

#### `/admin_ports`

Returns the ports of the pool with the connected workers

Arguments:

* __`password`__: Admin password

#### `/test_email_notification`

Sends an email notification

Arguments:

* __`password`__: Admin password

#### `/test_telegram_notification`

Sends an telegram notification

Arguments:

* __`password`__: Admin password
