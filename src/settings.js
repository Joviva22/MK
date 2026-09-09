(function () {
'use strict';

let autosaveIntervalMs = 1000;

window.mdGetAutosaveInterval = () => autosaveIntervalMs;

window.initDropdown('btn-settings', 'settings-menu');

const autosaveSelect = document.getElementById('autosave-select');

autosaveSelect.addEventListener('change', async (e) => {
  autosaveIntervalMs = Number(e.target.value);
  await window.mdEditor.setConfig({ autosaveInterval: autosaveIntervalMs });
});

(async () => {
  const config = await window.mdEditor.getConfig();
  autosaveIntervalMs = config.autosaveInterval != null ? config.autosaveInterval : 1000;
  autosaveSelect.value = String(autosaveIntervalMs);
})();

})();
