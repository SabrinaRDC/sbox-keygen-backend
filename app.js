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
const db = mysql.createConnection(dbConfig);

function tryKeyGen(remaining_fetches) {
    let returnKey = '';
    if (Math.random() < 0.75) {
        //fake error
        returnKey = 'Connection to server failed! please try again or refresh page.'
    } else if (remaining_fetches > 0 && remaining_fetches !== undefined) {
        returnKey = 'have fetches remaining' //will be key fetched from db
        //fetch random real key from DB etc
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
    let content;
    query('SELECT * FROM `sbox-keygen`.ips WHERE ip = ?;', [req.socket.remoteAddress]
    ).then( ipsRes => {
        ipsData = ipsRes;
        return query('SELECT * FROM `sbox-keygen`.keys');
    }).then( keysRes => {
        keysData = keysRes;
        console.log(ipsData[0]);
        if (!ipsData[0]) {
            return query('INSERT INTO ips (ip) VALUES (?);',[req.socket.remoteAddress])
        }
    }).then( () => {
        if (!ipsData[0]){
            delayedResEnd('no record :(', res);
        } else {
            delayedResEnd('have record :)', res);
        }
    }).catch(err => console.log(err));
});

server.listen(listenPort, '127.0.0.1', () => {console.log('listening on port', listenPort)})
