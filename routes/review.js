// routes/review.js: the verifier's queue, approve and reject.
// Step 4 of "Follow one report" (see README).
const express = require("express");
const Report = require("../models/Report");
const Alert = require("../models/Alert");
const THEFT_TYPES = require("../theftTypes");
const { mustBeLoggedIn, mustBeStaff } = require("../middleware/auth");

const router = express.Router();

// Move a point about 150 m in a random direction, so the public map never shows the exact place.
// 0.00135 degrees of latitude is about 150 m; longitude degrees are a little shorter in Dhaka.
function movePoint([lng, lat]) {
  const angle = Math.random() * 2 * Math.PI;
  return [lng + 0.00147 * Math.cos(angle), lat + 0.00135 * Math.sin(angle)];
}

// Alerts say what happened, where and when. Never who.
function alertMessage(report) {
  const day = report.happenedAt.toLocaleDateString("en-GB", {
    timeZone: "Asia/Dhaka", day: "numeric", month: "long",
  });
  return `A ${THEFT_TYPES[report.theftType]} was reported near ${report.thana.nameEn} on ${day} (police GD verified).`;
}

// Waiting reports, oldest first, with what was read from each GD copy.
router.get("/api/review", mustBeLoggedIn, mustBeStaff, async (req, res) => {
  const reports = await Report.find({ status: "waiting" })
    .populate("user", "name phone")
    .populate("thana", "nameEn nameBn")
    .populate("readFromGdCopy.thana", "nameEn nameBn")
    .sort({ createdAt: 1 });
  res.json(reports);
});

router.post("/api/review/:id/approve", mustBeLoggedIn, mustBeStaff, async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, status: "waiting" }).populate("thana", "nameEn");
  if (!report) {
    return res.status(404).json({ error: "This report was already reviewed." });
  }

  report.status = "approved";
  report.reviewNote = (req.body.note || "").trim();
  report.reviewedBy = req.session.userId;
  report.reviewedAt = new Date();
  report.publicPlace = { type: "Point", coordinates: movePoint(report.place.coordinates) };
  await report.save();

  await Alert.create({
    report: report._id,
    thana: report.thana._id,
    theftType: report.theftType,
    message: alertMessage(report),
  });
  res.json({ ok: true });
});

router.post("/api/review/:id/reject", mustBeLoggedIn, mustBeStaff, async (req, res) => {
  const note = (req.body.note || "").trim();
  if (!note) {
    return res.status(400).json({ error: "Please write a note when you reject." });
  }
  const report = await Report.findOne({ _id: req.params.id, status: "waiting" });
  if (!report) {
    return res.status(404).json({ error: "This report was already reviewed." });
  }

  report.status = "rejected";
  report.reviewNote = note;
  report.reviewedBy = req.session.userId;
  report.reviewedAt = new Date();
  await report.save();
  res.json({ ok: true });
});

module.exports = router;
