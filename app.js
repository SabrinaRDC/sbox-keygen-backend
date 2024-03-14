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

function query(query, callback){
    db.query(query , (err, response) => {
        if (err) {throw err};
        callback(err, response)
    })
}

let wait = 1000;
function delayedResEnd(endValue, res) {
    setTimeout(() => {
        res.end(endValue);
    }, wait)
}

const server = http.createServer((req, res) => {
    console.log(req.socket.remoteAddress, req.method, req.url);
    res.setHeader('Content-Type', 'Text');
    res.setHeader('Access-Control-Allow-Origin', '*')
    let content;
    query('SELECT * FROM `sbox-keygen`.ips WHERE ip =' + `'${req.socket.remoteAddress}'`, (err, response) => {
        let queryRes = response;
        console.log(queryRes[0])
        // wait = 5000 + Math.floor(Math.random() * 5000);
        if (err) {throw err}
        if (queryRes[0] === undefined) {
            delayedResEnd('undefined query response', res)
        } else if (response[0].banned === 1){
            delayedResEnd('banned', res)
        } else {
            console.log(queryRes)
            delayedResEnd((response[0].ip, 'test'), res)
        }
        
    })
});

server.listen(8001, '127.0.0.1', () => {console.log('listening on port 8001')})
