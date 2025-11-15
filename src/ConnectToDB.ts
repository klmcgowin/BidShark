import {MongoClient, ServerApiVersion} from 'mongodb';
const uri = "mongodb+srv://linzhewei123_db_user:asVZV275tIK7cGiv@cluster0.xkzri2v.mongodb.net/?appName=Cluster0";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
let db: any;
export async function connectDB() {
    if (db) return db; // reuse connection
    try {
        await client.connect();
        db = client.db("BidShark");
        return db;
    } catch (err) {
        console.error("Connection error", err);
        throw err;
    }
}