
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const express = require('express');
const bodyParser = require('body-parser')

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();

const app = express();
const main = express();

const collectionName = 'animals'

main.use('/v1/' + collectionName, app);
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));

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

    res.status(200).send(list);
})

app.post('/', async (req, res) => {
    const docRef = await db.collection(collectionName).add(req.body);
    const doc = await docRef.get();
    res.send(docDataWithId(doc));
})

app.patch('/:id', async (req, res) => {
    const doc = db.collection(collectionName).doc(req.params.id);
    const docSnapshot = await doc.get()
    await doc.set(Object.assign({}, docSnapshot.data(), req.body));
    res.send(docDataWithId(await doc.get()));
})

app.get('/:id', async (req, res) => {
    const doc = await db.collection(collectionName).doc(req.params.id).get();
    res.status(200).send(docDataWithId(doc));
})

module.exports.api = functions.https.onRequest(main);
