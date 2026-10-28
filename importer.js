import { validatePlanDocument } from './plan-editor.js';

const REQUIRED_COLUMNS = [
  'registro', 'nome', 'meta_km', 'meta_min', 'data_meta', 'id', 'data',
  'tipo', 'km', 'duracao_min', 'intensidade', 'descricao', 'musculacao',
  'observacoes', 'tema', 'orientacao',
];

export function csvRows(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  const separator = text.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  let row = [];
  let field = '';
  let quoted = false;
  let closed = false;
  let line = 1;
  let startLine = 1;

  const finishRow = () => {
    row.push(field);
    if (row.some(value => value.trim())) {
      // Preserve the source line for errors without changing the row's columns.
      Object.defineProperty(row, 'sourceLine', { value: startLine });
      rows.push(row);
    }
    row = [];
    field = '';
    closed = false;
  };

  for (let index = 0; index < text.length; index++) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (quoted) {
        quoted = false;
        closed = true;
      } else if (field || closed) {
        throw Error('Linha ' + line + ': Aspas inválidas.');
      } else {
        quoted = true;
      }
    } else if (character === separator && !quoted) {
      row.push(field);
      field = '';
      closed = false;
    } else if ((character === '\n' || character === '\r') && !quoted) {
      finishRow();
      if (character === '\r' && text[index + 1] === '\n') index++;
      line++;
      startLine = line;
    } else {
      if (closed) {
        throw Error('Linha ' + line + ': caractere após as aspas de fechamento.');
      }
      field += character;
      if (character === '\n' || (character === '\r' && text[index + 1] !== '\n')) {
        line++;
      }
    }
  }

  if (quoted) throw Error('Linha ' + startLine + ': Aspas não fechadas.');
  finishRow();
  return rows;
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !isNaN(Date.parse(value))
    && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}

function parseOptionalNumber(value, label, maximum) {
  // An omitted measurement is different from an explicitly entered zero.
  if (value === '') return null;

  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number) || number < 0 || number > maximum) {
    throw Error(label + ': número inválido.');
  }
  return number;
}

export function parsePlan(text) {
  const rows = csvRows(text);
  const headers = rows.shift()?.map(value => value.trim());

  if (!headers) throw Error('Arquivo vazio.');
  if (new Set(headers).size !== headers.length) throw Error('Colunas repetidas.');

  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) throw Error('Coluna ausente: ' + column);
  }

  const records = rows.map(row => {
    if (row.length !== headers.length) {
      throw Error('Linha ' + row.sourceLine + ': quantidade de colunas incorreta.');
    }
    return {
      ...Object.fromEntries(headers.map((column, index) => [column, row[index].trim()])),
      sourceLine: row.sourceLine,
    };
  });

  const metadataRows = records.filter(record => record.registro === 'plano');
  if (metadataRows.length !== 1) throw Error('Use exatamente uma linha plano.');

  const metadata = metadataRows[0];
  if (!metadata.nome || metadata.nome.length > 200) {
    throw Error('Nome obrigatório, até 200 caracteres.');
  }
  if (metadata.data_meta && !isValidDate(metadata.data_meta)) {
    throw Error('Data da meta inválida.');
  }

  const sessions = [];
  const guide = [];
  const sessionIds = new Set();

  for (const record of records) {
    try {
      if (record.registro === 'plano') continue;

      if (record.registro === 'guia') {
        if (!record.tema || !record.orientacao) {
          throw Error('Guia: tema e orientação obrigatórios.');
        }
        guide.push({ tema: record.tema, orientacao: record.orientacao });
        continue;
      }

      if (record.registro !== 'treino') {
        throw Error('Linha ' + record.sourceLine + ': registro inválido.');
      }
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(record.id) || sessionIds.has(record.id)) {
        throw Error('ID inválido ou repetido: ' + record.id);
      }
      sessionIds.add(record.id);

      if (!isValidDate(record.data) || !record.tipo || !record.descricao) {
        throw Error('Sessão ' + record.id + ': data, tipo e descrição obrigatórios.');
      }

      sessions.push({
        id: record.id,
        date: record.data,
        type: record.tipo,
        km: parseOptionalNumber(record.km, 'Distância', 1000),
        minutes: parseOptionalNumber(record.duracao_min, 'Duração', 1440),
        intensity: record.intensidade,
        description: record.descricao,
        gym: record.musculacao,
        notes: record.observacoes,
        ...(record.musculacao_json ? { strength: JSON.parse(record.musculacao_json) } : {}),
      });
    } catch (error) {
      throw Error('Linha ' + record.sourceLine + ': ' + error.message);
    }
  }

  if (!sessions.length || sessions.length > 1000) {
    throw Error('Use de 1 a 1000 sessões.');
  }
  if (!guide.length) throw Error('Inclua pelo menos uma linha guia.');

  return validatePlanDocument({
    name: metadata.nome,
    goal_km: parseOptionalNumber(metadata.meta_km, 'Meta km', 1000),
    goal_minutes: parseOptionalNumber(metadata.meta_min, 'Meta minutos', 100000),
    goal_date: metadata.data_meta || null,
    guide,
    sessions: sessions.sort((first, second) => first.date.localeCompare(second.date)),
  });
}
