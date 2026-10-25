import { AuthError } from './auth.mjs';

// Leitura em memória. Em TTY, não ecoa o conteúdo colado nem cria histórico.
export async function readSecretInput(input = process.stdin, output = process.stderr) {
  const limit = 32768;
  if (!input.isTTY) {
    let text = '';
    try {
      for await (const chunk of input) {
        text += chunk.toString('utf8');
        if (Buffer.byteLength(text, 'utf8') > limit) throw new AuthError('COOKIE_INPUT_TOO_LARGE', 'Entrada de cookies excede o limite.');
      }
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('COOKIE_INPUT_FAILED', 'Não foi possível ler os cookies pela entrada padrão.');
    }
    return text;
  }
  output.write('Cole o JSON dos três cookies em uma linha e pressione Enter (entrada oculta): ');
  const previousRaw = Boolean(input.isRaw);
  return new Promise((resolve, reject) => {
    let text = '';
    const finish = error => {
      if (!error && Buffer.byteLength(text, 'utf8') > limit) error = new AuthError('COOKIE_INPUT_TOO_LARGE', 'Entrada de cookies excede o limite.');
      input.off('data', onData);
      input.off('error', onError);
      input.off('end', onEnd);
      input.setRawMode(previousRaw);
      input.pause();
      output.write('\n');
      if (error) reject(error); else resolve(text);
    };
    const onError = () => finish(new AuthError('COOKIE_INPUT_FAILED', 'Não foi possível ler os cookies pela entrada padrão.'));
    const onEnd = () => finish();
    const onData = chunk => {
      const value = chunk.toString('utf8');
      if (value.includes('\u0003')) return finish(new AuthError('COOKIE_INPUT_CANCELLED', 'Importação cancelada.'));
      if (value.startsWith('\u001b')) return;
      for (const char of value) {
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') text = text.slice(0, -1);
        else text += char;
      }
      if (Buffer.byteLength(text, 'utf8') > limit) finish(new AuthError('COOKIE_INPUT_TOO_LARGE', 'Entrada de cookies excede o limite.'));
    };
    input.setRawMode(true);
    input.on('data', onData);
    input.on('error', onError);
    input.on('end', onEnd);
    input.resume();
  });
}
