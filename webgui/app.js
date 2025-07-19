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

function updateFileListCard() {
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
      
      // Add per-file physical printer INI/JSON input for printer profiles (INI or JSON)
      let physicalPrinterInput = '';
      if (selectedFiles[i].type === 'printer' || (selectedFiles[i].name && selectedFiles[i].name.match(/\.json$/i))) {
        physicalPrinterInput = `\n      <label class="perfile-physical-label" style="font-weight:500;margin-top:8px;">Physical Printer INI/JSON (optional):<input type="file" class="physical-printer-ini-input perfile-physical-input" data-idx="${i}" accept=".ini,.json" style="margin-left:8px;"></label>`;
      }
      li.innerHTML += physicalPrinterInput;

      li.appendChild(xBtn);
      li.appendChild(nameSpan);
      li.appendChild(nozzleInput);
      ul.appendChild(li);
    }
    fileOptionsDiv.appendChild(ul);
  } else {
    fileListCard.style.display = 'none';
    fileOptionsDiv.innerHTML = '';
  }
}

// Drag & drop and click to select logic
fileDropZone.addEventListener('click', () => iniFilesInput.click());
fileDropZone.addEventListener('dragover', e => {
  e.preventDefault();
  fileDropZone.style.background = '#e3f2fd';
});
fileDropZone.addEventListener('dragleave', e => {
  e.preventDefault();
  fileDropZone.style.background = '#f7faff';
});
fileDropZone.addEventListener('drop', e => {
  e.preventDefault();
  fileDropZone.style.background = '#f7faff';
  if (e.dataTransfer.files && e.dataTransfer.files.length) {
    selectedFiles = Array.from(e.dataTransfer.files);
    iniFilesInput.value = '';
    updateFileListCard();
  }
});
iniFilesInput.addEventListener('change', function() {
  selectedFiles = Array.from(iniFilesInput.files);
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

    // Read each INI file and convert, using per-file nozzle and per-file physical printer INI if set
    const promises = files.map(async (file, idx) => {
      const text = await file.text();
      let nozzleInput = fileOptionsDiv.querySelector(`.file-nozzle[data-idx='${idx}']`);
      let nozzleSize = nozzleInput && nozzleInput.value ? nozzleInput.value : defaultNozzleSize;
      let physicalIniObj = null;
      if (file.type === 'printer') {
        const perFileInput = fileOptionsDiv.querySelector(`.physical-printer-ini-input[data-idx='${idx}']`);
        if (perFileInput && perFileInput.files && perFileInput.files[0]) {
          const pText = await perFileInput.files[0].text();
          physicalIniObj = parseIni(pText);
        } else {
          physicalIniObj = defaultPhysicalIniObj;
        }
      }
      return { name: file.name, content: text, idx, nozzleSize, physicalIniObj };
    });

    Promise.all(promises).then(fileContents => {
      let results = [];
      let outputStore = {};
      fileContents.forEach(({ name, content, idx, nozzleSize, physicalIniObj }) => {
        // Check for config bundle
        const bundleBlocks = parseConfigBundle(content);
        if (bundleBlocks.length) {
          bundleBlocks.forEach(block => {
            const iniObj = parseIni(block.content);
            const iniType = detectIniType(iniObj);
            let converted = convertIniToOrca(iniObj, iniType, nozzleSize, block.profileType, block.profileName);
            // Merge physical printer fields if printer profile
            if (iniType === 'printer' && physicalIniObj) {
              mergePhysicalPrinterFields(converted, physicalIniObj);
            }
            // Merge/overwrite/skip logic
            const outName = `${name} [${block.profileType}: ${block.profileName}]`;
            converted = handleOnExisting(outName, converted, outputStore, defaultOnExisting);
            outputStore[outName] = converted;
            results.push({ name: outName, iniType, converted });
          });
        } else {
          // Single profile
          const iniObj = parseIni(content);
          const iniType = detectIniType(iniObj);
          let converted = convertIniToOrca(iniObj, iniType, nozzleSize);
          if (iniType === 'printer' && physicalIniObj) {
            mergePhysicalPrinterFields(converted, physicalIniObj);
          }
          const outName = name;
          converted = handleOnExisting(outName, converted, outputStore, defaultOnExisting);
          outputStore[outName] = converted;
          results.push({ name, iniType, converted });
        }
      });
  // Merge physical printer INI fields into printer JSON
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
      const m = line.match(/^\s*([^#;][^=]+?)\s*=\s*(.*?)\s*$/);
      if (m) obj[m[1].trim()] = m[2].trim();
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
      // Special-case conversions
      val = specialCaseConvert(key, val, iniObj, nozzleSize, iniType);
      // Handle array mapping
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
