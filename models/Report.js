const mongoose = require("mongoose");

// One theft report. The exact place is only shown to verifiers.
const reportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  thana: { type: mongoose.Schema.Types.ObjectId, ref: "Thana", required: true },
  theftType: { type: String, required: true },
  happenedAt: { type: Date, required: true },
  description: String,
  // Where it happened: a GeoJSON point [lng, lat]. Only verifiers see it.
  place: { type: { type: String, default: "Point" }, coordinates: [Number] },
  // The same point moved about 150 m. This one is shown on the public map.
  publicPlace: { type: { type: String, default: "Point" }, coordinates: [Number] },
  gdNumber: { type: String, required: true },
  gdDate: Date,
  // What OCR read from the GD copy in the victim's browser. The copy itself is never uploaded.
  // The verifier compares these with gdNumber, gdDate and thana, which the victim typed or checked.
  gdCopyAdded: { type: Boolean, default: false },
  readFromGdCopy: {
    gdNumber: String,
    gdDate: Date,
    thana: { type: mongoose.Schema.Types.ObjectId, ref: "Thana" },
  },
  // The four automatic checks, worked out when the report is sent (see checks.js).
  checks: [{ _id: false, name: String, passed: Boolean, note: String }],
  status: { type: String, enum: ["waiting", "approved", "rejected"], default: "waiting" },
  reviewNote: String,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reviewedAt: Date,
}, { timestamps: true });

// The same GD number can be reported only once per thana.
reportSchema.index({ gdNumber: 1, thana: 1 }, { unique: true });

module.exports = mongoose.model("Report", reportSchema);
