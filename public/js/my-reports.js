// my-reports.js: the logged-in person's reports, newest first, with their status.

// The colour and words of the status badge for each status.
const STATUS_BADGES = {
  waiting: { colour: "bg-primary", text: "Waiting for a verifier" },
  approved: { colour: "bg-success", text: "Approved, alert sent" },
  rejected: { colour: "bg-secondary", text: "Not approved" },
};

function reportItem(report) {
  const badge = STATUS_BADGES[report.status];
  const type = THEFT_TYPES[report.theftType];
  const thana = report.thana.nameEn;
  let note = "";
  if (report.reviewNote) {
    note = `<p class="small mb-0 mt-2"><strong>Verifier's note:</strong> ${escapeHtml(report.reviewNote)}</p>`;
  }
  return `
    <div class="list-group-item">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div class="fw-semibold">${escapeHtml(type)}</div>
          <div class="small text-secondary">
            ${escapeHtml(thana)} · GD ${escapeHtml(report.gdNumber)} · ${formatDate(report.happenedAt)}
          </div>
        </div>
        <span class="badge ${badge.colour}">${badge.text}</span>
      </div>
      ${note}
    </div>`;
}

async function startPage() {
  const user = await requireLogin();
  if (!user) {
    return;
  }
  const reports = await getJSON("/api/my-reports");
  document.getElementById("reports").innerHTML = reports.map(reportItem).join("");
  document.getElementById("no-reports").classList.toggle("d-none", reports.length > 0);
}

startPage().catch((error) => showError("error", error.message));
