import express, { Router } from "express";
import { shelfCollection } from "../database/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const items = await shelfCollection.find({}).toArray();
  res.json(items);
});

export default router;
