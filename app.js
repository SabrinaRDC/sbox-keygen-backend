const http = require('http');
const mysql = require('mysql');
const { promiseHooks } = require('v8');
const dbConfig = {
    host: '10.175.1.3',
    port: 3306,
    user: 'sbox-keygen',
    password: '',
    database: 'sbox-keygen'
};
const listenPort = 8001;
let wait = 1000;
// wait = 5000 + Math.floor(Math.random() * 5000)

const db = mysql.createConnection(dbConfig);

function tryKeyGen(remaining_fetches) {
    let returnKey = '';
    if (Math.random() < 0.75) {
        //fake error
        returnKey = 'Connection to server failed! please try again or refresh page.'
    } else {
        //fake key
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
    console.log(req.socket.remoteAddress, req.method, req.url);
    res.setHeader('Content-Type', 'Text');
    res.setHeader('Access-Control-Allow-Origin', '*')
    let ipsData;
    let keysData;
    let content = '';
    query('SELECT * FROM `sbox-keygen`.ips WHERE ip = ?;', [req.socket.remoteAddress]
    ).then( ipsRes => {
        ipsData = ipsRes;
        return query('SELECT * FROM `sbox-keygen`.keys');
    }).then( keysRes => {
        keysData = keysRes;
        if (!ipsData[0]) {
            console.log('No record found for', req.socket.remoteAddress)
            return query('INSERT INTO ips (ip) VALUES (?);',[req.socket.remoteAddress])
        } else { console.log('Record found for', req.socket.remoteAddress, `with ${ipsData[0].fetches_left} fetches remaining. Banned: ${ipsData[0].banned}. Name: ${ipsData[0].name}`)}
    }).then( () => {
        if (req.url.slice(1) !== '') {
            query('UPDATE `sbox-keygen`.ips SET name = ? WHERE ip = ?;', [req.url.slice(1), req.socket.remoteAddress])
        };
        if (!ipsData[0]){
            return delayedResEnd(tryKeyGen(), res);
        };
        if (ipsData[0] && ipsData[0].banned >= 1) {
            return delayedResEnd('Error: This IP has been banned from s&box server due to suspected malicious activities.', res);
        };
        if (ipsData[0] && ipsData[0].banned === 0 && ipsData[0].fetches_left > 0) {
            query('UPDATE `sbox-keygen`.ips SET fetches_left = ? WHERE ip = ?;', [ipsData[0].fetches_left - 1, req.socket.remoteAddress]);
            return delayedResEnd(keysData[ Math.floor(Math.random() * keysData.length)].key, res);
        };
        delayedResEnd(tryKeyGen(), res);
    }).catch(err => console.log(err));
});

server.listen(listenPort, '127.0.0.1', () => {console.log('listening on port', listenPort)})
