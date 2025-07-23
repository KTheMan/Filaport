// --- Node.js profile generator for CLI/batch use ---
// This is NOT used in the browser, but is provided for CLI/Node.js batch conversion.
// Usage: const { generateOrcaProfile } = require('./app.js');
// const newProfile = await generateOrcaProfile(userProfile, 'PLA', 'Inland PLA+');

if (typeof module !== 'undefined' && module.exports) {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  // Map plastic types to OrcaSlicer base profile filenames
  const baseProfileMap = {
    PLA: 'fdm_filament_pla.json',
    PETG: 'fdm_filament_petg.json',
    ABS: 'fdm_filament_abs.json',
    NYLON: 'fdm_filament_nylon.json'
    // Add more as needed
  };

  // List of required fields for a valid OrcaSlicer profile
  const requiredFields = [
    'type', 'name', 'inherits', 'filament_diameter', 'filament_density'
    // Add more as needed
  ];

  // Sensible defaults for required fields
  const defaultFieldValues = {
    type: 'filament',
    filament_diameter: '1.75',
    filament_density: '1.24'
    // Add more as needed
  };

  // OS-aware default OrcaSlicer system filament folder
  function getOrcaSystemFilamentFolder() {
    const home = os.homedir();
    if (process.platform === 'win32') {
      return path.join(home, 'AppData', 'Roaming', 'OrcaSlicer', 'system', 'OrcaFilamentLibrary', 'filament', 'base');
    } else if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'OrcaSlicer', 'system', 'OrcaFilamentLibrary', 'filament', 'base');
    } else {
      // Linux
      return path.join(home, '.config', 'OrcaSlicer', 'system', 'OrcaFilamentLibrary', 'filament', 'base');
    }
  }

  // Load a base profile from disk
  function loadBaseProfile(plasticType) {
    const folder = getOrcaSystemFilamentFolder();
    const file = baseProfileMap[plasticType.toUpperCase()];
    if (!file) throw new Error(`Unknown plastic type: ${plasticType}`);
    const filePath = path.join(folder, file);
    if (!fs.existsSync(filePath)) throw new Error(`Base profile not found: ${filePath}`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  // Merge logic
  function generateOrcaProfile(source, plasticType, profileName) {
    const base = loadBaseProfile(plasticType);
    let result = {
      type: 'filament',
      name: profileName,
      inherits: baseProfileMap[plasticType.toUpperCase()].replace('.json', '')
    };

    // Copy/override fields from source
    for (const key in source) {
      if (['type', 'name', 'inherits'].includes(key)) continue;
      if (!base[key] || JSON.stringify(source[key]) !== JSON.stringify(base[key])) {
        result[key] = source[key];
      }
    }

    // Fill required fields if missing
    for (const field of requiredFields) {
      if (!(field in result) && !(field in base)) {
        result[field] = defaultFieldValues[field] || '';
      }
    }

    return result;
  }

  module.exports = { generateOrcaProfile };
}

// --- Browser stub for webgui ---
// (No-op, browser logic is handled elsewhere)
// Drag & drop and click to select logic for default physical printer ini/json
const defaultPhysicalZone = document.getElementById('default-physical-printer-zone');
const defaultPhysicalInput = document.getElementById('default-physical-printer-ini');
const defaultPhysicalText = document.getElementById('default-physical-printer-text');
if (defaultPhysicalZone && defaultPhysicalInput) {
  defaultPhysicalZone.addEventListener('click', () => defaultPhysicalInput.click());
  defaultPhysicalZone.addEventListener('dragover', e => {
    e.preventDefault();
    defaultPhysicalZone.style.background = '#e6fbe6';
  });
  defaultPhysicalZone.addEventListener('dragleave', e => {
    e.preventDefault();
    defaultPhysicalZone.style.background = '#f3fdf7';
  });
  defaultPhysicalZone.addEventListener('drop', e => {
    e.preventDefault();
    defaultPhysicalZone.style.background = '#f3fdf7';
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      defaultPhysicalInput.files = e.dataTransfer.files;
      defaultPhysicalText.textContent = e.dataTransfer.files[0].name;
    }
  });
  defaultPhysicalInput.addEventListener('change', function() {
    if (defaultPhysicalInput.files && defaultPhysicalInput.files.length) {
      defaultPhysicalText.textContent = defaultPhysicalInput.files[0].name;
    } else {
      defaultPhysicalText.textContent = 'Drag & drop Physical Printer INI/JSON here\nor click to select (optional)';
    }
  });
}
import {
  systemDirectories,
  illegalChars,
  parameterMap,
  multivalueParams,
  filamentTypes,
  defaultMVS,
  speedSequence,
  speedParams,
  seamPositions,
  infillTypes,
  supportStyles,
  supportPatterns,
  interfacePatterns,
  gcodeFlavors,
  hostTypes,
  zhopEnforcement,
  thumbnailFormat
} from './hierarchy.js';

// Placeholder for main logic
// Next steps: INI parsing, conversion, UI event handling



const iniFilesInput = document.getElementById('ini-files');
const fileOptionsDiv = document.getElementById('file-options');
const fileListCard = document.getElementById('file-list-card');


const summaryDiv = document.getElementById('summary');
const outputDiv = document.getElementById('output');
const downloadAllBtn = document.getElementById('download-all');
const fileDropZone = document.getElementById('file-drop-zone');
const fileDropText = document.getElementById('file-drop-text');

let lastResults = [];
let selectedFiles = [];

// User-configurable base profile directory (browser only, default to empty)
let userBaseProfileDir = '';


// OS-level detection for default OrcaSlicer base profile directory (browser best-guess)
function guessBaseProfileDir() {
  let platform = navigator.platform.toLowerCase();
  let home = '';
  // Try to get home directory from environment (works in some browsers)
  if (window.process && window.process.env && window.process.env.HOME) {
    home = window.process.env.HOME;
  } else if (window.process && window.process.env && window.process.env.USERPROFILE) {
    home = window.process.env.USERPROFILE;
  } else if (typeof window.require === 'function') {
    // Electron/Node integration
    try {
      const os = window.require('os');
      home = os.homedir();
    } catch {}
  } else {
    // Fallback: try to guess from username in path
    let user = '';
    if (navigator.userAgent.match(/windows/i)) {
      user = (navigator.userAgent.match(/\\Users\\([^\\]+)/i) || [])[1] || '';
      if (!user && window.location.pathname.match(/\/Users\/([^\/]+)/)) {
        user = window.location.pathname.match(/\/Users\/([^\/]+)/)[1];
      }
      if (user) home = `C:/Users/${user}`;
    }
  }
  // Default to empty if not found
  if (!home) home = '~';
  // Suggest path based on platform
  if (platform.startsWith('win')) {
    return home + '/AppData/Roaming/OrcaSlicer/system/OrcaFilamentLibrary/filament/base';
  } else if (platform.startsWith('mac') || platform.includes('darwin')) {
    return home + '/Library/Application Support/OrcaSlicer/system/OrcaFilamentLibrary/filament/base';
  } else {
    // Linux or unknown
    return home + '/.config/OrcaSlicer/system/OrcaFilamentLibrary/filament/base';
  }
}

// UI for user to confirm/change base profile directory (unified UX)
function showBaseProfileDirPrompt() {
  let promptDiv = document.getElementById('base-profile-dir-prompt');
  if (!promptDiv) {
    promptDiv = document.createElement('div');
    promptDiv.id = 'base-profile-dir-prompt';
    promptDiv.style = 'margin: 16px 0 24px 0; padding: 16px 18px; background: #f3f7fd; border: 1.5px solid #b6c6e3; border-radius: 10px; max-width: 650px; font-family: inherit; font-size: 1em; box-shadow: 0 2px 8px rgba(25, 118, 210, 0.04)';
    const suggestedPath = guessBaseProfileDir();
    promptDiv.innerHTML = `
      <div style="font-weight:600; font-size:1.08em; color:#1976d2; margin-bottom:6px; letter-spacing:0.01em;">Base Profile Directory</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <input id="base-profile-dir-input" type="text" style="flex:1 1 0; min-width:180px; max-width:420px; padding:7px 12px; border:1.2px solid #b6c6e3; border-radius:6px; font-size:1em; font-family:inherit; background:#fff; color:#222;" placeholder="Paste path to OrcaSlicer base profiles folder" value="${suggestedPath}">
        <button id="base-profile-dir-btn" style="background:#1976d2; color:#fff; border:none; border-radius:6px; padding:7px 18px; font-size:1em; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.07); transition:background 0.2s;">Set</button>
      </div>
      <div style="font-size:0.93em;color:#888;margin-top:7px;line-height:1.5;">This is where the app will look for base profiles (e.g. <code>fdm_filament_pla.json</code>). You can change this if your OrcaSlicer is installed elsewhere.</div>
    `;
    document.querySelector('.container').insertBefore(promptDiv, document.querySelector('form'));
    document.getElementById('base-profile-dir-btn').onclick = function() {
      userBaseProfileDir = document.getElementById('base-profile-dir-input').value.trim();
      if (userBaseProfileDir) {
        document.getElementById('base-profile-dir-input').style.background = '#e6fbe6';
      }
    };
    // Set initial value
    userBaseProfileDir = suggestedPath;
  }
}

showBaseProfileDirPrompt();

// --- Debug toggle in lower left corner ---
let debugMode = false;
function setDebugMode(on) {
  debugMode = !!on;
  document.body.classList.toggle('debug-on', debugMode);
  const btn = document.getElementById('debug-toggle');
  if (btn) {
    if (debugMode) {
      btn.style.background = '#1976d2';
      btn.style.color = '#fff';
      btn.style.border = '1.5px solid #1976d2';
      btn.textContent = '🐞 Debug (On)';
    } else {
      btn.style.background = '#fffbe6';
      btn.style.color = '#1976d2';
      btn.style.border = '1.5px solid #ffe082';
      btn.textContent = '🐞 Debug';
    }
  }
  if (debugMode) {
    if (!document.getElementById('debug-log')) {
      const dbg = document.createElement('div');
      dbg.id = 'debug-log';
      dbg.style = 'position:fixed;bottom:60px;left:16px;z-index:1000;background:#fffbe6;border:1.5px solid #ffe082;padding:10px 16px 10px 10px;border-radius:8px;max-width:44vw;max-height:44vh;overflow:auto;font-size:0.97em;box-shadow:0 2px 8px rgba(0,0,0,0.08);color:#333;';
      dbg.innerHTML = '<b>Debug mode enabled.</b><br><span style="font-size:0.95em;color:#888;">Conversion and error details will appear here.</span>';
      document.body.appendChild(dbg);
    }
  } else {
    const dbg = document.getElementById('debug-log');
    if (dbg) dbg.remove();
  }
}

function setupDebugToggle() {
  if (document.getElementById('debug-toggle')) return;
  const btn = document.createElement('button');
  btn.id = 'debug-toggle';
  btn.textContent = '🐞 Debug';
  btn.title = 'Toggle debug mode';
  btn.style = 'position:fixed;bottom:16px;left:16px;z-index:1001;background:#fffbe6;color:#1976d2;border:1.5px solid #ffe082;border-radius:8px;padding:7px 18px;font-size:1em;box-shadow:0 2px 8px rgba(25,118,210,0.07);cursor:pointer;transition:background 0.2s;';
  btn.onclick = function() {
    setDebugMode(!debugMode);
  };
  document.body.appendChild(btn);
  setDebugMode(false);
}

setupDebugToggle();

function detectPlasticTypeFromIni(iniText) {
  // Try to find filament_type or similar in the INI text
  const match = iniText.match(/^\s*filament_type\s*=\s*(\w+)/mi);
  if (match) {
    const val = match[1].toUpperCase();
    if (["PLA","PETG","ABS","NYLON","TPU","PC","ASA","HIPS","PVA","PP"].includes(val)) return val;
  }
  // Fallback: guess from filename or default to PLA
  return null;
}

async function updateFileListCard() {
  if (selectedFiles && selectedFiles.length > 0) {
    fileListCard.style.display = '';
    fileOptionsDiv.innerHTML = '';
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.padding = '0';
    const defaultNozzle = document.getElementById('nozzle-size').value;
    for (let i = 0; i < selectedFiles.length; i++) {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      li.style.padding = '4px 0';

      // X button
      const xBtn = document.createElement('button');
      xBtn.textContent = '✕';
      xBtn.title = 'Remove file';
      xBtn.className = 'file-remove-btn';
      xBtn.addEventListener('click', (e) => {
        e.preventDefault();
        selectedFiles.splice(i, 1);
        updateFileListCard();
      });

      const nameSpan = document.createElement('span');
      nameSpan.textContent = selectedFiles[i].name.replace(/\.ini$/i, '');
      nameSpan.style.flex = '1 1 auto';
      nameSpan.style.marginLeft = '4px';

      const nozzleInput = document.createElement('input');
      nozzleInput.type = 'number';
      nozzleInput.step = '0.01';
      nozzleInput.className = 'file-nozzle';
      nozzleInput.dataset.idx = i;
      nozzleInput.value = defaultNozzle;
      nozzleInput.style.width = '70px';
      nozzleInput.style.marginLeft = '16px';
      nozzleInput.style.color = '#1976d2';
      nozzleInput.style.fontSize = '0.97em';

      // Plastic type dropdown
      const plasticTypes = [
        { value: 'PLA', label: 'PLA' },
        { value: 'PETG', label: 'PETG' },
        { value: 'ABS', label: 'ABS' },
        { value: 'NYLON', label: 'Nylon' },
        { value: 'TPU', label: 'TPU' },
        { value: 'PC', label: 'Polycarbonate' },
        { value: 'ASA', label: 'ASA' },
        { value: 'HIPS', label: 'HIPS' },
        { value: 'PVA', label: 'PVA' },
        { value: 'PP', label: 'Polypropylene' },
        { value: 'Other', label: 'Other' }
      ];
      const plasticSelect = document.createElement('select');
      plasticSelect.className = 'file-plastic-type';
      plasticSelect.dataset.idx = i;
      plasticSelect.style.marginLeft = '16px';
      plasticSelect.style.fontSize = '0.97em';
      for (const pt of plasticTypes) {
        const opt = document.createElement('option');
        opt.value = pt.value;
        opt.textContent = pt.label;
        plasticSelect.appendChild(opt);
      }
      // Try to auto-select based on INI content, filename, or default
      let detectedType = null;
      if (selectedFiles[i].text) {
        detectedType = detectPlasticTypeFromIni(selectedFiles[i].text);
      }
      if (!detectedType && selectedFiles[i].name.match(/petg/i)) detectedType = 'PETG';
      else if (!detectedType && selectedFiles[i].name.match(/abs/i)) detectedType = 'ABS';
      else if (!detectedType && selectedFiles[i].name.match(/nylon/i)) detectedType = 'NYLON';
      else if (!detectedType && selectedFiles[i].name.match(/tpu/i)) detectedType = 'TPU';
      else if (!detectedType && selectedFiles[i].name.match(/pc/i)) detectedType = 'PC';
      else if (!detectedType && selectedFiles[i].name.match(/asa/i)) detectedType = 'ASA';
      else if (!detectedType && selectedFiles[i].name.match(/hips/i)) detectedType = 'HIPS';
      else if (!detectedType && selectedFiles[i].name.match(/pva/i)) detectedType = 'PVA';
      else if (!detectedType && selectedFiles[i].name.match(/pp/i)) detectedType = 'PP';
      plasticSelect.value = detectedType || 'PLA';


      // (Removed per-file physical printer INI/JSON input)

      li.appendChild(xBtn);
      li.appendChild(nameSpan);
      li.appendChild(nozzleInput);
      li.appendChild(plasticSelect);
      ul.appendChild(li);
    }
    fileOptionsDiv.appendChild(ul);
  } else {
    fileListCard.style.display = 'none';
    fileOptionsDiv.innerHTML = '';
  }
}

// Drag & drop and click to select logic
document.getElementById('nozzle-size').addEventListener('input', updateFileListCard);
document.addEventListener('DOMContentLoaded', updateFileListCard);

fileDropZone.addEventListener('click', () => iniFilesInput.click());
fileDropZone.addEventListener('dragover', e => {
  e.preventDefault();
  fileDropZone.style.background = '#e3f2fd';
});
fileDropZone.addEventListener('dragleave', e => {
  e.preventDefault();
  fileDropZone.style.background = '#f7faff';
});
fileDropZone.addEventListener('drop', async e => {
  e.preventDefault();
  fileDropZone.style.background = '#f7faff';
  if (e.dataTransfer.files && e.dataTransfer.files.length) {
    selectedFiles = Array.from(e.dataTransfer.files);
    // Read text for each file for detection (File.text() is not always available, use FileReader)
    await Promise.all(selectedFiles.map((file, i) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        selectedFiles[i].text = reader.result;
        resolve();
      };
      reader.onerror = reject;
      reader.readAsText(file);
    })));
    iniFilesInput.value = '';
    updateFileListCard();
  }
});
iniFilesInput.addEventListener('change', async function() {
  selectedFiles = Array.from(iniFilesInput.files);
  await Promise.all(selectedFiles.map((file, i) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      selectedFiles[i].text = reader.result;
      resolve();
    };
    reader.onerror = reject;
    reader.readAsText(file);
  })));
  updateFileListCard();
});
document.getElementById('nozzle-size').addEventListener('input', updateFileListCard);
document.addEventListener('DOMContentLoaded', updateFileListCard);


  document.getElementById('convert-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const files = selectedFiles;
    const defaultNozzleSize = document.getElementById('nozzle-size').value;
    const defaultOnExisting = 'skip';

    if (!files.length) {
      outputDiv.textContent = 'Please select at least one INI file.';
      return;
    }

    summaryDiv.textContent = '';
    outputDiv.innerHTML = '';
    downloadAllBtn.style.display = 'none';

    // Read default physical printer INI if provided
    let defaultPhysicalIniObj = null;
    const defaultPhysicalInput = document.getElementById('default-physical-printer-ini');
    if (defaultPhysicalInput && defaultPhysicalInput.files && defaultPhysicalInput.files[0]) {
      const text = await defaultPhysicalInput.files[0].text();
      defaultPhysicalIniObj = parseIni(text);
    }

    // Read each INI file and convert, using per-file nozzle and per-file plastic type
    const promises = files.map(async (file, idx) => {
      const text = file.text;
      let nozzleInput = fileOptionsDiv.querySelector(`.file-nozzle[data-idx='${idx}']`);
      let nozzleSize = nozzleInput && nozzleInput.value ? nozzleInput.value : defaultNozzleSize;
      // Get selected plastic type from dropdown
      let plasticInput = fileOptionsDiv.querySelector(`.file-plastic-type[data-idx='${idx}']`);
      let plasticType = plasticInput ? plasticInput.value : 'PLA';
      let physicalIniObj = null;
      // Only use default physical printer INI for printer profiles
      if (file.type === 'printer') {
        physicalIniObj = defaultPhysicalIniObj;
      }
      return { name: file.name, content: text, idx, nozzleSize, plasticType, physicalIniObj };
    });

    Promise.all(promises).then(fileContents => {
      let results = [];
      let outputStore = {};
      let debugRuns = [];
      fileContents.forEach(({ name, content, idx, nozzleSize, plasticType, physicalIniObj }) => {
        let debugEntry = [];
        debugEntry.push(`File: ${name}`);
        debugEntry.push(`Plastic type: ${plasticType}`);
        debugEntry.push(`Nozzle size: ${nozzleSize}`);
        // Check for config bundle
        const bundleBlocks = parseConfigBundle(content);
        if (bundleBlocks.length) {
          debugEntry.push(`Config bundle: ${bundleBlocks.length} blocks`);
          bundleBlocks.forEach(block => {
            debugEntry.push(`  Block: [${block.profileType}: ${block.profileName}]`);
            const iniObj = parseIni(block.content);
            debugEntry.push(`    INI keys: ${Object.keys(iniObj).length}`);
            const iniType = detectIniType(iniObj);
            debugEntry.push(`    Detected type: ${iniType}`);
            let converted = convertIniToOrca(iniObj, iniType, nozzleSize, block.profileType, block.profileName, plasticType);
            debugEntry.push(`    Converted keys: ${Object.keys(converted).length}`);
            if (iniType === 'printer' && physicalIniObj) {
              mergePhysicalPrinterFields(converted, physicalIniObj);
              debugEntry.push('    Merged physical printer fields');
            }
            const outName = `${name} [${block.profileType}: ${block.profileName}]`;
            converted = handleOnExisting(outName, converted, outputStore, defaultOnExisting);
            outputStore[outName] = converted;
            results.push({ name: outName, iniType, converted });
          });
        } else {
          // Single profile
          debugEntry.push('Single profile');
          const iniObj = parseIni(content);
          debugEntry.push(`  INI keys: ${Object.keys(iniObj).length}`);
          const iniType = detectIniType(iniObj);
          debugEntry.push(`  Detected type: ${iniType}`);
          let converted = convertIniToOrca(iniObj, iniType, nozzleSize, undefined, undefined, plasticType);
          debugEntry.push(`  Converted keys: ${Object.keys(converted).length}`);
          if (iniType === 'printer' && physicalIniObj) {
            mergePhysicalPrinterFields(converted, physicalIniObj);
            debugEntry.push('  Merged physical printer fields');
          }
          const outName = name;
          converted = handleOnExisting(outName, converted, outputStore, defaultOnExisting);
          outputStore[outName] = converted;
          results.push({ name, iniType, converted });
        }
        debugRuns.push(debugEntry.join('\n'));
      });
      // Show debug output if enabled
      if (debugMode && document.getElementById('debug-log')) {
        const dbg = document.getElementById('debug-log');
        dbg.innerHTML = '<b>Debug mode enabled.</b><br><span style="font-size:0.95em;color:#888;">Conversion and error details will appear here.</span>';
        debugRuns.forEach((run, i) => {
          const wrap = document.createElement('div');
          wrap.style = 'margin:10px 0 18px 0;padding:8px 10px 8px 8px;background:#f7fafd;border-radius:7px;border:1px solid #b6c6e3;position:relative;';
          const pre = document.createElement('pre');
          pre.style = 'margin:0;font-size:0.98em;line-height:1.5;white-space:pre-wrap;word-break:break-all;';
          pre.textContent = run;
          // Copy button
          const copyBtn = document.createElement('button');
          copyBtn.textContent = 'Copy';
          copyBtn.title = 'Copy debug output';
          copyBtn.style = 'position:absolute;top:8px;right:10px;background:#1976d2;color:#fff;border:none;border-radius:5px;padding:2px 12px;font-size:0.97em;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.07);';
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(run);
            copyBtn.textContent = 'Copied!';
            setTimeout(()=>{copyBtn.textContent='Copy';}, 1200);
          };
          wrap.appendChild(pre);
          wrap.appendChild(copyBtn);
          dbg.appendChild(wrap);
        });
      }
  function mergePhysicalPrinterFields(printerJson, physicalIniObj) {
    // Example: merge network-related fields if present
    if (!physicalIniObj) return;
    // Merge all keys that start with 'network_' or are known to be network settings
    for (const key in physicalIniObj) {
      if (key.startsWith('network_')) {
        printerJson[key] = physicalIniObj[key];
      }
    }
    // Add more merging logic as needed (e.g., sections, etc.)
  }

    // Debug: show results
    console.log('Conversion results:', results);

    // Show results and offer download
    // Download All button above results, right-aligned
    outputDiv.innerHTML = (
      `<div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:12px;">
        <button id="download-all" style="${results.length ? 'display:inline-block;' : 'display:none;'}background:#1976d2; color:#fff; border:none; border-radius:6px; padding:7px 18px; font-size:1em; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.07); transition:background 0.2s;">Download All JSON</button>
      </div>`
      +
      results.map((r, i) =>
        `<div class="file-card" style="border:1px solid #ccc; border-radius:8px; padding:12px; margin-bottom:12px; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
          <div style="font-weight:bold; font-size:1.1em; margin-bottom:6px;">${r.name} <span style="font-weight:normal; color:#888;">[${r.iniType || 'unknown'}]</span></div>
          <div style="margin-bottom:8px; color:#888; font-size:0.9em;">${Object.keys(r.converted).length} keys converted</div>
          <button class="download-json-btn" data-idx="${i}" style="background:#1976d2; color:#fff; border:none; border-radius:6px; padding:7px 18px; font-size:1em; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.07); transition:background 0.2s;">Download JSON</button>
        </div>`
      ).join('')
    );

    // Attach event listeners for download buttons
    outputDiv.querySelectorAll('.download-json-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const idx = btn.getAttribute('data-idx');
        const r = results[idx];
        window.downloadJson(r.name.replace(/\.ini$/, '.json'), r.converted);
      });
    });
    // Attach event listener for Download All button
    const downloadAllBtnNew = document.getElementById('download-all');
    if (downloadAllBtnNew) {
      downloadAllBtnNew.addEventListener('click', function() {
        results.forEach(r => {
          window.downloadJson(r.name.replace(/\.ini$/, '.json'), r.converted);
        });
      });
    }
    summaryDiv.textContent = `Converted ${results.length} profile${results.length !== 1 ? 's' : ''}.`;
    lastResults = results;
  }).catch(err => {
    outputDiv.textContent = 'Error during conversion: ' + err;
    console.error('Conversion error:', err);
  });
});

downloadAllBtn.addEventListener('click', function() {
  if (!lastResults.length) return;
  lastResults.forEach(r => {
    window.downloadJson(r.name.replace(/\.ini$/, '.json'), r.converted);
  });
});

  // Merge/overwrite/skip logic
  function handleOnExisting(name, newObj, store, mode) {
    if (!store[name]) return newObj;
    if (mode === 'skip') return store[name];
    if (mode === 'overwrite') return newObj;
    if (mode === 'merge') {
      // Merge: add new keys, keep existing
      return { ...store[name], ...newObj };
    }
    return newObj;
  }

  // Parse config bundle blocks
  function parseConfigBundle(text) {
    const blocks = [];
    const regex = /\[([\w\s\+\-]+):([^\]]+)\]\n([\s\S]*?)(?=\n\[|$)/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      blocks.push({
        profileType: m[1].trim(),
        profileName: m[2].trim(),
        content: m[3].trim()
      });
    }
    return blocks;
  }

  // Simple INI parser (sectionless, key=value)
  function parseIni(text) {
    const lines = text.split(/\r?\n/);
    const obj = {};
    for (const line of lines) {
      // Skip blank lines
      if (/^\s*$/.test(line)) continue;
      // Skip comments only if # or ; is the first non-whitespace character
      if (/^\s*([#;])/.test(line)) continue;
      // Match key=value, allow nil and quoted empty string
      const m = line.match(/^\s*([^=]+?)\s*=\s*(.*?)\s*$/);
      if (m) {
        let key = m[1].trim();
        let val = m[2].trim();
        // Treat 'nil' as null, and quoted empty string as ''
        if (val === 'nil') val = null;
        if (val === '""') val = '';
        obj[key] = val;
      }
    }
    return obj;
  }

  // Detect INI type by parameterMap
  function detectIniType(iniObj) {
    let typeCounts = {};
    for (const type in parameterMap) {
      typeCounts[type] = 0;
      for (const key in iniObj) {
        if (parameterMap[type][key]) typeCounts[type]++;
      }
    }
    let best = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])[0];
    return best && best[1] > 0 ? best[0] : null;
  }


  // Convert INI to OrcaSlicer JSON
  function convertIniToOrca(iniObj, iniType, nozzleSize, profileType, profileName) {
    if (!iniType || !parameterMap[iniType]) return {};
    let out = {};
    for (const key in iniObj) {
      const mapVal = parameterMap[iniType][key];
      if (!mapVal) continue;
      let val = iniObj[key];
      val = specialCaseConvert(key, val, iniObj, nozzleSize, iniType);
      if (Array.isArray(mapVal)) {
        mapVal.forEach(k => out[k] = val);
      } else {
        out[mapVal] = val;
      }
    }
    // Add nozzle size if present
    if (nozzleSize) out.nozzle_size = nozzleSize;
    // Add profile type/name if bundle
    if (profileType) out.profile_type = profileType;
    if (profileName) out.profile_name = profileName;
    // Add selected plastic type for inheritance/base profile logic
    if (arguments.length >= 6 && arguments[5]) {
      out._selectedPlasticType = arguments[5];
    }
    return out;
  }


      // Special-case conversions (expand as needed)
      function specialCaseConvert(key, val, iniObj, nozzleSize, iniType) {
        // nil/null
        if (val === 'nil' || val === null) return undefined;
        // Remove double quotes for empty string values
        if (key === 'filament_settings_id' && val === '""') return '';
      // Percent to float
      if (/^(bridge_flow_ratio|fill_top_flow_ratio|first_layer_flow_ratio)$/.test(key)) {
        return percentToFloat(val);
      }
      // Percent to mm
      if (/^(max_layer_height|min_layer_height|fuzzy_skin_point_dist|fuzzy_skin_thickness|small_perimeter_min_length)$/.test(key)) {
        return percentToMm(nozzleSize, val);
      }
      // mm to percent
      if (key === 'wall_transition_length') {
        return mmToPercent(nozzleSize, val);
      }
      // Boolean conversion
      if (/^(infill_every_layers|support_material_layer_height)$/.test(key)) {
        return Number(val) > 0 ? '1' : '0';
      }
      // Filament type mapping (PLA, PET, FLEX, NYLON, etc.)
      if (key === 'filament_type' && filamentTypes[val]) {
        return filamentTypes[val];
      }
      // Default max volumetric speed logic
      if (key === 'filament_max_volumetric_speed' && (val === '' || Number(val) <= 0) && defaultMVS[iniObj['filament_type']]) {
        return defaultMVS[iniObj['filament_type']];
      }
      // Output filename format brackets
      if (key === 'output_filename_format') {
        return val.replace(/\[|\]/g, m => m === '[' ? '{' : '}');
      }
      // Seam position
      if (key === 'seam_position' && seamPositions[val]) {
        return seamPositions[val];
      }
      // Infill type
      if (/^(fill_pattern|top_fill_pattern|bottom_fill_pattern|solid_fill_pattern)$/.test(key) && infillTypes[val]) {
        return infillTypes[val];
      }
      // Gcode flavor
      if (key === 'gcode_flavor' && gcodeFlavors[val]) {
        return gcodeFlavors[val];
      }
      // Host type
      if (key === 'host_type' && hostTypes[val]) {
        return hostTypes[val];
      }
      // Thumbnail format
      if (key === 'thumbnails_format' && thumbnailFormat[val]) {
        return thumbnailFormat[val];
      }
      // Support pattern
      if (key === 'support_material_pattern' && !supportPatterns[val]) {
        return 'default';
      }
      // Support interface pattern
      if (key === 'support_material_interface_pattern' && !interfacePatterns[val]) {
        return 'auto';
      }

      // Array/single value handling for multivalueParams
      if (multivalueParams[key]) {
        let arr = val.split(/,|;/).map(v => v.trim()).filter(Boolean);
        if (multivalueParams[key] === 'single') return arr[0];
        return arr;
      }

      // Array/single value for default_filament_profile
      if (key === 'default_filament_profile') {
        let arr = val.split(/,|;/).map(v => v.trim()).filter(Boolean);
        return arr.length === 1 ? arr[0] : arr;
      }

      // Gcode unbackslash/unescape for start_filament_gcode, end_filament_gcode, filament_notes
      if (/^(start_filament_gcode|end_filament_gcode|filament_notes)$/i.test(key)) {
        if (typeof val === 'string') {
          val = val.replace(/^"(.*)"$/, '$1');
          // Unescape common sequences (Perl's unbackslash)
          val = val.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
        }
        return val;
      }

      // Gcode unquoting/unescaping for custom gcode blocks (fallback)
      if (/gcode|notes/i.test(key)) {
        if (typeof val === 'string') {
          val = val.replace(/^"(.*)"$/, '$1');
          val = val.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
        }
        return val;
      }

    // Support style mapping (interactive)
    if (key === 'support_material_style' && supportStyles[val]) {
      // If not already chosen, prompt user
      if (!window._supportStyleChoice) {
        window._supportStyleChoice = supportStyles[val];
        alert(`Support style detected: ${val}\nType: ${supportStyles[val][0]}\nStyle: ${supportStyles[val][1]}`);
      }
      return {
        support_type: supportStyles[val][0],
        support_style: supportStyles[val][1]
      };
    }

    // Compatible condition (interactive)
    if (/compatible_printers_condition|compatible_prints_condition/.test(key)) {
      if (!window._compatibleChoice) {
        const keep = confirm(`Profile has ${key}:\n${val}\n\nKeep this value? (Cancel to discard)`);
        window._compatibleChoice = keep ? 'KEEP' : 'DISCARD';
      }
      return window._compatibleChoice === 'KEEP' ? val : '';
    }

    // Z-hop enforcement
    if (key === 'retract_lift_top' && zhopEnforcement[val]) {
      return zhopEnforcement[val];
    }

    // Remove illegal chars for profile_name
    if (key === 'profile_name') {
      const os = navigator.platform.startsWith('Win') ? 'MSWin32' : navigator.platform.startsWith('Mac') ? 'darwin' : 'linux';
      return val.replace(illegalChars[os], '');
    }

    // Handle nil/null again for safety
    if (val === 'nil' || val === null) return undefined;

    return val;
  }

  // Percent helpers
  function isPercent(v) { return typeof v === 'string' && v.endsWith('%'); }
  function removePercent(v) { return isPercent(v) ? v.replace(/%$/, '') : v; }
  function percentToFloat(v) {
    if (!isPercent(v)) return v;
    let f = parseFloat(removePercent(v)) / 100;
    return f > 2 ? '2' : f.toString();
  }
  function percentToMm(mmComparator, percentParam) {
    if (!mmComparator || !percentParam) return percentParam;
    if (!isPercent(percentParam)) return percentParam;
    if (isPercent(mmComparator)) return undefined;
    return (parseFloat(mmComparator) * parseFloat(removePercent(percentParam)) / 100).toString();
  }
  function mmToPercent(mmComparator, mmParam) {
    if (isPercent(mmParam)) return mmParam;
    if (isPercent(mmComparator)) return undefined;
    return ((parseFloat(mmParam) / parseFloat(mmComparator)) * 100).toFixed(2) + '%';
  }

  // Download helper
  window.downloadJson = function(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
