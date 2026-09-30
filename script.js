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


/* =========================================================
   FECHAS
   ========================================================= */

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


/* =========================================================
   NORMALIZAR TEXTO
   ========================================================= */

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


/* =========================================================
   EXTRAER FECHA REAL DE LA PÁGINA
   ========================================================= */

function extractPageDate(text) {

  const normalized = normalizeText(text);

  const months = MONTHS.join("|");

  const patterns = [

    // resultados-triplex-30-septiembre-2026
    new RegExp(
      `resultados[-\\s]+triplex[-\\s]+(\\d{1,2})[-\\s]+(${months})[-\\s]+(\\d{4})`,
      "i"
    ),

    // 30 septiembre 2026
    new RegExp(
      `(\\d{1,2})\\s+(?:de\\s+)?(${months})\\s+(?:de\\s+)?(\\d{4})`,
      "i"
    ),

    // resultados del 30 de septiembre de 2026
    new RegExp(
      `resultados[^\\n]{0,100}?(\\d{1,2})\\s+(?:de\\s+)?(${months})\\s+(?:de\\s+)?(\\d{4})`,
      "i"
    )
  ];

  for (const regex of patterns) {

    const match = normalized.match(regex);

    if (!match) {
      continue;
    }

    const day = Number(match[1]);
    const month = MONTHS.indexOf(match[2]);
    const year = Number(match[3]);

    if (
      month >= 0 &&
      day >= 1 &&
      day <= 31 &&
      year >= 2020
    ) {
      return `${year}-${pad(month + 1)}-${pad(day)}`;
    }
  }

  return null;
}


/* =========================================================
   EXTRAER UN NÚMERO DE TRIPLEX
   ========================================================= */

function cleanTriplexNumber(value) {

  if (!value) {
    return null;
  }

  // Nos quedamos únicamente con números
  const digits = String(value).replace(/\D/g, "");

  if (digits.length === 3) {
    return digits;
  }

  // Por si la web devuelve "7"
  if (digits.length === 1) {
    return `00${digits}`;
  }

  if (digits.length === 2) {
    return `0${digits}`;
  }

  return null;
}


/* =========================================================
   EXTRAER RESULTADOS
   ========================================================= */

function extractResults(text) {

  const values = [null, null, null, null, null];

  const normalized = normalizeText(text);


  /*
   ---------------------------------------------------------
   MÉTODO 1
   Formato habitual:

   primer sorteo del Triplex: 1, 2, 3
   ---------------------------------------------------------
   */

  const sorteoWords = [
    "primer",
    "segundo",
    "tercer",
    "cuarto",
    "quinto"
  ];

  sorteoWords.forEach((word, index) => {

    const regex = new RegExp(
      `${word}\\s+sorteo\\s+del\\s+triplex[^\\d]{0,80}(\\d)\\s*[,\\s]\\s*(\\d)\\s*[,\\s]\\s*(\\d)`,
      "i"
    );

    const match = normalized.match(regex);

    if (match) {

      const result = `${match[1]}${match[2]}${match[3]}`;

      values[index] = cleanTriplexNumber(result);
    }
  });


  /*
   ---------------------------------------------------------
   MÉTODO 2

   Por si aparece:

   primer sorteo ... 123
   ---------------------------------------------------------
   */

  sorteoWords.forEach((word, index) => {

    if (values[index]) {
      return;
    }

    const regex = new RegExp(
      `${word}\\s+sorteo\\s+del\\s+triplex[^\\d]{0,100}(\\d{3})`,
      "i"
    );

    const match = normalized.match(regex);

    if (match) {
      values[index] = cleanTriplexNumber(match[1]);
    }
  });


  /*
   ---------------------------------------------------------
   MÉTODO 3

   Variaciones:

   Primer sorteo: 123
   Segundo sorteo: 456
   ---------------------------------------------------------
   */

  sorteoWords.forEach((word, index) => {

    if (values[index]) {
      return;
    }

    const regex = new RegExp(
      `${word}\\s+sorteo[^\\d]{0,100}(\\d{3})`,
      "i"
    );

    const match = normalized.match(regex);

    if (match) {
      values[index] = cleanTriplexNumber(match[1]);
    }
  });


  /*
   ---------------------------------------------------------
   MÉTODO 4

   Busca expresiones del tipo:

   1.º sorteo
   2.º sorteo
   3.º sorteo
   ---------------------------------------------------------
   */

  for (let index = 0; index < 5; index++) {

    if (values[index]) {
      continue;
    }

    const numeroSorteo = index + 1;

    const regex = new RegExp(
      `${numeroSorteo}\\s*(?:º|o|er|do|ro|to)?\\s*sorteo[^\\d]{0,100}(\\d{3})`,
      "i"
    );

    const match = normalized.match(regex);

    if (match) {
      values[index] = cleanTriplexNumber(match[1]);
    }
  }


  /*
   ---------------------------------------------------------
   MÉTODO 5

   Si la página contiene explícitamente:

   10:00 ... 123
   12:00 ... 456
   etc.

   Intentamos localizar el número después de la hora.
   ---------------------------------------------------------
   */

  DRAWS.forEach((draw, index) => {

    if (values[index]) {
      return;
    }

    const escapedTime = draw.time.replace(":", "\\:");

    const regex = new RegExp(
      `${escapedTime}[^\\d]{0,120}(\\d{3})`,
      "i"
    );

    const match = normalized.match(regex);

    if (match) {
      values[index] = cleanTriplexNumber(match[1]);
    }
  });


  /*
   ---------------------------------------------------------
   MÉTODO 6

   Último recurso.

   Buscamos frases que contengan "Triplex" y tres dígitos
   consecutivos.

   Solo se utiliza para los sorteos que todavía no hemos
   encontrado.
   ---------------------------------------------------------
   */

  const triplexMatches = [
    ...normalized.matchAll(
      /triplex[^0-9]{0,120}(\d{3})/gi
    )
  ];

  let fallbackIndex = 0;

  for (const match of triplexMatches) {

    if (fallbackIndex >= 5) {
      break;
    }

    while (
      fallbackIndex < 5 &&
      values[fallbackIndex]
    ) {
      fallbackIndex++;
    }

    if (fallbackIndex >= 5) {
      break;
    }

    const number = cleanTriplexNumber(match[1]);

    if (number) {
      values[fallbackIndex] = number;
      fallbackIndex++;
    }
  }


  return values;
}


/* =========================================================
   MOSTRAR TARJETAS
   ========================================================= */

function renderCards(values, selectedDate) {

  const now = new Date();

  const isToday =
    selectedDate === localDateString();

  resultsEl.innerHTML = DRAWS.map((draw, index) => {

    const value = values[index] || null;

    const drawTime =
      drawDateTime(selectedDate, draw.time);

    const selected =
      parseInputDate(selectedDate);

    const todayDate =
      parseInputDate(localDateString());

    const isFutureDay =
      selected > todayDate;

    const isPastDay =
      selected < todayDate;

    const isPast =
      now >= drawTime;

    const isNext =
      isToday &&
      !value &&
      now < drawTime;


    let badge = "";

    if (value) {

      badge =
        `<span class="badge">Resultado publicado</span>`;

    } else if (isFutureDay) {

      badge =
        `<span class="badge">Día no celebrado</span>`;

    } else if (isNext) {

      badge =
        `<span class="badge">Sorteo no celebrado</span>`;

    } else if (isPastDay || isPast) {

      badge =
        `<span class="badge">Pendiente de publicación</span>`;

    } else {

      badge =
        `<span class="badge">Pendiente</span>`;
    }


    return `
      <article class="card ${value ? "done" : ""} ${isNext ? "next" : ""}">

        <div class="card-info">

          <p class="draw-title">
            Sorteo ${draw.number}
          </p>

          <p class="draw-time">
            ${draw.time} h
          </p>

          ${badge}

        </div>

        <div class="card-number ${value ? "" : "pending"}">
          ${value || "Pendiente"}
        </div>

      </article>
    `;

  }).join("");
}


/* =========================================================
   CARGANDO
   ========================================================= */

function showLoading() {

  resultsEl.innerHTML = DRAWS.map(draw => `

    <article class="card">

      <div class="card-info">

        <p class="draw-title">
          Sorteo ${draw.number}
        </p>

        <p class="draw-time">
          ${draw.time} h
        </p>

      </div>

      <div class="card-number pending">
        ...
      </div>

    </article>

  `).join("");
}


/* =========================================================
   OBTENER RESULTADOS
   ========================================================= */

async function fetchResults(dateValue) {

  const slug =
    slugForDate(dateValue);

  const officialUrl =
    `https://www.juegosonce.es/resultados-triplex-${slug}`;


  /*
   r.jina.ai convierte la página oficial
   en texto accesible desde GitHub Pages.
  */

  const proxyUrl =
    `https://r.jina.ai/${officialUrl}?_=${Date.now()}`;


  const response =
    await fetch(proxyUrl, {

      method: "GET",

      cache: "no-store",

      headers: {
        "Cache-Control": "no-cache"
      }

    });


  if (!response.ok) {

    throw new Error(
      "No se ha encontrado una página de resultados para esa fecha."
    );
  }


  const text =
    await response.text();


  /*
   IMPORTANTE:
   Comprobamos que la página realmente corresponde
   al día seleccionado.
  */

  const pageDate =
    extractPageDate(text);


  if (
    pageDate &&
    pageDate !== dateValue
  ) {

    throw new Error(
      `Todavía no hay una página de resultados para el ${formatDate(dateValue)}.`
    );
  }


  if (!pageDate) {

    throw new Error(
      "No se ha podido verificar la fecha de la página de resultados."
    );
  }


  /*
   Extraemos los cinco resultados.
  */

  const values =
    extractResults(text);


  return {
    values,
    officialUrl
  };
}


/* =========================================================
   CARGAR RESULTADOS
   ========================================================= */

async function loadResults() {

  const selectedDate =
    dateInput.value;

  if (!selectedDate) {
    return;
  }


  refreshBtn.disabled = true;

  showLoading();


  statusEl.textContent =
    `Consultando resultados del ${formatDate(selectedDate)}...`;


  try {

    const {
      values,
      officialUrl
    } = await fetchResults(selectedDate);


    renderCards(
      values,
      selectedDate
    );


    const published =
      values.filter(Boolean).length;


    statusEl.innerHTML =
      `${published} de 5 resultados disponibles · ${formatDate(selectedDate)}. ` +
      `<a href="${officialUrl}" target="_blank" rel="noopener noreferrer">Fuente oficial</a>`;


  } catch (error) {

    renderCards(
      [],
      selectedDate
    );


    const isToday =
      selectedDate === localDateString();


    const selected =
      parseInputDate(selectedDate);

    const today =
      parseInputDate(localDateString());


    if (selected > today) {

      statusEl.textContent =
        "Ese día todavía no ha llegado.";

    } else if (isToday) {

      statusEl.textContent =
        "Todavía no hay resultados disponibles o la fuente no responde. Pulsa «Actualizar» para volver a intentarlo.";

    } else {

      statusEl.textContent =
        "No se han podido cargar los resultados de esa fecha.";
    }


    resultsEl.insertAdjacentHTML(
      "beforebegin",

      `
      <div class="error" id="errorBox">

        <strong>
          Consulta no disponible.
        </strong>

        <br>

        ${error.message}

      </div>
      `
    );


    setTimeout(() => {

      document
        .getElementById("errorBox")
        ?.remove();

    }, 5000);


  } finally {

    refreshBtn.disabled = false;

  }
}


/* =========================================================
   CAMBIAR FECHA
   ========================================================= */

function changeDate(days) {

  const date =
    parseInputDate(dateInput.value);

  date.setDate(
    date.getDate() + days
  );

  dateInput.value =
    localDateString(date);

  loadResults();
}


/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

dateInput.value =
  localDateString();


dateInput.addEventListener(
  "change",
  loadResults
);


refreshBtn.addEventListener(
  "click",
  loadResults
);


prevBtn.addEventListener(
  "click",
  () => changeDate(-1)
);


nextBtn.addEventListener(
  "click",
  () => changeDate(1)
);


todayBtn.addEventListener(
  "click",
  () => {

    dateInput.value =
      localDateString();

    loadResults();

  }
);


/* =========================================================
   ACTUALIZACIÓN AUTOMÁTICA
   =========================================================

   Mientras estamos viendo HOY,
   comprobamos cada 60 segundos.
*/

setInterval(() => {

  if (
    dateInput.value ===
    localDateString()
  ) {

    loadResults();

  }

}, 60000);


/* =========================================================
   PRIMERA CARGA
   ========================================================= */

loadResults();
