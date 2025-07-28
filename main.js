"use strict";

let dataAll = {
  pib: {},
  sv: {},
  pop: {}
};

let availableYears = [];

let countries = [
  "BE","BG","CZ","DK","DE","EE","IE","EL","ES","FR","HR","IT",
  "CY","LV","LT","LU","HU","MT","NL","AT","PL","PT","RO","SI",
  "SK","FI","SE"
];


   // Functie pentru citirea datelor din fișierul JSON local (care este un array de obiecte)
async function loadData() {
  try {
    const response = await fetch("./media/eurostat.json");
    if (!response.ok) {
      throw new Error("Eroare la încărcarea fișierului local eurostat.json");
    }
    const jsonData = await response.json();
    parseLocalJson(jsonData);
  } catch (err) {
    console.error("Eroare încărcare date:", err);
  }
}

  // Functie pentru conversia array-ului la structura necesara
function parseLocalJson(jsonArray) {
  dataAll = {
    pib: {},
    sv: {},
    pop: {}
  };

  let yearsSet = new Set();

  jsonArray.forEach(item => {
    const { tara, an, indicator, valoare } = item;

    let dataKey = "";
    if (indicator === "SV") {
      dataKey = "sv";
    } else if (indicator === "PIB") {
      dataKey = "pib";
    } else if (indicator === "POP") {
      dataKey = "pop";
    } else {
      return;
    }

    if (!dataAll[dataKey][tara]) {
      dataAll[dataKey][tara] = {};
    }

    dataAll[dataKey][tara][an] = valoare;
    yearsSet.add(an);
  });

  availableYears = Array.from(yearsSet).sort((a, b) => parseInt(a) - parseInt(b));
}

  // Initzializam evenimentele
window.addEventListener("load", async () => {
  await loadData();
  populateYearSelects(); 

  document.getElementById("btnStopAnimation").style.display = "none";

  document.getElementById("btnDrawChart").addEventListener("click", drawLineChart);
  document.getElementById("btnBubbleChart").addEventListener("click", drawBubbleChart);
  document.getElementById("btnAnimateBubbleChart").addEventListener("click", animateBubbleChart);
  document.getElementById("btnGenerateTable").addEventListener("click", generateTable);
  document.getElementById("btnStopAnimation").addEventListener("click", stopAnimation);
  document.getElementById("btnResetBubbleChart").addEventListener("click", resetBubbleChart);
});

  // Populam select cu anii disponibili
function populateYearSelects() {
  const yearSelect = document.getElementById("yearSelect");
  const yearSelectTable = document.getElementById("yearSelectTable");

  yearSelect.innerHTML = "";
  yearSelectTable.innerHTML = "";

  availableYears.forEach(year => {
    let opt1 = document.createElement("option");
    opt1.value = year;
    opt1.textContent = year;
    yearSelect.appendChild(opt1);

    let opt2 = document.createElement("option");
    opt2.value = year;
    opt2.textContent = year;
    yearSelectTable.appendChild(opt2);
  });
}

  // Desenarea graficului (SVG)
function drawLineChart() {
  const indicator = document.getElementById("indicatorSelect").value; 
  const country = document.getElementById("countrySelect").value;     

  const values = dataAll[indicator][country];
  if (!values) {
    console.error("Nu există date pentru indicatorul / țara selectată!");
    return;
  }

  let dataPoints = Object.keys(values).map(year => {
    return { year: parseInt(year), value: values[year] };
  });

  dataPoints.sort((a,b) => a.year - b.year);
  const svg = document.getElementById("lineChart");
  const width = parseInt(svg.getAttribute("width"));
  const height = parseInt(svg.getAttribute("height"));

  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const minValue = Math.min(...dataPoints.map(d => d.value));
  const maxValue = Math.max(...dataPoints.map(d => d.value));
  
  function xScale(year) {
    let minYear = dataPoints[0].year;
    let maxYear = dataPoints[dataPoints.length - 1].year;
    return margin.left + ((year - minYear) / (maxYear - minYear)) * plotWidth;
  }

  function yScale(val) {
    return height - margin.bottom - ((val - minValue) / (maxValue - minValue)) * plotHeight;
  }

  for (let i = 0; i < dataPoints.length - 1; i++) {
    let lineElem = document.createElementNS("http://www.w3.org/2000/svg", "line");
    lineElem.setAttribute("x1", xScale(dataPoints[i].year));
    lineElem.setAttribute("y1", yScale(dataPoints[i].value));
    lineElem.setAttribute("x2", xScale(dataPoints[i+1].year));
    lineElem.setAttribute("y2", yScale(dataPoints[i+1].value));
    lineElem.setAttribute("stroke", "white");
    lineElem.setAttribute("stroke-width", "2");
    svg.appendChild(lineElem);
  }

  dataPoints.forEach(dp => {
    let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", xScale(dp.year));
    circle.setAttribute("cy", yScale(dp.value));
    circle.setAttribute("r", 4);
    circle.setAttribute("fill", "red");

    circle.addEventListener("mouseover", (evt) => {
      const tooltip = document.getElementById("tooltip");
      tooltip.textContent = `An: ${dp.year}, Valoare: ${dp.value}`;
      tooltip.classList.remove("hidden");
      tooltip.style.left = (evt.pageX + 10) + "px";
      tooltip.style.top = (evt.pageY + 10) + "px";
    });
    circle.addEventListener("mousemove", (evt) => {
      const tooltip = document.getElementById("tooltip");
      tooltip.style.left = (evt.pageX + 10) + "px";
      tooltip.style.top = (evt.pageY + 10) + "px";
    });
    circle.addEventListener("mouseout", () => {
      document.getElementById("tooltip").classList.add("hidden");
    });

    svg.appendChild(circle);
  });
}

  // Bubble Chart (Canvas)
function drawBubbleChart() {
  const year = document.getElementById("yearSelect").value;
  const canvas = document.getElementById("bubbleCanvas");
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  countries.forEach(country => {
    const svVal  = dataAll["sv"][country]?.[year];   
    const pibVal = dataAll["pib"][country]?.[year]; 
    const popVal = dataAll["pop"][country]?.[year];

    if (!svVal || !pibVal || !popVal) return;

    const x = scaleValue(svVal, 60, 90, 0, canvas.width);
    const offsetY = 50;
    const y = (canvas.height - offsetY) - scaleValue(pibVal, 10000, 100000, 0, canvas.height - offsetY);
    const r = scaleValue(popVal, 500000, 80000000, 5, 40);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = "rgba(0, 0, 255, 0.5)";
    ctx.fill();
    ctx.closePath();
  });
}

// Functie de scalare
function scaleValue(val, minIn, maxIn, minOut, maxOut) {
  if (val < minIn) val = minIn;
  if (val > maxIn) val = maxIn;
  return ((val - minIn) / (maxIn - minIn)) * (maxOut - minOut) + minOut;
}

  // Animație Bubble Chart
let animationInterval = null;
let idx = 0;
function animateBubbleChart() {
  document.getElementById("btnStopAnimation").style.display = "inline-block";
  if (idx >= availableYears.length) {
    idx = 0;
  }
  clearInterval(animationInterval);

  animationInterval = setInterval(() => {
    let year = availableYears[idx];
    document.getElementById("yearSelect").value = year;
    drawBubbleChart();

    idx++;
    if (idx >= availableYears.length) {
      clearInterval(animationInterval);
      document.getElementById("btnStopAnimation").style.display = "none";
    }
  }, 800);
}

function stopAnimation() {
  clearInterval(animationInterval);
}

function resetBubbleChart() {
  stopAnimation();  
  document.getElementById("yearSelect").value = availableYears[0];

  const canvas = document.getElementById("bubbleCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

  // Generare tabel colorat
function generateTable() {
  const year = document.getElementById("yearSelectTable").value;
  const tbody = document.querySelector("#dataTable tbody");

  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  let sumPib = 0, sumSv = 0, sumPop = 0;
  let countPib = 0, countSv = 0, countPop = 0;

  countries.forEach(ctry => {
    const valPib = dataAll["pib"][ctry]?.[year];
    const valSv  = dataAll["sv"][ctry]?.[year];
    const valPop = dataAll["pop"][ctry]?.[year];

    if (valPib) { sumPib += valPib; countPib++; }
    if (valSv)  { sumSv  += valSv;  countSv++;  }
    if (valPop) { sumPop += valPop; countPop++; }
  });

  let avgPib = (countPib > 0) ? sumPib / countPib : 0;
  let avgSv  = (countSv  > 0) ? sumSv  / countSv  : 0;
  let avgPop = (countPop > 0) ? sumPop / countPop : 0;

  countries.forEach(ctry => {
    let tr = document.createElement("tr");

    let tdCountry = document.createElement("td");
    tdCountry.textContent = ctry;
    tr.appendChild(tdCountry);

    let valPib = dataAll["pib"][ctry]?.[year] || 0;
    let valSv  = dataAll["sv"][ctry]?.[year]  || 0;
    let valPop = dataAll["pop"][ctry]?.[year] || 0;

    let tdPib = document.createElement("td");
    tdPib.textContent = valPib.toFixed(2);
    tdPib.style.backgroundColor = colorByDistance(valPib, avgPib);
    tr.appendChild(tdPib);

    let tdSv = document.createElement("td");
    tdSv.textContent = valSv.toFixed(2);
    tdSv.style.backgroundColor = colorByDistance(valSv, avgSv);
    tr.appendChild(tdSv);

    let tdPop = document.createElement("td");
    tdPop.textContent = valPop.toFixed(2);
    tdPop.style.backgroundColor = colorByDistance(valPop, avgPop);
    tr.appendChild(tdPop);

    tbody.appendChild(tr);
  });
}

// Functie culoare tabel
function colorByDistance(val, avg) {
  if (avg < 1e-10) avg = 1e-10;

  let x = val / avg;
  if (x < 0.5) x = 0.5;
  if (x > 1.5) x = 1.5;

  let ratio = (x - 0.5) / 1.0;

  let r = 255 - Math.round(255 * ratio);
  let g = Math.round(255 * ratio);
  let b = 0;

  return `rgb(${r}, ${g}, ${b})`;
}

