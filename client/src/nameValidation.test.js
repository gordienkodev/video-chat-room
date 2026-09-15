import { describe, expect, it } from 'vitest'
import { validateName } from './nameValidation.js'

describe('validateName', () => {
  it('accepts trimmed russian names with allowed separators', () => {
    expect(validateName('  Анна-Мария_2  ')).toBe('')
  })

  it('rejects empty, too long, and html-like names', () => {
    expect(validateName('   ')).toBe('Введите имя.')
    expect(validateName('а'.repeat(31))).toBe('Имя должно быть не длиннее 30 символов.')
    expect(validateName('<script>alert(1)</script>')).toBe(
      'Используйте буквы, цифры, пробел, дефис или подчёркивание.',
    )
  })
})

