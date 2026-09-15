const NAME_PATTERN = /^[\p{L}\p{N} _-]+$/u

function validateName(value) {
  const name = value.trim()

  if (!name) {
    return 'Введите имя.'
  }

  if (name.length > 30) {
    return 'Имя должно быть не длиннее 30 символов.'
  }

  if (!NAME_PATTERN.test(name)) {
    return 'Используйте буквы, цифры, пробел, дефис или подчёркивание.'
  }

  return ''
}

export { validateName }
