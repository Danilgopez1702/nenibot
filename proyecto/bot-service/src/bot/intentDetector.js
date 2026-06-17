// bot/intentDetector.js — Regex puras, cero tokens, predecible (Paso 5).
// INTENTS: book | cancel | reschedule | consult | confirm | deny | select | unknown
const PATTERNS = [
  ['cancel', /\b(cancel\w*|anular|ya no (?:voy|quiero|podr[ée])|borra(?:r)? (?:mi )?cita)\b/i],
  ['reschedule', /\b(reagend\w*|reprogram\w*|cambiar (?:mi )?(?:cita|hora|fecha)|mover (?:mi )?cita|otra hora|otro d[ií]a)\b/i],
  ['book', /\b(agend\w*|reserv\w*|cita|quiero (?:una|mi)|sacar (?:una )?cita|aparta\w*|me gustar[íi]a)\b/i],
  ['confirm', /\b(s[ií]|claro|confirm\w*|de acuerdo|va|sale|perfecto|correcto|as[íi] es|ok|okay|dale)\b/i],
  ['deny', /\b(no|nel|negativo|para nada|mejor no|cancela eso)\b/i],
  ['consult', /\b(precio|cu[áa]nto|costo|horario|abren|cierran|d[óo]nde|ubicaci[óo]n|servicios|cat[áa]logo)\b/i],
];

// Detecta selección numérica ("1", "opción 2", "el 3")
function detectSelection(text) {
  const m = text.match(/\b(?:opci[óo]n\s*)?(?:el\s*)?(\d{1,2})\b/i);
  return m ? parseInt(m[1], 10) : null;
}

function detectIntent(text) {
  const t = (text || '').trim();
  if (!t) return { intent: 'unknown', selection: null };

  const selection = detectSelection(t);

  for (const [intent, re] of PATTERNS) {
    if (re.test(t)) {
      return { intent, selection };
    }
  }
  // Si solo es un número, es una selección
  if (selection !== null) return { intent: 'select', selection };

  return { intent: 'unknown', selection: null };
}

module.exports = { detectIntent, detectSelection };
