export const HEADERS = [
  'algorithm', 'any', 'array', 'bit', 'bitset', 'cassert', 'cctype', 'cerrno', 'cfloat',
  'charconv', 'chrono', 'climits', 'cmath', 'complex', 'cstddef', 'cstdint', 'cstdio',
  'cstdlib', 'cstring', 'ctime', 'deque', 'exception', 'forward_list', 'functional',
  'iomanip', 'ios', 'iostream', 'iterator', 'limits', 'list', 'map', 'memory',
  'memory_resource', 'new', 'numeric', 'optional', 'queue', 'random', 'ratio', 'regex',
  'scoped_allocator', 'set', 'sstream', 'stack', 'stdexcept', 'streambuf', 'string',
  'string_view', 'system_error', 'tuple', 'type_traits', 'typeindex', 'typeinfo',
  'unordered_map', 'unordered_set', 'utility', 'valarray', 'variant', 'vector'
];
export const BITS_HEADER = '#pragma once\n' + HEADERS.map(h => `#include <${h}>`).join('\n') + `
#if __cplusplus >= 202002L
#include <compare>
#include <concepts>
#include <coroutine>
#include <numbers>
#include <ranges>
#include <span>
#endif
`;
export const MAX_OUTPUT_BYTES = 1024 * 1024;
