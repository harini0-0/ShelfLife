import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not defined");
}

const client = new MongoClient(uri);

await client.connect();

console.log("Connected to MongoDB");

const db = client.db("shelflife");

export const shelfCollection = db.collection("shelf");