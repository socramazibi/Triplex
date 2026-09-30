const DRAWS = [
  { number: 1, time: "10:00" },
  { number: 2, time: "12:00" },
  { number: 3, time: "14:00" },
  { number: 4, time: "17:00" },
  { number: 5, time: "21:15" }
];

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const dateInput = document.getElementById("dateInput");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refreshBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const todayBtn = document.getElementById("todayBtn");

function pad(n) {
  return String(n).padStart(2, "0");
}

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseInputDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function slugForDate(value) {
  const date = parseInputDate(value);
  return `${date.getDate()}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

function formatDate(value) {
  return parseInputDate(value).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function drawDateTime(dateValue, time) {
  const date = parseInputDate(dateValue);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function renderCards(values, selectedDate) {
  const now = new Date();
  const isToday = selectedDate === localDateString();

  resultsEl.innerHTML = DRAWS.map((draw, index) => {
    const value = values[index] || null;
    const drawTime = drawDateTime(selectedDate, draw.time);
    const selected = parseInputDate(selectedDate);
    const todayDate = parseInputDate(localDateString());
    const isFutureDay = selected > todayDate;
    const isPastDay = selected < todayDate;
    const isPast = now >= drawTime;
    const isNext = isToday && !value && now < drawTime;

    let badge = "";
    if (value) {
      badge = `<span class="badge">Resultado publicado</span>`;
    } else if (isFutureDay) {
      badge = `<span class="badge">Día no celebrado</span>`;
    } else if (isNext) {
      badge = `<span class="badge">Sorteo no celebrado</span>`;
    } else if (isPastDay || isPast) {
      badge = `<span class="badge">Pendiente de publicación</span>`;
    } else {
      badge = `<span class="badge">Pendiente</span>`;
    }

    return `
      <article class="card ${value ? "done" : ""} ${isNext ? "next" : ""}">
        <div class="card-info">
          <p class="draw-title">Sorteo ${draw.number}</p>
          <p class="draw-time">${draw.time} h</p>
          ${badge}
        </div>
        <div class="card-number ${value ? "" : "pending"}">
          ${value || "Pendiente"}
        </div>
      </article>
    `;
  }).join("");
}

function showLoading() {
  resultsEl.innerHTML = DRAWS.map(draw => `
    <article class="card">
      <div class="card-info">
        <p class="draw-title">Sorteo ${draw.number}</p>
        <p class="draw-time">${draw.time} h</p>
      </div>
      <div class="card-number pending">...</div>
    </article>
  `).join("");
}

function normalizeText(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function extractPageDate(text) {
  const normalized = normalizeText(text);
  const months = MONTHS.join("|");
  const regex = new RegExp(`(?:resultados[^.]{0,100})?(\\d{1,2})\\s+(?:de\\s+)?(${months})\\s+(?:de\\s+)?(\\d{4})`, "i");
  const match = normalized.match(regex);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS.indexOf(match[2]);
  const year = Number(match[3]);
  if (month < 0) return null;
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function extractResults(text) {
  const values = [null, null, null, null, null];

  // Formato habitual de la página oficial:
  // "Números para el primer sorteo del Triplex: 1, 2, 3."
  const patterns = [
    /primer\s+sorteo\s+del\s+Triplex\s*:\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/i,
    /segundo\s+sorteo\s+del\s+Triplex\s*:\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/i,
    /tercer\s+sorteo\s+del\s+Triplex\s*:\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/i,
    /cuarto\s+sorteo\s+del\s+Triplex\s*:\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/i,
    /quinto\s+sorteo\s+del\s+Triplex\s*:\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/i
  ];

  patterns.forEach((regex, index) => {
    const match = text.match(regex);
    if (match) {
      values[index] = `${match[1]}${match[2]}${match[3]}`;
    }
  });

  return values;
}

async function fetchResults(dateValue) {
  const slug = slugForDate(dateValue);
  const officialUrl = `https://www.juegosonce.es/resultados-triplex-${slug}`;

  // r.jina.ai convierte la página oficial en texto accesible desde una
  // web estática. No es una fuente de resultados propia: solo hace de
  // intermediario para poder leer JuegosONCE desde GitHub Pages.
  const proxyUrl = `https://r.jina.ai/${officialUrl}?_=${Date.now()}`;

  const response = await fetch(proxyUrl, {
    method: "GET",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" }
  });

  if (!response.ok) {
    throw new Error("No se ha encontrado una página de resultados para esa fecha.");
  }

  const text = await response.text();

  // JuegosONCE puede devolver el último día disponible cuando la fecha
  // solicitada todavía no tiene resultados. Verificamos la fecha real.
  const pageDate = extractPageDate(text);
  if (pageDate && pageDate !== dateValue) {
    throw new Error(`Todavía no hay una página de resultados para el ${formatDate(dateValue)}.`);
  }
  if (!pageDate) {
    throw new Error("No se ha podido verificar la fecha de la página de resultados.");
  }

  const values = extractResults(text);
  return { values, officialUrl };
}

async function loadResults() {
  const selectedDate = dateInput.value;
  if (!selectedDate) return;

  refreshBtn.disabled = true;
  showLoading();
  statusEl.textContent = `Consultando resultados del ${formatDate(selectedDate)}...`;

  try {
    const { values, officialUrl } = await fetchResults(selectedDate);

    renderCards(values, selectedDate);

    const published = values.filter(Boolean).length;
    statusEl.innerHTML =
      `${published} de 5 resultados disponibles · ${formatDate(selectedDate)}. ` +
      `<a href="${officialUrl}" target="_blank" rel="noopener noreferrer">Fuente oficial</a>`;
  } catch (error) {
    renderCards([], selectedDate);

    const isToday = selectedDate === localDateString();
    const selected = parseInputDate(selectedDate);
    const today = parseInputDate(localDateString());
    if (selected > today) {
      statusEl.textContent = "Ese día todavía no ha llegado.";
    } else if (isToday) {
      statusEl.textContent = "Todavía no hay resultados disponibles o la fuente no responde. Pulsa «Actualizar» para volver a intentarlo.";
    } else {
      statusEl.textContent = "No se han podido cargar los resultados de esa fecha.";
    }

    resultsEl.insertAdjacentHTML("beforebegin", `
      <div class="error" id="errorBox">
        <strong>Consulta no disponible.</strong><br>
        ${error.message}
      </div>
    `);

    setTimeout(() => document.getElementById("errorBox")?.remove(), 5000);
  } finally {
    refreshBtn.disabled = false;
  }
}

function changeDate(days) {
  const date = parseInputDate(dateInput.value);
  date.setDate(date.getDate() + days);
  dateInput.value = localDateString(date);
  loadResults();
}

dateInput.value = localDateString();

dateInput.addEventListener("change", loadResults);
refreshBtn.addEventListener("click", loadResults);
prevBtn.addEventListener("click", () => changeDate(-1));
nextBtn.addEventListener("click", () => changeDate(1));

todayBtn.addEventListener("click", () => {
  dateInput.value = localDateString();
  loadResults();
});

// Mientras estás en el día actual, refresca automáticamente cada 60 segundos.
setInterval(() => {
  if (dateInput.value === localDateString()) {
    loadResults();
  }
}, 60000);

loadResults();
