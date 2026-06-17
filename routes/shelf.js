import express from "express";
import { db } from "../database/db.js";
import { ObjectId } from "mongodb";

const shelfCollection = db.collection("shelf");
const historyCollection = db.collection("history");

const router = express.Router();

// An item removed on or after its expiration date was wasted; otherwise the
// user used it in time and its cost counts as value saved.
function isExpired(expirationDate) {
  if (!expirationDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = String(expirationDate).split("-").map(Number);
  const target = new Date(year, month - 1, day);

  return target < today;
}

router.get("/", async (req, res) => {
  try {
    const items = await shelfCollection.find({}).toArray();

    res.json(items);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch shelf items",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await shelfCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          name: req.body.name,
          storedDate: req.body.storedDate,
          expirationDate: req.body.expirationDate,
          quantity: req.body.quantity,
          quantityUnit: req.body.quantityUnit,
          cost: req.body.cost,
          category: req.body.category,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: "Item not found",
      });
    }

    res.json({
      message: "Item updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to update item",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const newItem = {
      name: req.body.name,
      storedDate: req.body.storedDate,
      expirationDate: req.body.expirationDate,
      quantity: req.body.quantity,
      quantityUnit: req.body.quantityUnit,
      cost: req.body.cost,
      category: req.body.category,
    };

    const result = await shelfCollection.insertOne(newItem);
    res.status(201).json({
      _id: result.insertedId,
      ...newItem,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to create item",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const item = await shelfCollection.findOne({ _id });

    if (!item) {
      return res.status(404).json({
        error: "Item not found",
      });
    }

    const value = Number(item.cost);
    const expired = isExpired(item.expirationDate);

    await historyCollection.insertOne({
      name: item.name,
      storedDate: item.storedDate ?? null,
      expirationDate: item.expirationDate ?? null,
      quantity: item.quantity ?? null,
      quantityUnit: item.quantityUnit ?? null,
      cost: item.cost ?? null,
      category: item.category ?? null,
      value: Number.isNaN(value) ? 0 : value,
      outcome: expired ? "wasted" : "saved",
      removedDate: new Date(),
    });

    await shelfCollection.deleteOne({ _id });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to delete item",
    });
  }
});

export default router;
