// checks.js: the four automatic checks a verifier sees next to each report.
// They never block a report; they only tell the verifier what to look at closely.
const Report = require("./models/Report");

// A box around the Dhaka Metropolitan Police area: [lng, lat] corners.
const DHAKA_BOX = { minLng: 90.325, minLat: 23.675, maxLng: 90.515, maxLat: 23.905 };
const ONE_DAY = 24 * 60 * 60 * 1000;

function checkGdFormat(gdNumber) {
  const passed = /^\d{1,6}$/.test(gdNumber);
  return { name: "GD number format", passed, note: passed ? "1 to 6 digits" : "Expected 1 to 6 digits" };
}

// The same GD number in the same thana is blocked by the database,
// so here we look for it in other thanas, which may be a typing mistake.
async function checkGdNotUsed(gdNumber) {
  const used = await Report.exists({ gdNumber });
  return {
    name: "GD not used before",
    passed: !used,
    note: used ? "Another report has this GD number (other thana)" : "First time this GD is used",
  };
}

// A GD is made after the theft, usually within days, and never in the future.
function checkGdDate(gdDate, happenedAt) {
  if (!gdDate) {
    return { name: "GD date sensible", passed: false, note: "No GD date was given" };
  }
  const tooEarly = gdDate < new Date(happenedAt.getTime() - ONE_DAY);
  const tooLate = gdDate - happenedAt > 60 * ONE_DAY;
  const inFuture = gdDate > new Date(Date.now() + ONE_DAY);
  const passed = !tooEarly && !tooLate && !inFuture;
  return { name: "GD date sensible", passed, note: "On or after the theft, within 60 days, not in the future" };
}

function checkInsideDhaka(lng, lat) {
  const passed = lng > DHAKA_BOX.minLng && lng < DHAKA_BOX.maxLng && lat > DHAKA_BOX.minLat && lat < DHAKA_BOX.maxLat;
  return { name: "Place inside Dhaka", passed, note: passed ? "Inside the DMP area" : "The pin is outside the DMP area" };
}

async function runChecks({ gdNumber, gdDate, happenedAt, lng, lat }) {
  return [
    checkGdFormat(gdNumber),
    await checkGdNotUsed(gdNumber),
    checkGdDate(gdDate, happenedAt),
    checkInsideDhaka(lng, lat),
  ];
}

module.exports = runChecks;
