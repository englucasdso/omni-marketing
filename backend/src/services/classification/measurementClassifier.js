export class MeasurementClassifier {
  classify(screens) {
    if (!screens || screens.length === 0) return 'Doc';

    let hasGa3 = false;
    let hasGa4 = false;

    for (const screen of screens) {
      const screenParams = screen.parameters || [];
      const keys = screenParams.map(p => p.parameter_path.toLowerCase());
      
      const isGa3 = keys.some(k => k === 'eventcategory' || k === 'event_category' || k === 'eventaction' || k === 'event_action' || k === 'eventlabel' || k === 'event_label');
      
      const isGa4 = keys.some(k => k === 'event_type' || k === 'eventtype' || k === 'event_name' || k === 'eventname' || k.startsWith('ga_event') || k.startsWith('screen') || k.startsWith('product') || k.startsWith('user') || k.startsWith('debug'));

      if (isGa3) hasGa3 = true;
      if (isGa4) hasGa4 = true;
    }

    if (hasGa3 && hasGa4) return 'Misto';
    if (hasGa4) return 'GA4';
    if (hasGa3) return 'Universal Analytics';
    
    // Se extraiu tela mas sem padrão reconhecido
    return 'Não classificado';
  }
}
