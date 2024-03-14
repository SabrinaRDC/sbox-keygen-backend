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
// wait = 5000 + Math.floor(Math.random() * 5000)

const db = mysql.createConnection(dbConfig);

function tryKeyGen(remaining_fetches) {
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

function delayedResEnd(endValue, res) {
    setTimeout(() => {
        res.end(endValue);
    }, wait)
}

const server = http.createServer((req, res) => {
    const ip = req.headers['x-forwarded-for'].slice(req.headers['x-forwarded-for'].length/2+1);
    // const ip = req.socket.remoteAddress;
    let ipsData;
    let keysData;
    let usedKeysData;
    console.log(ip, req.method, req.url);
    res.setHeader('Content-Type', 'Text');
    res.setHeader('Access-Control-Allow-Origin', '*');
    query('SELECT * FROM `sbox-keygen`.ips WHERE ip = ?;', [ip]
    ).then( ipsRes => {
        ipsData = ipsRes;
        return query('SELECT * FROM `sbox-keygen`.keys');
    }).then( keysRes => {
        keysData = keysRes;
        return query('SELECT * FROM `sbox-keygen`.keys WHERE status = ?', ['used']);
    }).then( (usedKeysRes) => {
        usedKeysData = usedKeysRes;
        if (!ipsData[0]) {
            console.log('No record found for', ip)
            return query('INSERT INTO ips (ip) VALUES (?);',[ip])
        } else { console.log('Record found for', ip, `with ${ipsData[0].fetches_left} fetches remaining. Banned: ${ipsData[0].banned}. Name: ${ipsData[0].name}`)}
    }).then( () => {
        if (req.url.slice(1) !== '' && req.url.slice(1) !== 'favicon.ico') {
            query('UPDATE `sbox-keygen`.ips SET name = ? WHERE ip = ?;', [req.url.slice(1), ip])
        };
        if (!ipsData[0]){
            return delayedResEnd(tryKeyGen(), res);
        };
        if (ipsData[0] && ipsData[0].banned >= 1) {
            return delayedResEnd('Error: This IP has been banned from s&box server due to suspected malicious activities.', res);
        };
        if (ipsData[0] && ipsData[0].banned === 0 && ipsData[0].fetches_left > 0) {
            let realKey = keysData[ Math.floor(Math.random() * keysData.length)];
            query('UPDATE `sbox-keygen`.keys SET times_fetched = ? WHERE id = ?', [realKey.times_fetched + 1, realKey.id]);
            query('UPDATE `sbox-keygen`.ips SET fetches_left = ? WHERE ip = ?;', [ipsData[0].fetches_left - 1, ip]);
            return delayedResEnd(realKey.key, res);
        };
        if ( Math.random() < 0.85) {
            delayedResEnd(tryKeyGen(), res);
        } else {
            let usedKey = usedKeysData[ Math.floor(Math.random() * usedKeysData.length)];
            delayedResEnd(usedKey.key, res)
        }
    }).catch(err => console.log(err));
});

server.listen(listenPort, listenIP, () => {console.log(`Listening on ${listenIP}:${listenPort}`)})
