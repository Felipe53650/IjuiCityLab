const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v, { min = 1, max = 5000, required = true, label } = {}) {
  const value = typeof v === 'string' ? v.trim() : '';
  if (!value) {
    if (required) throw httpError(400, `Campo obrigatório: ${label}`);
    return null;
  }
  if (value.length < min) throw httpError(400, `${label} muito curto`);
  if (value.length > max) throw httpError(400, `${label} muito longo`);
  return value;
}

function email(v, { required = true, label = 'e-mail' } = {}) {
  const value = str(v, { required, label, max: 254 });
  if (!value) return null;
  if (!EMAIL_RE.test(value)) throw httpError(400, `${label} inválido`);
  return value.toLowerCase();
}

function oneOf(v, allowed, label) {
  const value = str(v, { label });
  if (!allowed.includes(value)) throw httpError(400, `${label} inválido`);
  return value;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { str, email, oneOf, httpError, EMAIL_RE };
