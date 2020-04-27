
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const express = require('express');
const bodyParser = require('body-parser')
const cors = require('cors')
const zlib = require('zlib');
const util = require('util');

const deflate = util.promisify(zlib.deflate);
const inflate = util.promisify(zlib.inflate);

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();
const bucket = admin.storage().bucket();

const app = express();
const main = express();

app.set('etag', true);

const collectionName = 'animals'
const listCacheCollectionName = 'animalsListCache'

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

async function getListFromCache() {
    const snapshot = await db.collection(listCacheCollectionName).get();
    if (snapshot.docs.length === 0 || snapshot.docs.some(doc => doc.data() === null)) {
        return null;
    }

    const inflatedDocs = await Promise.all(snapshot.docs.map(async doc => {
        const inflatedData = await inflate(Buffer.from(doc.data().data, 'base64'))
        return JSON.parse(inflatedData);
    }));

    const list = [].concat(...inflatedDocs);

    return sortObj(list);
}

async function resetListCache(data) {
    try {
        const doc = db.collection(listCacheCollectionName).doc('0');
        await doc.set({data});
    } catch (err) {
        console.error('Could not reset cache:', err)
    }
}

async function saveToCache(data) {
    try {
        const deflatedData = await deflate(JSON.stringify(data))
        await resetListCache(deflatedData.toString('base64'))
    } catch (err) {
        console.error('Could not save to cache:', err)
    }
}

async function getListFromDb() {
    const snapshot = await db.collection(collectionName).get();
    const list = [];
    snapshot.forEach((doc) => {
        list.push(docDataWithId(doc));
    });
    return sortObj(list);
}

async function getList() {
    const list = await getListFromCache();
    if (list) {
        return list;
    } else {
        const dbList = await getListFromDb();
        await saveToCache(dbList);
        return dbList;
    }
}

app.get('/', async (req, res) => {
    if (req.query.forcecache) {
        res.status(200).send(await getListFromCache());
    } else if (req.query.cache) {
        res.status(200).send(await getList());
    } else {
        res.status(200).send(await getListFromDb());
    }
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
        await resetListCache(null);
        res.send('Pets successfully registered!');
    } catch(err) {
        res.status(500).send({ err: err.message })
    }
})

app.patch('/:id', async (req, res) => {
    const doc = db.collection(collectionName).doc(req.params.id);
    if (Object.keys(req.body || {}).length > 0) {
        await doc.update(req.body);
    }
    await resetListCache(null);
    res.send(docDataWithId(await doc.get()));
})

app.put('/:id', async (req, res) => {
    const doc = db.collection(collectionName).doc(req.params.id);
    await doc.set(req.body);
    await resetListCache(null);
    res.send(docDataWithId(await doc.get()));
})

app.get('/:id', async (req, res) => {
    const doc = await db.collection(collectionName).doc(req.params.id).get();
    res.status(200).send(sortObj(docDataWithId(doc)));
})

const PHOTO_SIZES = ['original', 'medium', 'small']
function validateSize(req, res, next) {
    if (!PHOTO_SIZES.includes(req.params.size)) {
        res.status(404).send()
        return
    }
    next()
}

function getPhotoPath(id, size) {
    return `photos/${size}/${id}`
}

app.put('/:id/photos/:size', validateSize, bodyParser.raw(), async (req, res) => {
    const imageFile = bucket.file(getPhotoPath(req.params.id, req.params.size));
    await imageFile.save(req.body);
    res.status(200).send();
})

app.get('/:id/photos/:size', validateSize, async(req, res) => {
    const imageFile = bucket.file(getPhotoPath(req.params.id, req.params.size));
    if (!(await imageFile.exists())[0]) {
        res.status(404).send();
    } else {
        const data = await imageFile.download();
        if (req.query.cachekey) {
            res.setHeader('Cache-Control', 'public, max-age=31536000')
        }
        res.status(200).send(data[0]);
    }
})

module.exports.api = functions.https.onRequest(main);
