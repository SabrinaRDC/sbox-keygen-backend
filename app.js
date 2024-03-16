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
const listenIP = ''
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

const server = http.createServer( async (req, res) => {
    const ip = req.headers['x-forwarded-for'].slice(req.headers['x-forwarded-for'].length/2+1);
    // const ip = req.socket.remoteAddress;
    let ipsData;
    let unusedKeyData;
    let usedKeysData;
    //Drop favicon requests
    if (req.url === '/favicon.ico') {
        return res.end();
    };
    console.log(ip, req.method, req.url);
    res.setHeader('Content-Type', 'Text');
    res.setHeader('Access-Control-Allow-Origin', '*');
    ipsData = await query('SELECT * FROM `sbox-keygen`.ips WHERE ip = ?;', [ip])
    unusedKeyData = await query('SELECT * FROM `sbox-keygen`.keys WHERE status != ?', ['used']);
    usedKeysData = await query('SELECT * FROM `sbox-keygen`.keys WHERE status = ?', ['used']);
    // Check for existing connection
    if (ipsData[0] && ipsData[0].connected === 1) {
        console.log(chalk.red(`Duplicated connection from ${ip} dropped.`));
        return res.end('Server connection Dropped by DDoS protection.');
    };
    // Set ip to connected
    await query('UPDATE `sbox-keygen`.ips SET connected = 1 WHERE ip = ?', [ip]);
    // Check for existing record
    if (!ipsData[0]) {
        console.log('No record found for', ip)
        await query('INSERT INTO ips (ip) VALUES (?);',[ip])
    } else { 
        console.log(`Record found for ${ip} found. Name: ${ipsData[0].name}. Tried ${ipsData[0].times_tried} times. Fetches: ${ipsData[0].fetches_left}. Key: ${Boolean(ipsData[0].can_get_unused_keys)}. Banned: ${Boolean(ipsData[0].banned)}.`)
    };
    ipsData = await query('SELECT * FROM `sbox-keygen`.ips WHERE ip = ?;', [ip]);
    // Increment tries counter of ip
    query('UPDATE `sbox-keygen`.ips SET times_tried = ? WHERE ip = ?;', [ipsData[0].times_tried + 1, ip]);
    // Set name to input if not blank
    if (req.url.slice(1) !== '') {
        query('UPDATE `sbox-keygen`.ips SET name = ? WHERE ip = ?;', [req.url.slice(1), ip])
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
        query('UPDATE `sbox-keygen`.keys SET times_fetched = ? WHERE id = ?', [unusedKey.times_fetched + 1, unusedKey.id]);
        query('UPDATE `sbox-keygen`.ips SET fetches_left = ? WHERE ip = ?;', [ipsData[0].fetches_left - 1, ip]);
        console.log(chalk.white.bgGreen(`${ip}(${ipsData[0].name}) Has received a real key using a fetch chance!`));
        // return delayedResEnd(unusedKey.key, res, ip, ipsData[0].name, 'Unused key:');
        return delayedResEnd(res, ip, unusedKey.key, () => { console.log(chalk.white.bgGreen(`Unused key(fetch_times): ${unusedKey.key} sent to ${ip}(${ipsData[0].name}).`))})
    };
    // Respond with random unused real unused key at a low chance if ip does not have banned flag
    if (ipsData[0] && ipsData[0].banned <= 0 &&  Math.random() < 0.002 && ipsData[0].can_get_unused_keys >= 1) {
        let unusedKey = unusedKeyData[ Math.floor(Math.random() * unusedKeyData.length)];
        query('UPDATE `sbox-keygen`.keys SET times_fetched = ? WHERE id = ?', [unusedKey.times_fetched + 1, unusedKey.id]);
        query('UPDATE `sbox-keygen`.ips SET fetches_left = ? WHERE ip = ?;', [ipsData[0].can_get_unused_keys - 1, ip]);
        console.log(chalk.white.bgGreen(`${ip}(${ipsData[0].name}) Has received a real key by chance!`));
        return delayedResEnd(res, ip, unusedKey.key, () => { console.log(chalk.white.bgGreen(`Unused key(Random): ${unusedKey.key} sent to ${ip}(${ipsData[0].name}).`))});
    }
    // Default response
    if ( Math.random() < 0.85) {
        const random = tryKeyGen();
        delayedResEnd(res, ip, random, () => { console.log(chalk.yellow(`Fake key/Error: ${random} sent to ${ip}(${ipsData[0].name}).`))});
    } else {
        let usedKey = usedKeysData[ Math.floor(Math.random() * usedKeysData.length)];
        query('UPDATE `sbox-keygen`.keys SET times_fetched = ? WHERE id = ?', [usedKey.times_fetched + 1, usedKey.id]);
        delayedResEnd(res, ip, usedKey.key, () => { console.log(chalk.cyan(`Used key: ${usedKey.key} sent to ${ip}(${ipsData[0].name}).`))});
    }
});

server.listen(listenPort, listenIP, () => {console.log(`Listening on ${listenIP}:${listenPort}`)})
