// area-search.js: the "Search an area" box above a map.
// Used on the report form and on the theft map. Each page calls setUpAreaSearch(itsMap, tip).
// The page needs: <input id="area-search">, <button id="area-search-button">,
// <datalist id="area-names"> and <div id="area-search-note">.

const searchBox = document.getElementById("area-search");
const searchNote = document.getElementById("area-search-note");
let searchMap = null; // the Leaflet map the box moves
let tipAfterFound = ""; // what to tell the person once the area is shown
let areaCircle = null; // the blue ring that shows the area we found

// The suggestions under the search box: every thana in English and in Bangla.
async function fillAreaNames() {
  const thanas = await getThanas();
  const list = document.getElementById("area-names");
  for (const thana of thanas) {
    list.append(new Option(thana.nameEn));
    list.append(new Option(thana.nameBn));
  }
}

// Look for the text in our 49 thana names. "mirpur", "Mirp" and "মিরপুর" all find Mirpur.
async function findThana(text) {
  const thanas = await getThanas();
  const wanted = text.toLowerCase();

  // First try the whole name, so "Uttara West" is not mixed up with "Uttara East".
  for (const thana of thanas) {
    if (thana.nameEn.toLowerCase() === wanted || thana.nameBn === text) {
      return thana;
    }
  }
  // Then try part of a name.
  for (const thana of thanas) {
    if (thana.nameEn.toLowerCase().includes(wanted) || thana.nameBn.includes(text)) {
      return thana;
    }
  }
  return null;
}

// For places that are not thana names (for example "Farmgate" or "Road 27"), ask OpenStreetMap.
// Only inside Dhaka, and only when the Find button is pressed, as OpenStreetMap's rules ask.
async function findPlaceOnline(text) {
  const params = new URLSearchParams({
    q: text,
    format: "json",
    limit: 1,
    viewbox: "90.325,23.905,90.515,23.675", // the box around Dhaka: left, top, right, bottom
    bounded: 1, // only results inside that box
  });
  const response = await fetch("https://nominatim.openstreetmap.org/search?" + params);
  const results = await response.json();
  if (results.length === 0) {
    return null;
  }
  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}

// Move the map to the area and draw a ring around it.
function showAreaOnMap(lat, lng, name) {
  searchMap.setView([lat, lng], 14);
  if (areaCircle !== null) {
    areaCircle.remove();
  }
  areaCircle = L.circle([lat, lng], { radius: 700, color: "#1d4ed8", fillOpacity: 0.08 }).addTo(searchMap);
  searchNote.textContent = `Showing ${name}. ${tipAfterFound}`;
}

async function searchArea() {
  const text = searchBox.value.trim();
  if (text === "") {
    searchNote.textContent = "Type the name of an area first.";
    return;
  }

  const thana = await findThana(text);
  if (thana !== null) {
    const lng = thana.location.coordinates[0];
    const lat = thana.location.coordinates[1];
    showAreaOnMap(lat, lng, `${thana.nameEn} / ${thana.nameBn}`);
    return;
  }

  searchNote.textContent = "Searching streets and places…";
  try {
    const place = await findPlaceOnline(text);
    if (place === null) {
      searchNote.textContent = `We could not find "${text}" in Dhaka. Try another name, or move the map yourself.`;
    } else {
      showAreaOnMap(place.lat, place.lng, text);
    }
  } catch (error) {
    searchNote.textContent = "Place search is not working right now. Try a thana name, or move the map yourself.";
  }
}

// Each page calls this once, with its map and the tip to show after an area is found.
function setUpAreaSearch(map, tip) {
  searchMap = map;
  tipAfterFound = tip;
  fillAreaNames();

  document.getElementById("area-search-button").addEventListener("click", searchArea);

  // Pressing Enter in the box searches. On the report form, Enter would otherwise send the whole form.
  searchBox.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchArea();
    }
  });

  // Picking a name from the suggestions shows it straight away.
  searchBox.addEventListener("change", async () => {
    const text = searchBox.value.trim();
    if (text === "") {
      return;
    }
    const thana = await findThana(text);
    if (thana !== null) {
      searchArea();
    }
  });
}
