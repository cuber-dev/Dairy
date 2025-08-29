 const diarySchema = {
  name: { label: "Name", type: "text" },
  nickname: { label: "Nickname", type: "text" },
  age: { label: "Age", type: "number" },
  birthday: { label: "Birthday", type: "date" },
  favColor: { label: "Favourite Colour", type: "text" },
  favFood: { label: "Favourite Foods", type: "list", placeholder: "Add food..." },
  favDrink: { label: "Favourite Drink", type: "text" },
  favGame: { label: "Favourite Game", type: "text" },
  favMovie: { label: "Favourite Movie", type: "text" },
  favSong: { label: "Favourite Song", type: "text" },
  favHobby: { label: "Favourite Hobby", type: "text" },
  favSubject: { label: "Favourite Subject", type: "text" },
  bestFriends: { label: "Best Friends", type: "list", placeholder: "Add friend..." },
  mostApp: { label: "Most Used App", type: "text" },
  mostThing: { label: "Thing I Do the Most", type: "text" },
  bestMemories: { label: "Best Memories", type: "list", placeholder: "Add memory..." },
  worstExp: { label: "Worst Experiences", type: "list", placeholder: "Add experience..." },
  fear: { label: "Biggest Fear", type: "text" },
  dreamJob: { label: "Dream Job", type: "text" },
  dreamPlace: { label: "Dream Place to Visit", type: "text" },
  cantLive: { label: "One Thing I Can’t Live Without", type: "text" },
  strength: { label: "My Strength", type: "text" },
  weakness: { label: "My Weakness", type: "text" },
  happy: { label: "What Makes Me Happy", type: "text" },
  sad: { label: "What Makes Me Sad", type: "text" },
  goal: { label: "Goal for This Year", type: "text" }
};


const STORAGE_KEY = "diaryData";
let diary = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

function initDiaryApp() {
  const container = document.querySelector(".card");
  container.innerHTML = ""; // ensure empty

  // Build UI dynamically from schema
  Object.entries(diarySchema).forEach(([key, field]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "field-wrapper";

    const label = document.createElement("label");
    label.textContent = field.label + (field.type === "list" ? " (List):" : field.type === "checklist" ? " (Checklist):" : ":");
    wrapper.appendChild(label);

    if (field.type === "list") {
      const input = document.createElement("input");
      input.type = "text";
      input.id = `${key}Input`;
      input.placeholder = field.placeholder || `Add ${field.label.toLowerCase()}...`;
      input.className = "list-input";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.action = "addList";
      btn.dataset.key = key;
      btn.textContent = "Add";

      const listDiv = document.createElement("div");
      listDiv.id = `${key}List`;
      listDiv.className = "list-container";

      wrapper.appendChild(input);
      wrapper.appendChild(btn);
      wrapper.appendChild(listDiv);
    }
    else if (field.type === "checklist") {
      // checklist: input + add button + list with checkbox
      const input = document.createElement("input");
      input.type = "text";
      input.id = `${key}Input`;
      input.placeholder = field.placeholder || `Add ${field.label.toLowerCase()}...`;
      input.className = "list-input";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.action = "addChecklist";
      btn.dataset.key = key;
      btn.textContent = "Add";

      const listDiv = document.createElement("div");
      listDiv.id = `${key}List`;
      listDiv.className = "list-container checklist-container";

      wrapper.appendChild(input);
      wrapper.appendChild(btn);
      wrapper.appendChild(listDiv);
    }
    else {
      const input = document.createElement("input");
      input.type = field.type || "text";
      input.id = key;
      input.className = "normal-input";
      wrapper.appendChild(input);

      // auto-save on change/input
      input.addEventListener("input", () => {
        diary[key] = input.value.trim();
        autoSave();
      });
    }

    container.appendChild(wrapper);
  });

  // controls area (import/export)
  const controls = document.createElement("div");
  controls.className = "controls";

  // import file input
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";
  importInput.id = "importJson";
  importInput.style.display = "none";

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.textContent = "Import JSON";
  importBtn.addEventListener("click", () => importInput.click());

  importInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (typeof data === "object" && data !== null) {
          diary = data;
          saveDiary(); // persist
          renderDiary(); // update UI
          alert("Imported diary JSON ✅");
        } else {
          alert("Invalid JSON structure");
        }
      } catch (err) {
        alert("Error parsing JSON: " + err.message);
      }
    };
    reader.readAsText(file);
    importInput.value = ""; // clear
  });

  // export JSON
  const exportJsonBtn = document.createElement("button");
  exportJsonBtn.type = "button";
  exportJsonBtn.textContent = "Export JSON";
  exportJsonBtn.addEventListener("click", exportJSON);

  // export PDF
  const exportPdfBtn = document.createElement("button");
  exportPdfBtn.type = "button";
  exportPdfBtn.textContent = "Export PDF";
  exportPdfBtn.addEventListener("click", exportPDF);

  // last saved display
  const lastSaved = document.createElement("div");
  lastSaved.id = "lastSaved";
  lastSaved.className = "last-saved";

  controls.appendChild(importBtn);
  controls.appendChild(exportJsonBtn);
  controls.appendChild(exportPdfBtn);
  controls.appendChild(importInput);
  controls.appendChild(lastSaved);

  container.appendChild(controls);

  // initialize list and checklist bindings & render
  bindListButtons();
  renderDiary();
  updateLastSaved();
}

function bindListButtons() {
  // delegate add-list and add-checklist buttons
  document.querySelectorAll("button[data-action='addList']").forEach(btn => {
    btn.addEventListener("click", () => {
      addToList(btn.dataset.key);
    });
  });
  
}

// ---------- Render helpers ----------
function renderDiary() {
  Object.entries(diarySchema).forEach(([key, field]) => {
    if (field.type === "list") {
      renderList(key, diary[key] || []);
    } else if (field.type === "checklist") {
      renderChecklist(key, diary[key] || []);
    } else {
      const el = document.getElementById(key);
      if (el) el.value = diary[key] || "";
    }
  });
}

// list rendering
function renderList(key, list = []) {
  const container = document.getElementById(key + "List");
  if (!container) return;
  container.innerHTML = "";
  list.forEach((item, index) => {
    const itemEl = document.createElement("div");
    itemEl.className = "list-item";

    const span = document.createElement("span");
    span.textContent = item;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "small-btn";
    del.textContent = "x";
    del.addEventListener("click", () => {
      removeFromList(key, index);
    });

    itemEl.appendChild(span);
    itemEl.appendChild(del);
    container.appendChild(itemEl);
  });
}

// ---------- List operations ----------
function addToList(key) {
  const input = document.getElementById(key + "Input");
  if (!input || !input.value.trim()) return;
  if (!diary[key]) diary[key] = [];
  diary[key].push(input.value.trim());
  input.value = "";
  renderList(key, diary[key]);
  autoSave();
}

function removeFromList(key, index) {
  if (!diary[key]) return;
  diary[key].splice(index, 1);
  renderList(key, diary[key]);
  autoSave();
}

// ---------- Persistence ----------
function saveDiary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diary));
  updateLastSaved();
}

let saveTimeout = null;
function autoSave() {
  // debounce saves so rapid typing doesn't thrash localStorage
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDiary();
    saveTimeout = null;
  }, 300); // 300ms debounce
}

function updateLastSaved() {
  const el = document.getElementById("lastSaved");
  if (!el) return;
  const now = new Date();
  el.textContent = `Saved: ${now.toLocaleString()}`;
}

// initial save wrapper (useful after import)
function persistAndRender() {
  saveDiary();
  renderDiary();
}

// ---------- Import / Export ----------
function exportJSON() {
  const dataStr = JSON.stringify(diary, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `diary-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Export PDF — requires jsPDF (add script in HTML)
// If jsPDF not available, fallback to printing the content (opens print dialog)
function exportPDF() {
  // Create a simple text version of diary for PDF
  const lines = [];
  Object.entries(diarySchema).forEach(([key, field]) => {
    lines.push(field.label + ":");
    const val = diary[key];
    if (val === undefined || val === null || val === "") {
      lines.push("  -");
    } else if (Array.isArray(val)) {
      if (field.type === "checklist") {
        val.forEach(it => lines.push(`  - [${it.done ? "x" : " "}] ${it.text}`));
      } else {
        val.forEach(it => lines.push("  - " + it));
      }
    } else {
      lines.push("  " + String(val));
    }
    lines.push(""); // blank line
  });

  const text = lines.join("\n");

  if (window.jspdf && window.jspdf.jsPDF) {
    // newer jspdf builds expose jspdf.jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxLineWidth = pageWidth - margin * 2;
    const linesForDoc = doc.splitTextToSize(text, maxLineWidth);
    doc.setFontSize(11);
    doc.text(linesForDoc, margin, 20);
    doc.save(`diary-${new Date().toISOString().slice(0,10)}.pdf`);
  } else if (window.jsPDF) {
    // older global jsPDF
    const doc = new window.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const linesForDoc = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.setFontSize(11);
    doc.text(linesForDoc, margin, 20);
    doc.save(`diary-${new Date().toISOString().slice(0,10)}.pdf`);
  } else {
    // fallback: open printable window with the text
    const w = window.open("", "_blank");
    w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap;">${escapeHtml(text)}</pre>`);
    w.document.close();
    w.print();
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (m) {
    return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[m];
  });
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", initDiaryApp);