(async () => {
  const results = [];
  const check = (name, pass) => results.push({ name, pass:!!pass });
  const api = window.mdOffice;
  const waitFor = async predicate => {
    for (let i = 0; i < 400; i++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
    throw new Error('La sesión Office no terminó de restaurarse.');
  };
  try {
    await window.mdTabs.ready;
    const writing = new URLSearchParams(window.location.search).get('mkTestScript') === 'office-recovery-write';
    if (writing) {
      await api.create('docx'); await api.setWordHtml('<h1>Borrador tras cierre inesperado</h1><p>Texto pendiente.</p>');
      await api.create('xlsx'); await api.setCell(1, 'AA88', '37'); await api.setCell(1, 'AB88', '=AA88*2');
      await api.create('pptx'); const item = (await api.getSlideItems(0)).find(item => item.kind === 'sp'); await api.editSlide(0, item.id, 'Presentación pendiente tras cierre inesperado');
      await waitFor(async () => {
        const session = await window.mdEditor.loadSession();
        return ['docx','xlsx','pptx'].every(kind => session?.tabs.some(tab => tab.kind === kind && tab.modified));
      });
      check('Recuperación: los tres documentos pendientes están en disco antes de matar el proceso', true);
    } else {
      await waitFor(() => api.getState()?.kind === 'pptx');
      const offered = !document.getElementById('restore-dialog').hidden;
      document.getElementById('btn-restore-keep').click();
      check('Recuperación: se ofrece conservar los cambios al reiniciar', offered && document.getElementById('restore-dialog').hidden);
      for (const kind of ['docx','xlsx','pptx']) {
        document.querySelector(`#tabbar .tab[data-kind="${kind}"]`).click();
        await waitFor(() => api.getState()?.kind === kind);
        check(`Recuperación ${kind}: conserva cambios pendientes tras SIGKILL`, api.getState().modified);
        if (kind === 'docx') check('Recuperación Word: conserva el texto', document.querySelector('.office-word-page').textContent.includes('Borrador tras cierre inesperado'));
        if (kind === 'xlsx') check('Recuperación Excel: conserva celda y fórmula fuera de la primera página', api.getCell(1, 'AA88') === 37 && api.getCell(1, 'AB88').result === 74);
        if (kind === 'pptx') check('Recuperación PowerPoint: conserva el texto', (await api.getSlideItems(0)).some(item => item.text === 'Presentación pendiente tras cierre inesperado'));
        const before = api.getState().historyIndex; await api.undo();
        check(`Recuperación ${kind}: deshacer restaura el estado anterior`, before > 0 && api.getState().historyIndex === before - 1);
      }
    }
  } catch (error) { results.push({ name:'Recuperación tras cierre inesperado', pass:false, detail:error.stack + '\n' + JSON.stringify({ state:api.getState()?.kind, tabs:[...document.querySelectorAll('#tabbar .tab')].map(tab=>tab.dataset.kind), toasts:[...document.querySelectorAll('.app-error-toast')].map(node=>node.textContent), session:(await window.mdEditor.loadSession())?.tabs.map(tab=>({kind:tab.kind,modified:tab.modified})) }) }); }
  return results;
})();
