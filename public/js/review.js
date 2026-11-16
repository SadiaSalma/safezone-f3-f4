// review.js: the verifier's queue. Steps 3 and 4 of "Follow one report" (see README).

const reviewModal = new bootstrap.Modal(document.getElementById("review-modal"));
let waitingReports = []; // the reports in the table
let openReport = null; // the report shown in the modal right now
let reviewMap = null;
let reviewMarker = null;

async function loadQueue() {
  waitingReports = await getJSON("/api/review");

  let rows = "";
  for (let i = 0; i < waitingReports.length; i++) {
    rows += queueRow(waitingReports[i], i);
  }
  document.getElementById("queue").innerHTML = rows;

  const empty = document.getElementById("empty");
  if (waitingReports.length === 0) {
    empty.classList.remove("d-none");
  } else {
    empty.classList.add("d-none");
  }
}

// One table row. Each report has checks like { name: "GD number format", passed: true, note: "..." }.
function queueRow(report, index) {
  const passedCount = report.checks.filter((check) => check.passed).length;
  let checkColour = "bg-warning text-dark";
  if (passedCount === report.checks.length) {
    checkColour = "bg-success";
  }
  return `
    <tr>
      <td>${formatDateTime(report.createdAt)}</td>
      <td>${escapeHtml(theftTypeInEnglish(report.theftType))}</td>
      <td>${escapeHtml(report.thana.nameEn)}</td>
      <td>${escapeHtml(report.gdNumber)}</td>
      <td><span class="badge ${checkColour}">${passedCount} of ${report.checks.length} passed</span></td>
      <td><button class="btn btn-sm btn-primary" data-index="${index}">Review</button></td>
    </tr>`;
}

// One click listener for the whole table. data-index on the button says which report it is.
document.getElementById("queue").addEventListener("click", (event) => {
  const index = event.target.dataset.index;
  if (index !== undefined) {
    openReview(waitingReports[index]);
  }
});

function openReview(report) {
  openReport = report;
  hideError("modal-error");
  document.getElementById("review-note").value = "";
  showGdCopy(report);
  showDetails(report);
  showChecks(report);
  reviewModal.show();
}

// A table: what OCR read from the GD copy next to what is in the form.
// A difference does not mean the report is false, but it is worth a closer look.
function showGdCopy(report) {
  const box = document.getElementById("gd-copy-box");
  if (!report.gdCopyAdded) {
    box.innerHTML = `<p class="text-secondary">The victim did not add a GD copy. Check the GD with the thana if you are unsure.</p>`;
    return;
  }

  const read = report.readFromGdCopy || {};
  const rows = [
    ["GD number", read.gdNumber, report.gdNumber],
    ["GD date", read.gdDate ? formatDate(read.gdDate) : "", report.gdDate ? formatDate(report.gdDate) : ""],
    ["Thana", read.thana ? read.thana.nameEn : "", report.thana.nameEn],
  ];

  let html = "";
  for (const [label, onCopy, inForm] of rows) {
    let result = "";
    if (!onCopy) {
      result = `<span class="badge bg-secondary">Not read</span>`;
    } else if (onCopy === inForm) {
      result = `<span class="badge bg-success">Same</span>`;
    } else {
      result = `<span class="badge bg-warning text-dark">Different</span>`;
    }
    html += `
      <tr>
        <th>${label}</th>
        <td>${escapeHtml(onCopy || "–")}</td>
        <td>${escapeHtml(inForm)}</td>
        <td>${result}</td>
      </tr>`;
  }
  box.innerHTML = `
    <table class="table table-sm">
      <thead><tr><th></th><th>On the GD copy</th><th>In the form</th><th></th></tr></thead>
      <tbody>${html}</tbody>
    </table>`;
}

function showDetails(report) {
  let gdDate = "not given";
  if (report.gdDate) {
    gdDate = formatDate(report.gdDate);
  }
  const rows = [
    ["Name", `${report.user.name} (${report.user.phone})`],
    ["GD number", report.gdNumber],
    ["GD date", gdDate],
    ["Thana", `${report.thana.nameEn} / ${report.thana.nameBn}`],
    ["Type", THEFT_TYPES[report.theftType]],
    ["Happened", formatDateTime(report.happenedAt)],
    ["What happened", report.description || "–"],
  ];

  let html = "";
  for (const [label, value] of rows) {
    html += `<dt class="col-4">${label}</dt><dd class="col-8">${escapeHtml(value)}</dd>`;
  }
  document.getElementById("report-details").innerHTML = html;
}

function showChecks(report) {
  let html = "";
  for (const check of report.checks) {
    let badge = `<span class="badge align-self-start bg-warning text-dark">Please check</span>`;
    if (check.passed) {
      badge = `<span class="badge align-self-start bg-success">Passed</span>`;
    }
    html += `
      <li class="list-group-item d-flex justify-content-between gap-2">
        <span>${escapeHtml(check.name)}<br><span class="small text-secondary">${escapeHtml(check.note)}</span></span>
        ${badge}
      </li>`;
  }
  document.getElementById("check-list").innerHTML = html;
}

// Leaflet cannot measure a map inside a hidden modal, so we draw it once the modal is open.
document.getElementById("review-modal").addEventListener("shown.bs.modal", () => {
  const lng = openReport.place.coordinates[0];
  const lat = openReport.place.coordinates[1];

  if (reviewMap === null) {
    reviewMap = L.map("review-map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(reviewMap);
    reviewMarker = L.marker([lat, lng]).addTo(reviewMap);
  }
  reviewMap.invalidateSize();
  reviewMap.setView([lat, lng], 16);
  reviewMarker.setLatLng([lat, lng]);
});

// After a decision: close the modal, say what happened, and load the queue again.
async function finishReview(message) {
  reviewModal.hide();
  const doneBox = document.getElementById("done");
  doneBox.textContent = message;
  doneBox.classList.remove("d-none");
  await loadQueue();
}

async function approveReport() {
  const note = document.getElementById("review-note").value.trim();
  try {
    await postJSON(`/api/review/${openReport._id}/approve`, { note: note });
    await finishReview("Approved. The alert is now on the home page and the map.");
  } catch (error) {
    showError("modal-error", error.message);
  }
}

async function rejectReport() {
  const note = document.getElementById("review-note").value.trim();
  if (note === "") {
    showError("modal-error", "Please write a note so the victim knows what to fix.");
    return;
  }
  try {
    await postJSON(`/api/review/${openReport._id}/reject`, { note: note });
    await finishReview("Rejected. The victim will see your note.");
  } catch (error) {
    showError("modal-error", error.message);
  }
}

document.getElementById("approve-button").addEventListener("click", approveReport);
document.getElementById("reject-button").addEventListener("click", rejectReport);

async function startPage() {
  const user = await requireStaff();
  if (!user) {
    return;
  }
  await loadQueue();
}

startPage().catch((error) => showError("error", error.message));
