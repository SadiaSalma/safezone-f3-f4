// ocr.js: read the GD number, date and thana from the GD copy (a photo or a PDF).
// Everything runs in the victim's browser with Tesseract.js. The copy itself is never uploaded:
// only the details we read are sent with the report. The victim always checks them.

// "GD No", "G.D. No", "জিডি নং", "সাধারণ ডায়েরি নম্বর" ... followed by the number.
const GD_LABEL = /(?:G\.?\s?D\.?|জিডি|সাধারণ ডায়েরি)\s*(?:No\.?|নং|নম্বর)?\s*[:\-.]?\s*(\d{1,6})/i;

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

function bengaliToEnglishDigits(text) {
  return text.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
}

// PDF.js needs a helper file (a "worker") that does the heavy work in the background.
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

// Draw a photo on a canvas. Big phone photos are made smaller, because they make Tesseract slow.
async function drawPhoto(file) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Draw the first page of a PDF on a canvas. The GD number and date are on page 1.
async function drawPdfPage(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 }); // twice the normal size, so small print is readable
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
  return canvas;
}

// Grey and high contrast: Tesseract reads printed text much better that way.
async function prepareImage(file) {
  let canvas;
  if (file.type === "application/pdf") {
    canvas = await drawPdfPage(file);
  } else {
    canvas = await drawPhoto(file);
  }

  const context = canvas.getContext("2d");
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const grey = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
    const contrasted = Math.max(0, Math.min(255, (grey - 128) * 1.6 + 128));
    data[i] = data[i + 1] = data[i + 2] = contrasted;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

// Read all the text on the photo, in Bangla and English. onProgress gets a number from 0 to 1.
async function readText(canvas, onProgress) {
  const result = await Tesseract.recognize(canvas, "ben+eng", {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress(message.progress);
      }
    },
  });
  return result.data.text;
}

// Find the GD number, date and thana in the text Tesseract read.
function findGdDetails(text, thanas) {
  const plain = bengaliToEnglishDigits(text);
  const gdNumber = plain.match(GD_LABEL);
  const gdDate = plain.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);

  // Try longer names first, so "Tejgaon Industrial Area" wins over "Tejgaon".
  const byLength = [...thanas].sort((a, b) => b.nameEn.length - a.nameEn.length);
  const lowerText = plain.toLowerCase();
  const thana = byLength.find((t) => plain.includes(t.nameBn) || lowerText.includes(t.nameEn.toLowerCase()));

  return {
    gdNumber: gdNumber ? gdNumber[1] : "",
    gdDate: gdDate ? `${gdDate[3]}-${gdDate[2].padStart(2, "0")}-${gdDate[1].padStart(2, "0")}` : "",
    thanaId: thana ? thana._id : "",
  };
}

// Put what we found into the form and mark those fields so the victim checks them.
function fillForm(details) {
  const found = [];
  if (details.gdNumber) {
    markFromOcr("gd-number", details.gdNumber);
    found.push("GD number");
  }
  if (details.gdDate) {
    markFromOcr("gd-date", details.gdDate);
    found.push("date");
  }
  if (details.thanaId) {
    markFromOcr("thana", details.thanaId);
    found.push("thana");
  }
  return found;
}

function markFromOcr(fieldId, value) {
  const field = document.getElementById(fieldId);
  field.value = value;
  field.classList.add("from-ocr");
  // Once the person touches the field, they have checked it.
  field.addEventListener("input", () => field.classList.remove("from-ocr"), { once: true });
}
