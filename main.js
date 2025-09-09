// main.js — Diary app logic
const STORAGE_KEY = "myDiaryEntries_v1";

let entries = []; // { id, text, mood, createdAt }

function $(s){ return document.querySelector(s); }
function $all(s){ return Array.from(document.querySelectorAll(s)); }

function formatDate(ts){
  const d = new Date(ts);
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour:'2-digit', minute:'2-digit' });
}

function loadEntries(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
    // ensure entries sorted descending (most recent first)
    entries.sort((a,b)=> b.createdAt - a.createdAt);
  }catch(e){
    console.error("Load error", e);
    entries = [];
  }
}

function saveEntries(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  updateLastSaved();
}

let saveTimer = null;
function updateLastSaved(){
  const el = $("#lastSaved");
  if(!el) return;
  if(saveTimer) clearTimeout(saveTimer);
  el.textContent = "Saved: " + new Date().toLocaleString();
  // subtle debounce UI change
  saveTimer = setTimeout(()=> { el.textContent = `Saved: ${new Date().toLocaleString()}`; }, 200);
}

function renderEntries(){
  const container = $("#entries");
  container.innerHTML = "";
  if(entries.length === 0){
    $("#emptyHint").style.display = "block";
    return;
  } else {
    $("#emptyHint").style.display = "none";
  }

  entries.forEach(entry => {
    const el = document.createElement("div"); el.className = "entry";
    const meta = document.createElement("div"); meta.className = "meta";
    const left = document.createElement("div");
    left.innerHTML = `<strong>${entry.mood ? escapeHtml(entry.mood) + " · " : ""}</strong>${formatDate(entry.createdAt)}`;
    const right = document.createElement("div");
    right.innerHTML = `<small>#${entry.id}</small>`;
    meta.appendChild(left); meta.appendChild(right);

    const text = document.createElement("div"); text.className = "text";
    text.textContent = entry.text;

    const controls = document.createElement("div"); controls.className = "controls";
    const editBtn = document.createElement("button"); editBtn.className = "small-btn"; editBtn.textContent = "Edit";
    const delBtn = document.createElement("button"); delBtn.className = "small-btn del"; delBtn.textContent = "Delete";
    const copyBtn = document.createElement("button"); copyBtn.className = "small-btn"; copyBtn.textContent = "Copy";

    editBtn.addEventListener("click", ()=> {
      populateEditorForEdit(entry.id);
    });
    delBtn.addEventListener("click", ()=> {
      if(confirm("Delete this entry?")) {
        entries = entries.filter(e => e.id !== entry.id);
        saveEntries();
        renderEntries();
      }
    });
    copyBtn.addEventListener("click", ()=> {
      navigator.clipboard?.writeText(entry.text).then(()=> alert("Copied text"));
    });

    controls.appendChild(editBtn);
    controls.appendChild(copyBtn);
    controls.appendChild(delBtn);

    el.appendChild(meta);
    el.appendChild(text);
    el.appendChild(controls);
    container.appendChild(el);
  });
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[m]);
}

function addEntryFromEditor(){
  const ta = $("#entryText");
  const mood = $("#moodInput").value.trim();
  const text = ta.value.trim();
  if(!text) return alert("Write something before adding.");
  const id = Date.now().toString(36);
  const createdAt = Date.now();
  entries.unshift({ id, text, mood, createdAt });
  ta.value = "";
  $("#moodInput").value = "";
  saveEntries();
  renderEntries();
}

function populateEditorForEdit(id){
  const entry = entries.find(e => e.id === id);
  if(!entry) return;
  $("#entryText").value = entry.text;
  $("#moodInput").value = entry.mood || "";
  // Remove entry being edited, new save will create updated one (keeps createdAt fresh or preserve original - we preserve original)
  if(confirm("Save changes will overwrite the selected entry when you press 'Add Entry'. Click OK to prepare edit.")){
    // mark that next Add should update instead of insert - we'll store editingId
    editingId = id;
    $("#addBtn").textContent = "Save Changes";
    // keep original createdAt: when saving we will replace
  }
}

let editingId = null;
function handleAddOrSave(){
  const ta = $("#entryText");
  const mood = $("#moodInput").value.trim();
  const text = ta.value.trim();
  if(!text) return alert("Write something before adding.");
  if(editingId){
    // update existing
    const idx = entries.findIndex(e => e.id === editingId);
    if(idx === -1) { editingId = null; $("#addBtn").textContent = "Add Entry"; return; }
    entries[idx].text = text;
    entries[idx].mood = mood;
    // keep createdAt unchanged so history remains
    // move updated entry to top (optional)
    const updated = entries.splice(idx,1)[0];
    entries.unshift(updated);
    editingId = null;
    $("#addBtn").textContent = "Add Entry";
  } else {
    addEntryFromEditor();
    return;
  }
  // finalize after editing
  $("#entryText").value = "";
  $("#moodInput").value = "";
  saveEntries();
  renderEntries();
}

function exportJSON(){
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `diary-entries-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function importJSONFile(file){
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if(!Array.isArray(data)) return alert("Invalid JSON: expected array of entries");
      // Basic validation and normalize fields
      data.forEach(item => {
        if(!item.id) item.id = (Date.now() + Math.random()).toString(36);
        if(!item.createdAt) item.createdAt = Date.now();
        if(!item.text) item.text = "";
      });
      // merge (append) — avoid duplicates by id
      const ids = new Set(entries.map(e=>e.id));
      data.forEach(d => { if(!ids.has(d.id)) entries.push(d); });
      entries.sort((a,b)=> b.createdAt - a.createdAt);
      saveEntries();
      renderEntries();
      alert("Imported entries.");
    } catch(err){
      alert("Import error: " + err.message);
    }
  };
  reader.readAsText(file);
}

function exportBookPDF(){
  if(entries.length === 0) return alert("No entries to export.");
  // Use jsPDF (support both window.jspdf.jsPDF and window.jsPDF)
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jsPDF ? window.jsPDF : null);
  if(!jsPDFCtor) return alert("jsPDF not available.");

  const doc = new jsPDFCtor({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableWidth = pageWidth - margin*2;
  const lineHeight = 14;
  const fontSizeHeading = 16;
  const fontSizeBody = 11;

  // sort entries ascending for a 'book' chronological order (oldest first)
  const toExport = [...entries].sort((a,b)=> a.createdAt - b.createdAt);

  toExport.forEach((entry, idx) => {
    if(idx > 0) doc.addPage();
    // header: date + mood centered
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    const header = (entry.mood ? `${entry.mood} — ` : "") + formatDate(entry.createdAt);
    // center header
    const headerWidth = doc.getTextWidth(header);
    doc.text(header, (pageWidth - headerWidth)/2, 60);

    // draw a thin divider
    doc.setLineWidth(0.5);
    doc.line(margin, 70, pageWidth - margin, 70);

    // body: wrap text
    doc.setFontSize(fontSizeBody);
    doc.setFont(undefined, "normal");
    const body = entry.text.replace(/\t/g, '    ');
    const lines = doc.splitTextToSize(body, usableWidth);
    // paginate within entry if needed
    let y = 90;
    const bottomLimit = pageHeight - margin;
    for(let i=0;i<lines.length;i++){
      if(y + lineHeight > bottomLimit){
        doc.addPage();
        y = margin;
      }
      doc.text(lines[i], margin, y);
      y += lineHeight;
    }

    // small footer on each entry page with page number
    const pageNum = doc.getCurrentPageInfo ? doc.getCurrentPageInfo().pageNumber : (doc.internal.getNumberOfPages ? doc.internal.getNumberOfPages() : null);
    const pageStr = `— Page ${pageNum} —`;
    doc.setFontSize(9);
    const footerW = doc.getTextWidth(pageStr);
    doc.text(pageStr, (pageWidth - footerW)/2, pageHeight - 18);
  });

  const fname = `diary-book-${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(fname);
}

function wireUp(){
  $("#addBtn").addEventListener("click", handleAddOrSave);
  $("#exportJsonBtn").addEventListener("click", exportJSON);
  $("#exportPdfBtn").addEventListener("click", exportBookPDF);
  $("#importJsonBtn").addEventListener("click", ()=> $("#importFile").click());
  $("#importFile").addEventListener("change", (e)=> {
    const file = e.target.files && e.target.files[0];
    if(file) importJSONFile(file);
    e.target.value = "";
  });

  // Enter+Ctrl to quick-add
  $("#entryText").addEventListener("keydown", (ev)=> {
    if(ev.ctrlKey && ev.key === "Enter"){
      handleAddOrSave();
    }
  });
}

document.addEventListener("DOMContentLoaded", ()=> {
  loadEntries();
  renderEntries();
  wireUp();
  updateLastSaved();
});