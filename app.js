const http = require('http');
const mysql = require('mysql');
const dbConfig = {
    host: '10.175.1.3',
    port: 3306,
    user: 'sbox-keygen',
    password: '',
    database: 'sbox-keygen'
};
const listenIP = ''
const listenPort = 8001;
let wait = 1000;
wait = 5000 + Math.floor(Math.random() * 5000)

const db = mysql.createConnection(dbConfig);

function tryKeyGen() {
    let returnKey = '';
    if (Math.random() < 0.75) {
        returnKey = 'Connection to server failed! please try again or refresh page.'
    } else {
        returnKey = crypto.randomUUID().toUpperCase()
    }
    return returnKey;
};

function query(SQLquery, data){
    return new Promise((resolve, reject) => {
        db.query(SQLquery, data, (err, response) => {
            if (err) reject(err);
            resolve(response);
        })
    });
}

function delayedResEnd(endValue, res, ip) {
    setTimeout(async () => {
        await query('UPDATE `sbox-keygen`.ips SET connected = 0 WHERE ip = ?', [ip]);
        console.log(`${endValue} sent to ${ip}`)
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
        console.log(`Duplicated connection from ${ip} dropped.`);
        return res.end('Server connection Dropped by DDoS protection.');
    };
    // Set ip to connected
    await query('UPDATE `sbox-keygen`.ips SET connected = 1 WHERE ip = ?', [ip]);
    // Check for existing record
    if (!ipsData[0]) {
        console.log('No record found for', ip)
        await query('INSERT INTO ips (ip) VALUES (?);',[ip])
    } else { 
        console.log(`Record found for ${ip} found with ${ipsData[0].fetches_left} fetches remaining. Banned: ${ipsData[0].banned}. Name: ${ipsData[0].name}. Tried ${ipsData[0].times_tried} times.`)
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
        return delayedResEnd('Error: This IP has been banned from s&box server due to suspected malicious activities.', res, ip);
    };
    // Respond with random real key if ip does not have banned flag and has >0 real key fetches OR with low chance
    if (ipsData[0] && ipsData[0].banned === 0 && (ipsData[0].fetches_left > 0 || Math.random() < 0.001)) {
        let unusedKeys = unusedKeyData[ Math.floor(Math.random() * unusedKeyData.length)];
        query('UPDATE `sbox-keygen`.keys SET times_fetched = ? WHERE id = ?', [unusedKeys.times_fetched + 1, unusedKeys.id]);
        query('UPDATE `sbox-keygen`.ips SET fetches_left = ? WHERE ip = ?;', [ipsData[0].fetches_left - 1, ip]);
        return delayedResEnd(unusedKeys.key, res, ip);
    };
    // Default response
    if ( Math.random() < 0.85) {
        delayedResEnd(tryKeyGen(), res, ip);
    } else {
        let usedKey = usedKeysData[ Math.floor(Math.random() * usedKeysData.length)];
        query('UPDATE `sbox-keygen`.keys SET times_fetched = ? WHERE id = ?', [usedKey.times_fetched + 1, usedKey.id]);
        delayedResEnd(usedKey.key, res, ip);
    }
});

server.listen(listenPort, listenIP, () => {console.log(`Listening on ${listenIP}:${listenPort}`)})
