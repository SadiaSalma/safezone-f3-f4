// routes/reports.js: send a report, and see your own reports.
// Step 2 of "Follow one report" (see README).
const express = require("express");
const Report = require("../models/Report");
const Thana = require("../models/Thana");
const THEFT_TYPES = require("../theftTypes");
const runChecks = require("../checks");
const { mustBeLoggedIn } = require("../middleware/auth");

const router = express.Router();

router.post("/api/reports", mustBeLoggedIn, async (req, res) => {
  // 1. Check the input.
  const gdNumber = (req.body.gdNumber || "").trim();
  const happenedAt = new Date(req.body.happenedAt);
  let gdDate = null;
  if (req.body.gdDate) {
    gdDate = new Date(req.body.gdDate);
  }
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);

  if (!gdNumber || !req.body.thana || !THEFT_TYPES[req.body.theftType] || isNaN(happenedAt) || !lat || !lng) {
    return res.status(400).json({ error: "Please fill in every required field." });
  }
  if (happenedAt > new Date()) {
    return res.status(400).json({ error: "The time of the theft cannot be in the future." });
  }
  const thana = await Thana.findById(req.body.thana);
  if (!thana) {
    return res.status(400).json({ error: "Please choose the thana." });
  }
  if (await Report.exists({ gdNumber, thana: thana._id })) {
    return res.status(400).json({ error: "This GD number was already reported." });
  }

  // 2. Run the four checks and save the report.
  const checks = await runChecks({ gdNumber, gdDate, happenedAt, lng, lat });

  // The details OCR read from the GD copy, if the victim added one. Empty values are left out.
  const read = req.body.readFromGdCopy;
  let readFromGdCopy = undefined;
  if (read) {
    readFromGdCopy = {
      gdNumber: read.gdNumber || undefined,
      gdDate: read.gdDate || undefined,
      thana: read.thanaId || undefined,
    };
  }
  const report = await Report.create({
    user: req.session.userId,
    thana: thana._id,
    theftType: req.body.theftType,
    happenedAt,
    description: (req.body.description || "").trim().slice(0, 1000),
    place: { type: "Point", coordinates: [lng, lat] },
    gdNumber,
    gdDate,
    gdCopyAdded: Boolean(read),
    readFromGdCopy: readFromGdCopy,
    checks,
  });

  // 3. Answer.
  res.status(201).json({ _id: report._id });
});

// Show the logged-in person their own reports, newest first.
router.get("/api/my-reports", mustBeLoggedIn, async (req, res) => {
  const reports = await Report.find({ user: req.session.userId })
    .select("-checks")
    .populate("thana", "nameEn nameBn")
    .sort({ createdAt: -1 });
  res.json(reports);
});

module.exports = router;
