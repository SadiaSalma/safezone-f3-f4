// report.js: the report form. Step 1 of "Follow one report" (see README).

const DHAKA_CENTER = [23.78, 90.4];
let placeMarker = null;
// What OCR read from the GD copy: { gdNumber, gdDate, thanaId }, or null when no copy was added.
// It is sent with the report so the verifier can compare it with what the victim typed.
let readFromGdCopy = null;

// The map where the victim taps the place. Leaflet uses [lat, lng].
const placeMap = L.map("place-map").setView(DHAKA_CENTER, 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(placeMap);

// The search box above the map (see area-search.js).
setUpAreaSearch(placeMap, "Now tap the exact spot where it happened.");

placeMap.on("click", (event) => {
  if (placeMarker) {
    placeMarker.setLatLng(event.latlng);
  } else {
    placeMarker = L.marker(event.latlng).addTo(placeMap);
  }
  document.getElementById("place-note").textContent =
    "Place chosen. Tap again to move it. The public map moves the point about 150 m.";
});

// Choosing a thana moves the map there, so finding the place is quicker.
document.getElementById("thana").addEventListener("change", async (event) => {
  const thanas = await getThanas();
  const thana = thanas.find((t) => t._id === event.target.value);
  if (thana && !placeMarker) {
    const [lng, lat] = thana.location.coordinates;
    placeMap.setView([lat, lng], 15);
  }
});

// When a GD copy (photo or PDF) is chosen, read it here in the browser.
document.getElementById("gd-copy").addEventListener("change", (event) => {
  const file = event.target.files[0];
  readFromGdCopy = null;
  if (file) {
    readGdCopy(file);
  }
});

async function readGdCopy(file) {
  const progressBox = document.getElementById("ocr-progress-box");
  const progressBar = document.getElementById("ocr-progress");
  const resultBox = document.getElementById("ocr-result");
  progressBox.classList.remove("d-none");
  resultBox.classList.add("d-none");

  try {
    const canvas = await prepareImage(file);
    const text = await readText(canvas, (progress) => {
      progressBar.style.width = Math.round(progress * 100) + "%";
    });
    const details = findGdDetails(text, await getThanas());
    readFromGdCopy = details;
    const found = fillForm(details);

    if (found.length > 0) {
      resultBox.className = "alert alert-success";
      resultBox.textContent = `Read from your GD copy: ${found.join(", ")}. Please check them below.`;
    } else {
      resultBox.className = "alert alert-warning";
      resultBox.textContent = "We could not read the GD details from this copy. Please type them below.";
    }
  } catch (error) {
    resultBox.className = "alert alert-warning";
    resultBox.textContent = "We could not open this file. Please type the GD details below.";
  }
  progressBox.classList.add("d-none");
  resultBox.classList.remove("d-none");
}

// Check the form in the browser first, so the person gets a quick, clear message.
function findFormProblem() {
  const required = [
    ["gd-number", "Please enter the GD number."],
    ["gd-date", "Please enter the GD date."],
    ["thana", "Please choose the thana."],
    ["theft-type", "Please choose the type of theft."],
    ["happened-at", "Please enter when it happened."],
  ];
  for (const [fieldId, message] of required) {
    if (document.getElementById(fieldId).value === "") {
      return message;
    }
  }
  if (placeMarker === null) {
    return "Please tap the map to show where it happened.";
  }
  return null;
}

document.getElementById("report-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError("error");

  const problem = findFormProblem();
  if (problem) {
    showError("error", problem);
    return;
  }

  const place = placeMarker.getLatLng();
  const report = {
    gdNumber: document.getElementById("gd-number").value.trim(),
    gdDate: document.getElementById("gd-date").value,
    thana: document.getElementById("thana").value,
    theftType: document.getElementById("theft-type").value,
    happenedAt: new Date(document.getElementById("happened-at").value).toISOString(),
    description: document.getElementById("description").value.trim(),
    lat: place.lat,
    lng: place.lng,
    readFromGdCopy: readFromGdCopy, // only the details, never the file
  };

  const sendButton = document.getElementById("send-button");
  sendButton.disabled = true;
  try {
    await postJSON("/api/reports", report);
    document.getElementById("report-form").classList.add("d-none");
    document.getElementById("sent").classList.remove("d-none");
  } catch (error) {
    showError("error", error.message);
  }
  sendButton.disabled = false;
});

async function startPage() {
  const user = await requireLogin();
  if (!user) {
    return;
  }
  await fillThanaSelect("thana", "Choose a thana");
  fillTheftTypeSelect("theft-type", "Choose a type");
}

startPage().catch((error) => showError("error", error.message));
