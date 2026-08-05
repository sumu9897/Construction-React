/**
 * Speech to text, pluggable.
 *
 * The engine is a command template rather than a hard-coded integration, so
 * whisper.cpp on the Mac mini, a hosted API, or a test stub all work without a code
 * change. The recommended setup keeps site audio on your own machine:
 *
 *   brew install ffmpeg whisper-cpp
 *   curl -L -o ~/.whisper/ggml-base.en.bin \
 *     https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
 *
 *   PM_TRANSCRIBE_CMD='whisper-cli -m ~/.whisper/ggml-base.en.bin -f {input} --output-txt --output-file {output} -nt'
 *
 * Site audio names people, incidents and commercial matters. Keeping it local is
 * the reason this is a template and not a call to somebody's API.
 */

import path from 'node:path';
import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { exists } from '../ledger/store.js';

const DEFAULT_TIMEOUT_MS = 300_000;

const shellQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function run(commandLine, { timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(commandLine, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ code: null, stdout, stderr, timedOut: true });
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: error.message, timedOut: false });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut: false });
    });
  });
}

export function transcriberConfigured() {
  return Boolean(process.env.PM_TRANSCRIBE_CMD);
}

/**
 * Telegram sends voice notes as OGG/Opus. Most local engines want 16 kHz mono WAV.
 * Set PM_TRANSCRIBE_ACCEPTS_OGG=1 to skip this for an engine that takes OGG.
 */
async function toWav(input, { timeoutMs }) {
  const ffmpeg = process.env.PM_FFMPEG || 'ffmpeg';
  const output = input.replace(/\.[^.]+$/, '') + '.wav';

  const result = await run(
    `${ffmpeg} -y -loglevel error -i ${shellQuote(input)} -ar 16000 -ac 1 -c:a pcm_s16le ${shellQuote(output)}`,
    { timeoutMs },
  );

  if (result.code !== 0 || !(await exists(output))) {
    return {
      ok: false,
      error: `Could not convert the audio to WAV (${ffmpeg}). ${result.stderr.trim().slice(0, 200)}`,
    };
  }

  return { ok: true, file: output };
}

/**
 * @param {string} audioFile path to the downloaded voice note
 * @returns {Promise<{ok: boolean, text: string, error: string|null, engine: string|null}>}
 */
export async function transcribe(audioFile, options = {}) {
  const template = options.command ?? process.env.PM_TRANSCRIBE_CMD;
  const timeoutMs =
    options.timeoutMs ?? (Number(process.env.PM_TRANSCRIBE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);

  if (!template) {
    return {
      ok: false,
      text: '',
      engine: null,
      error:
        'No transcriber configured. Set PM_TRANSCRIBE_CMD (see the README) or send the update as text.',
    };
  }

  let input = audioFile;
  let converted = null;

  const acceptsOgg =
    options.acceptsOgg ?? (process.env.PM_TRANSCRIBE_ACCEPTS_OGG === '1' || undefined);

  if (!acceptsOgg && /\.(ogg|oga|opus)$/i.test(audioFile)) {
    const wav = await toWav(audioFile, { timeoutMs });
    if (!wav.ok) return { ok: false, text: '', engine: template, error: wav.error };
    input = wav.file;
    converted = wav.file;
  }

  // {output} is a path stem, because engines differ on whether they append an
  // extension. Both the stem and stem.txt are checked afterwards.
  const outputStem = input.replace(/\.[^.]+$/, '') + '.transcript';

  const commandLine = template
    .replaceAll('{input}', shellQuote(input))
    .replaceAll('{output}', shellQuote(outputStem));

  const result = await run(commandLine, { timeoutMs });

  const cleanup = async () => {
    if (converted) await unlink(converted).catch(() => {});
  };

  if (result.timedOut) {
    await cleanup();
    return { ok: false, text: '', engine: template, error: 'Transcription timed out.' };
  }

  let text = '';
  for (const candidate of [outputStem, `${outputStem}.txt`]) {
    if (await exists(candidate)) {
      text = (await readFile(candidate, 'utf8')).trim();
      await unlink(candidate).catch(() => {});
      if (text) break;
    }
  }

  // An engine that prints to stdout instead of writing a file is equally valid.
  if (!text) text = result.stdout.trim();

  await cleanup();

  if (!text) {
    return {
      ok: false,
      text: '',
      engine: template,
      error:
        result.code === 0
          ? 'The transcriber produced no text.'
          : `The transcriber failed (exit ${result.code}). ${result.stderr.trim().slice(0, 200)}`,
    };
  }

  return { ok: true, text, engine: template, error: null };
}
