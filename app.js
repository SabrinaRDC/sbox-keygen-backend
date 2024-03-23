import chalk from 'chalk';
import http from 'http';
import mysql from 'mysql';
const dbConfig = {
    host: '10.175.1.3',
    port: 3306,
    user: 'sbox-keygen',
    password: '',
    database: 'sbox-keygen'
};
const IPToken = '';
const listenIP = '';
const listenPort = 8001;
// const wait = 1000;
const wait = 5000 + Math.floor(Math.random() * 5000)

const db = mysql.createConnection(dbConfig);

function tryKeyGen() {
    if (Math.random() < 0.75) {
        return 'Connection to server failed! please try again or refresh page.'
    } else {
        return crypto.randomUUID().toUpperCase()
    }
};

function query(SQLquery, data){
    return new Promise((resolve, reject) => {
        db.query(SQLquery, data, (err, response) => {
            if (err) reject(err);
            resolve(response);
        })
    });
}

function delayedResEnd(res, ip, endValue, callback) {
    setTimeout(async () => {
        await query('UPDATE `sbox-keygen`.ips SET connected = 0 WHERE ip = ?', [ip]);
        callback();
        res.end(endValue);
    }, wait)
}

async function getIPInfo(ip, token){
    let response = await fetch(`https://api.ip2location.io/?key=${token}&ip=${ip}`)
   return await response.json();
}

const server = http.createServer( async (req, res) => {
    const ip = req.headers['x-forwarded-for'].slice(req.headers['x-forwarded-for'].length/2+1);
    // const ip = req.socket.remoteAddress;
    const ipsDataQuery = 'SELECT ip, times_tried, name, fetches_left, can_get_unused_keys, banned, bigoted, connected, is_proxy, ban_reason FROM `sbox-keygen`.ips WHERE ip = ?;';
    const disallowedCharaters = new RegExp('[^\x00-\x7F]+');
    let enteredName = req.url.slice(1);
    let ipsData;
    let unusedKeyData;
    let usedKeysData;
    let ipInfo;
    //Drop favicon requests
    if (req.url === '/favicon.ico') {
        return res.end();
    };
    console.log(ip, req.method, decodeURI(req.url));
    res.setHeader('Content-Type', 'Text');
    res.setHeader('Access-Control-Allow-Origin', '*');
    ipsData = await query(ipsDataQuery, [ip])
    unusedKeyData = await query('SELECT id, `key`, times_fetched FROM `sbox-keygen`.keys WHERE status = ?', ['unused']);
    usedKeysData = await query('SELECT id, `key`, times_fetched FROM `sbox-keygen`.keys WHERE status = ?', ['used']);
    // Check for valid name

    // Check for existing connection
    if (ipsData[0] && ipsData[0].connected === 1) {
        console.log(chalk.red(`Duplicated connection from ${ip} dropped.`));
        return res.end('Server connection Dropped by DDoS protection.');
    };
    // Set ip to connected
    await query('UPDATE `sbox-keygen`.ips SET connected = 1 WHERE ip = ?', [ip]);
    // Check for existing record
    if (!ipsData[0]) {
        console.log(chalk.red('No record found for', ip));
        ipInfo = await getIPInfo(ip, IPToken);
        await query('INSERT INTO ips (ip, is_proxy, country_code, country_name, region_name, city_name) VALUES (?, ?, ?, ?, ?, ?);',[ip, ipInfo.is_proxy, ipInfo.country_code, ipInfo.country_name, ipInfo.region_name, ipInfo.city_name]);
    } else { 
        console.log(`Record found for ${ip}. Name: ${ipsData[0].name}. Tried ${ipsData[0].times_tried} times. Fetches: ${ipsData[0].fetches_left}.`);
        console.log(`Can_get_key: ${Boolean(ipsData[0].can_get_unused_keys)}. Banned: ${Boolean(ipsData[0].banned)}. Bigoted: ${Boolean(ipsData[0].bigoted)}. Is_proxy: ${Boolean(ipsData[0].is_proxy)}.`);
    };
    ipsData = await query(ipsDataQuery, [ip]);
    // Check for existing proxy record
    if (ipsData[0].is_proxy == null) {
        console.log(`Found ip with NULL is_proxy! ${ip}(${ipsData[0].name})`);
        ipInfo = await getIPInfo(ip, IPToken);
        await query('UPDATE `sbox-keygen`.ips SET is_proxy = ?, country_code = ?, country_name = ?, region_name = ?, city_name = ? WHERE ip = ?;', [ipInfo.is_proxy, ipInfo.country_code, ipInfo.country_name, ipInfo.region_name, ipInfo.city_name, ip]);
    };
    // Check for undefined is_proxy on ipInfo
    if (!ipInfo) {
        ipInfo = {
            is_proxy: ipsData[0].is_proxy,
        };
    };
    // Check for proxy
    if (Boolean(ipsData[0].is_proxy) === true || ipInfo.is_proxy === true) {
        // Store name if name is not blank and is valid and is within 100 characters long
        if (enteredName !== '' && !disallowedCharaters.test(decodeURI(enteredName)) && enteredName.length <= 100) {
            await query('UPDATE `sbox-keygen`.ips SET name = ? WHERE ip = ?;', [enteredName, ip]);
        };
        // Check for invalid name
        if (disallowedCharaters.test(decodeURI(enteredName))) {
            let badNameMessage = 'Error: Invalid name!';
            return delayedResEnd(res, ip, badNameMessage, () => { console.log(chalk.red(`Message: ${badNameMessage} sent to ${ip}(${ipsData[0].name}).`))});
        };
        // Check for invalid name length
        if (enteredName.length > 100) {
            let badNameLengthMessage = 'Error: username cannot be longer than 100 characters!';
            return delayedResEnd(res, ip, badNameLengthMessage, () => { console.log(chalk.red(`Message: ${badNameLengthMessage} sent to ${ip}(${ipsData[0].name}).`))});
        };
        let proxyMessage = 'Suspicious IP detected! Connection refused!';
        return delayedResEnd(res, ip, proxyMessage, () => { console.log(chalk.red(`Message: ${proxyMessage} sent to ${ip}(${ipsData[0].name}).`))});
    }
    // Check for bigoted flag
    if (Boolean(ipsData[0].bigoted) === true) {
        console.log(chalk.red(`Bigot found! ${ip}(${ipsData[0].name})`));
        if (Boolean(ipsData[0].can_get_unused_keys) === true) {
            await query('UPDATE `sbox-keygen`.ips SET can_get_unused_keys = false WHERE ip = ?;', [ip]);
            console.log(`No keys for bigots! Updated can_get_unused_keys for ${ip}(${ipsData[0].name})`);
        };
        if ( Math.random() < 0.8) {
            const random = tryKeyGen();
            return delayedResEnd(res, ip, random, () => { console.log(chalk.yellow(`Fake key/Error: ${random} sent to ${ip}(${ipsData[0].name}).`))});
        } else {
            let usedKey = usedKeysData[ Math.floor(Math.random() * usedKeysData.length)];
            await query('UPDATE `sbox-keygen`.keys SET times_fetched = ? WHERE id = ?', [usedKey.times_fetched + 1, usedKey.id]);
            return delayedResEnd(res, ip, usedKey.key, () => { console.log(chalk.cyan(`Used key: ${usedKey.key} sent to ${ip}(${ipsData[0].name}).`))});
        }
    };
    // Increment tries counter of ip
    await query('UPDATE `sbox-keygen`.ips SET times_tried = ? WHERE ip = ?;', [ipsData[0].times_tried + 1, ip]);
    // Set name to input if not blank and is valid and is within 100 characters long
    if (enteredName !== '' && !disallowedCharaters.test(decodeURI(enteredName)) && enteredName.length <= 100) {
        await query('UPDATE `sbox-keygen`.ips SET name = ? WHERE ip = ?;', [enteredName, ip]);
    };
    // Check for invalid name
    if (disallowedCharaters.test(decodeURI(enteredName))) {
        let badNameMessage = 'Error: Invalid name!';
        return delayedResEnd(res, ip, badNameMessage, () => { console.log(chalk.red(`Message: ${badNameMessage} sent to ${ip}(${ipsData[0].name}).`))});
    };
    // Check for invalid name length
    if (enteredName.length > 100) {
        let badNameLengthMessage = 'Error: username cannot be longer than 100 characters!';
        return delayedResEnd(res, ip, badNameLengthMessage, () => { console.log(chalk.red(`Message: ${badNameLengthMessage} sent to ${ip}(${ipsData[0].name}).`))});
    };
    // Check for banned flag on ip
    if (ipsData[0] && ipsData[0].banned >= 1) {
        let banMessage = `Error: This IP has been banned from s&box server. Reason: ${ipsData[0].ban_reason}`;
        // return delayedResEnd(`Error: This IP has been banned from s&box server. Reason: ${ipsData[0].ban_reason}`, res, ip, ipsData[0].name, 'Ban message:');
        return delayedResEnd(res, ip, banMessage, () => { console.log(chalk.white.bgRed(`Ban message: "${banMessage}" sent to ${ip}(${ipsData[0].name}).`))})
    };
    // Respond with random unused real key if ip does not have banned flag and has >0 real key fetches
    if (ipsData[0] && ipsData[0].banned <= 0 && ipsData[0].fetches_left > 0 && ipsData[0].can_get_unused_keys >= 1) {
        let unusedKey = unusedKeyData[ Math.floor(Math.random() * unusedKeyData.length)];
        await query('UPDATE `sbox-keygen`.keys SET times_fetched = ? WHERE id = ?', [unusedKey.times_fetched + 1, unusedKey.id]);
        await query('UPDATE `sbox-keygen`.ips SET fetches_left = ? WHERE ip = ?;', [ipsData[0].fetches_left - 1, ip]);
        console.log(chalk.white.bgGreen(`${ip}(${ipsData[0].name}) Has received a real key using a fetch chance!`));
        // return delayedResEnd(unusedKey.key, res, ip, ipsData[0].name, 'Unused key:');
        return delayedResEnd(res, ip, unusedKey.key, () => { console.log(chalk.white.bgGreen(`Unused key(fetch_times): ${unusedKey.key} sent to ${ip}(${ipsData[0].name}).`))})
    };
    // Respond with random unused real unused key at a low chance if ip does not have banned flag
    if (ipsData[0] && ipsData[0].banned <= 0 &&  Math.random() < 0.001 && ipsData[0].can_get_unused_keys >= 1) {
        let unusedKey = unusedKeyData[ Math.floor(Math.random() * unusedKeyData.length)];
        await query('UPDATE `sbox-keygen`.keys SET times_fetched = ? WHERE id = ?', [unusedKey.times_fetched + 1, unusedKey.id]);
        await query('UPDATE `sbox-keygen`.ips SET fetches_left = ? WHERE ip = ?;', [ipsData[0].can_get_unused_keys - 1, ip]);
        console.log(chalk.white.bgGreen(`${ip}(${ipsData[0].name}) Has received a real key by chance!`));
        return delayedResEnd(res, ip, unusedKey.key, () => { console.log(chalk.white.bgGreen(`Unused key(Random): ${unusedKey.key} sent to ${ip}(${ipsData[0].name}).`))});
    };
    // Default response
    if ( Math.random() < 0.8) {
        const random = tryKeyGen();
        delayedResEnd(res, ip, random, () => { console.log(chalk.yellow(`Fake key/Error: ${random} sent to ${ip}(${ipsData[0].name}).`))});
    } else {
        let usedKey = usedKeysData[ Math.floor(Math.random() * usedKeysData.length)];
        await query('UPDATE `sbox-keygen`.keys SET times_fetched = ? WHERE id = ?', [usedKey.times_fetched + 1, usedKey.id]);
        delayedResEnd(res, ip, usedKey.key, () => { console.log(chalk.cyan(`Used key: ${usedKey.key} sent to ${ip}(${ipsData[0].name}).`))});
    }
});

server.listen(listenPort, listenIP, () => {console.log(`Listening on ${listenIP}:${listenPort}`)})
