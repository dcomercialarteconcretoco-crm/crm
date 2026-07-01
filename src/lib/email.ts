const DEFAULT_FROM_EMAIL = 'cotizaciones@arteconcreto.co';

export function getFromEmail(label = 'ArteConcreto CRM') {
  const from = process.env.FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
  return from.includes('<') ? from : `${label} <${from}>`;
}
