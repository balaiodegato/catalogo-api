
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const express = require('express');
const bodyParser = require('body-parser')
const cors = require('cors')

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();

const app = express();
const main = express();

app.set('etag', true);

const collectionName = 'animals'

main.use(cors())
main.use('/v1/' + collectionName, app);
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));

// Sorts (deeply) the object attributes so that JSON.stringify always
// returns the same string - this is required for the etag to work
const sortObj = (obj) => (
    obj === null || typeof obj !== 'object'
    ? obj
    : Array.isArray(obj)
        ? obj.map(sortObj)
        : Object.assign(
            {},
            ...Object.entries(obj)
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                .map(([k, v]) => ({ [k]: sortObj(v) }))
        )
)

function docDataWithId(doc) {
    const docClone = Object.assign({}, doc.data())
    docClone.id = doc.id
    return docClone;
}

app.get('/', async (req, res) => {
    const snapshot = await db.collection(collectionName).get();

    const list = [];
    snapshot.forEach((doc) => {
        list.push(docDataWithId(doc));
    });

    res.status(200).send(sortObj(list));
})

app.post('/', async (req, res) => {
    const docRef = await db.collection(collectionName).add(req.body);
    const doc = await docRef.get();
    res.send(docDataWithId(doc));
})

app.post('/saveAll', async (req, res) => {
    try {
        req.body.map(async pet => {
            await db.collection(collectionName).add(pet)
        })
        res.send('Pets successfully registered!');
    } catch(err) {
        res.status(500).send({ err: err.message })
    }
})

app.patch('/:id', async (req, res) => {
    const doc = db.collection(collectionName).doc(req.params.id);
    await doc.update(req.body);
    res.send(docDataWithId(await doc.get()));
})

app.put('/:id', async (req, res) => {
    const doc = db.collection(collectionName).doc(req.params.id);
    await doc.set(req.body);
    res.send(docDataWithId(await doc.get()));
})

app.get('/:id', async (req, res) => {
    const doc = await db.collection(collectionName).doc(req.params.id).get();
    res.status(200).send(sortObj(docDataWithId(doc)));
})

module.exports.api = functions.https.onRequest(main);
