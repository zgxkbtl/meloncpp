// Token comparison follows the common practice-contest convention. Strict mode
// compares every character except CRLF is treated as LF on both sides.
export function compareOutput(actual, expected, mode = 'tokens') {
  const a = actual.replace(/\r\n/g, '\n');
  const b = expected.replace(/\r\n/g, '\n');
  if (mode === 'strict') return { pass: a === b, detail: a === b ? '输出完全一致' : '字符、空格或换行不一致' };
  const tokens = s => s.trim() ? s.trim().split(/\s+/u) : [];
  const left = tokens(a), right = tokens(b);
  const i = left.findIndex((token, i) => token !== right[i]);
  const mismatch = i === -1 && left.length !== right.length ? Math.min(left.length, right.length) : i;
  return { pass: mismatch === -1, detail: mismatch === -1 ? '忽略空白后，输出一致' : `第 ${mismatch + 1} 项不同：期望 ${right[mismatch] ?? '〈结束〉'}，实际 ${left[mismatch] ?? '〈结束〉'}` };
}
