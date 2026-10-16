/**
 * AutoShine — Hero Section Script
 * Проявляет фон после успешной загрузки hero.jpg
 */

(function () {
  'use strict';

  const heroBg = document.querySelector('.hero__bg');
  if (!heroBg) return;

  const imgPath = 'images/hero.jpg';
  const probe = new Image();

  const reveal = function () {
    heroBg.classList.add('hero__bg--loaded');
  };

  // Таймаут-подстраховка: если картинка долго не грузится —
  // проявляем фон всё равно (сработает CSS-градиент)
  const safety = setTimeout(reveal, 3000);

  probe.onload = function () {
    clearTimeout(safety);
    reveal();
  };

  probe.onerror = function () {
    clearTimeout(safety);
    reveal();
    console.warn(
      'AutoShine: images/hero.jpg не найден. ' +
      'Показывается резервный градиент. ' +
      'Проверьте путь: images/hero.jpg (регистр и расширение важны).'
    );
  };

  probe.src = imgPath;
})();

/**
 * AutoShine — Before/After Compare
 * Управляет положением разделителя через CSS-переменную --pos.
 * Ползунок меняет видимую область верхнего изображения (clip-path),
 * а не просто двигает линию поверх неподвижных картинок.
 */

(function () {
  'use strict';

  const compare = document.querySelector('.compare');
  if (!compare) return;

  const viewport = compare.querySelector('.compare__viewport');
  const range = compare.querySelector('.compare__range');
  const beforeImg = compare.querySelector('.compare__image--before');
  const afterImg = compare.querySelector('.compare__image--after');

  if (!viewport || !range) return;

  /* ------------------------------------------
     Синхронизация ползунка и CSS-переменной --pos
     ------------------------------------------ */
  const applyPosition = function (value) {
    // Ограничиваем 0…100 на случай ручного ввода
    const v = Math.max(0, Math.min(100, Number(value)));
    viewport.style.setProperty('--pos', v + '%');
  };

  // Инициализация из текущего значения input
  applyPosition(range.value);

  // Реакция на движение ползунка (мышь, тач, клавиатура)
  range.addEventListener('input', function () {
    applyPosition(range.value);
  });

  /* ------------------------------------------
     Показ картинок / заглушки
     Проверяем, что оба изображения реально загрузились.
     Если да — прячем заглушку. Если нет — оставляем.
     ------------------------------------------ */
  const checkImages = function () {
    const beforeOk = beforeImg && beforeImg.complete && beforeImg.naturalWidth > 0;
    const afterOk = afterImg && afterImg.complete && afterImg.naturalWidth > 0;

    if (beforeOk && afterOk) {
      compare.classList.add('compare--ready');
    } else {
      compare.classList.remove('compare--ready');
    }
  };

  // После загрузки страницы картинки могут быть ещё в процессе.
  // Слушаем события load/error у обеих.
  let pending = 2;
  const done = function () {
    pending -= 1;
    if (pending <= 0) checkImages();
  };

  if (beforeImg) {
    if (beforeImg.complete) {
      done();
    } else {
      beforeImg.addEventListener('load', done, { once: true });
      beforeImg.addEventListener('error', done, { once: true });
    }
  } else {
    pending -= 1;
  }

  if (afterImg) {
    if (afterImg.complete) {
      done();
    } else {
      afterImg.addEventListener('load', done, { once: true });
      afterImg.addEventListener('error', done, { once: true });
    }
  } else {
    pending -= 1;
  }

  // Проверка ещё раз через пару секунд — на случай кэша/отложенной загрузки
  if (pending > 0) {
    setTimeout(checkImages, 800);
  }

  /* ------------------------------------------
     Опционально: перетаскивание мышью/пальцем по картинке
     (не только по range-ползунку)
     ------------------------------------------ */
  const isDragging = { active: false };

  const setFromEvent = function (clientX) {
    const rect = viewport.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (clientX - rect.left) / rect.width;
    const value = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
    range.value = value;
    applyPosition(value);
  };

  const onPointerDown = function (event) {
    // Не перехватываем клики по самому range
    if (event.target === range) return;
    isDragging.active = true;
    setFromEvent(event.clientX);
    viewport.setPointerCapture && viewport.setPointerCapture(event.pointerId);
  };

  const onPointerMove = function (event) {
    if (!isDragging.active) return;
    setFromEvent(event.clientX);
  };

  const onPointerUp = function (event) {
    isDragging.active = false;
    viewport.releasePointerCapture && viewport.releasePointerCapture(event.pointerId);
  };

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);

  /* ------------------------------------------
     Клавиатура: уже работает нативно на input[type=range]
     (стрелки, Home, End, PageUp, PageDown) — ничего добавлять не нужно.
     ------------------------------------------ */
})();

/**
 * AutoShine — Booking Form
 * Клиентская валидация формы заявки.
 * НЕ отправляет данные на сервер, в Telegram или по почте.
 * НЕ сохраняет персональные данные в localStorage.
 * НЕ выводит персональные данные в console.
 */

(function () {
  'use strict';

  const form = document.getElementById('booking-form');
  if (!form) return;

  /* ------------------------------------------
     Ссылки на поля
     ------------------------------------------ */
  const fields = {
    name: {
      input: document.getElementById('booking-name'),
      error: document.getElementById('booking-name-error')
    },
    phone: {
      input: document.getElementById('booking-phone'),
      error: document.getElementById('booking-phone-error')
    },
    service: {
      input: document.getElementById('booking-service'),
      error: document.getElementById('booking-service-error')
    },
    comment: {
      input: document.getElementById('booking-comment'),
      error: document.getElementById('booking-comment-error')
    },
    consent: {
      input: document.getElementById('booking-consent'),
      error: document.getElementById('booking-consent-error')
    }
  };

  const submitBtn = document.getElementById('booking-submit');
  const submitLabel = submitBtn ? submitBtn.querySelector('.booking__submit-label') : null;
  const statusEl = document.getElementById('booking-status');

  // Флаг для защиты от повторных нажатий
  let isSubmitting = false;

  /* ------------------------------------------
     Утилиты
     ------------------------------------------ */

  // Показать ошибку у поля
  const showError = function (field, message) {
    if (!field.input || !field.error) return;
    field.error.textContent = message;
    field.error.hidden = false;
    field.input.setAttribute('aria-invalid', 'true');
  };

  // Скрыть ошибку у поля
  const clearError = function (field) {
    if (!field.input || !field.error) return;
    field.error.textContent = '';
    field.error.hidden = true;
    field.input.removeAttribute('aria-invalid');
  };

  // Глобальный статус
  const setStatus = function (message, isSuccess) {
    if (!statusEl) return;
    if (!message) {
      statusEl.textContent = '';
      statusEl.hidden = true;
      statusEl.classList.remove('booking__status--success');
      return;
    }
    statusEl.textContent = message;
    statusEl.hidden = false;
    if (isSuccess) {
      statusEl.classList.add('booking__status--success');
    } else {
      statusEl.classList.remove('booking__status--success');
    }
  };

  /* ------------------------------------------
     Валидаторы
     ------------------------------------------ */

  // Имя: trim, минимум 2 символа
  const validateName = function (value) {
    const v = (value || '').trim();
    if (v.length === 0) {
      return { valid: false, message: 'Укажите имя' };
    }
    if (v.length < 2) {
      return { valid: false, message: 'Имя должно содержать минимум 2 символа' };
    }
    return { valid: true, message: '' };
  };

  // Телефон: от 10 до 15 цифр после очистки.
  // Допускаются +, пробелы, скобки, дефисы.
  // НЕ привязан к операторам связи.
  const validatePhone = function (value) {
    const raw = (value || '').trim();
    if (raw.length === 0) {
      return { valid: false, message: 'Укажите телефон' };
    }

    // Проверяем допустимые символы: цифры, +, пробел, (, ), -
    const allowed = /^[0-9+\s()\-]+$/;
    if (!allowed.test(raw)) {
      return {
        valid: false,
        message: 'Телефон может содержать только цифры, +, пробелы, скобки и дефисы'
      };
    }

    // Считаем цифры
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      return {
        valid: false,
        message: 'Введите корректный номер: от 10 до 15 цифр'
      };
    }

    return { valid: true, message: '' };
  };

  // Услуга: выбрано непустое значение
  const validateService = function (value) {
    if (!value) {
      return { valid: false, message: 'Выберите услугу' };
    }
    return { valid: true, message: '' };
  };

  // Комментарий: необязательный, но если заполнен — до 500 символов
  const validateComment = function (value) {
    const v = value || '';
    if (v.length > 500) {
      return {
        valid: false,
        message: 'Комментарий не должен превышать 500 символов'
      };
    }
    return { valid: true, message: '' };
  };

  // Согласие: checkbox отмечен
  const validateConsent = function (checked) {
    if (!checked) {
      return {
        valid: false,
        message: 'Необходимо согласие на обработку персональных данных'
      };
    }
    return { valid: true, message: '' };
  };

  /* ------------------------------------------
     Валидация одного поля по имени
     ------------------------------------------ */
  const validators = {
    name: function () { return validateName(fields.name.input.value); },
    phone: function () { return validatePhone(fields.phone.input.value); },
    service: function () { return validateService(fields.service.input.value); },
    comment: function () { return validateComment(fields.comment.input.value); },
    consent: function () { return validateConsent(fields.consent.input.checked); }
  };

  const validateField = function (name) {
    const result = validators[name]();
    const field = fields[name];
    if (!result.valid) {
      showError(field, result.message);
    } else {
      clearError(field);
    }
    return result.valid;
  };

  /* ------------------------------------------
     Валидация всей формы
     Возвращает имя первого невалидного поля или null
     ------------------------------------------ */
  const validateForm = function () {
    const order = ['name', 'phone', 'service', 'comment', 'consent'];
    let firstInvalid = null;

    order.forEach(function (name) {
      const ok = validateField(name);
      if (!ok && !firstInvalid) {
        firstInvalid = name;
      }
    });

    return firstInvalid;
  };

  /* ------------------------------------------
     Подсветка ошибок «на лету»
     Валидируем после blur и при input, если поле уже было невалидным
     ------------------------------------------ */

  // Список полей, которые пользователь уже «трогал»
  const touched = {};

  const fieldNames = ['name', 'phone', 'service', 'comment', 'consent'];

  fieldNames.forEach(function (name) {
    const field = fields[name];
    if (!field.input) return;

    // blur — первая валидация
    field.input.addEventListener('blur', function () {
      touched[name] = true;
      validateField(name);
    });

    // input/change — перепроверка, только если поле уже touched или было с ошибкой
    const eventName = (name === 'service' || name === 'consent') ? 'change' : 'input';
    field.input.addEventListener(eventName, function () {
      if (touched[name] || field.input.getAttribute('aria-invalid') === 'true') {
        validateField(name);
      }
    });
  });

  /* ------------------------------------------
     Отправка формы
     ------------------------------------------ */

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (isSubmitting) return;

    setStatus('', false);

    const firstInvalid = validateForm();

    if (firstInvalid) {
      const field = fields[firstInvalid];
      if (field.input) {
        field.input.focus();
        field.input.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
      return;
    }

    // Получаем токен проверки Cloudflare Turnstile
    const tokenInput = form.querySelector(
      '[name="cf-turnstile-response"]'
    );
    const turnstileToken = tokenInput?.value || '';

    if (!turnstileToken) {
      setStatus(
        'Дождитесь завершения проверки Cloudflare.',
        false
      );
      return;
    }

    isSubmitting = true;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
    }

    if (submitLabel) {
      submitLabel.textContent = 'Отправляем…';
    }

    form.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(
        'https://autoshine-api.global-reboot-official.workers.dev/api/booking',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: fields.name.input.value.trim(),
            phone: fields.phone.input.value.trim(),
            service: fields.service.input.value,
            comment: fields.comment.input.value.trim(),
            consent: fields.consent.input.checked,
            turnstileToken: turnstileToken
          }),
          signal: AbortSignal.timeout(15000)
        }
      );

      const result = await response.json();

      if (response.status === 429) {
        throw new Error(
          'Слишком много попыток отправки. Подождите минуту и попробуйте снова.'
        );
      }

      if (!response.ok || result.success !== true) {
        if (result.error === 'Turnstile verification failed') {
          throw new Error(
            'Проверка Cloudflare не пройдена. Повторите её.'
          );
        }

        if (result.error === 'Validation failed') {
          throw new Error(
            'Проверьте правильность заполнения формы.'
          );
        }

        throw new Error(
          'Не удалось отправить заявку. Попробуйте позже.'
        );
      }

      setStatus(
        'Заявка успешно отправлена! Мы свяжемся с вами.',
        true
      );

      form.reset();

      fieldNames.forEach(function (name) {
        touched[name] = false;
        clearError(fields[name]);
      });

      if (statusEl) {
        statusEl.setAttribute('tabindex', '-1');
        statusEl.focus();
      }

    } catch (error) {
      setStatus(
        error.message ||
          'Ошибка соединения. Попробуйте ещё раз.',
        false
      );

    } finally {
      // Токен Turnstile одноразовый:
      // после каждой попытки нужна новая проверка.
      if (window.turnstile) {
        const widget = form.querySelector('.cf-turnstile');
        if (widget) {
          window.turnstile.reset(widget);
        }
      }

      isSubmitting = false;

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
      }

      if (submitLabel) {
        submitLabel.textContent = 'Отправить заявку';
      }

      form.removeAttribute('aria-busy');
    }
  });

  /* ------------------------------------------
     Начальная очистка — на случай, если страница
     была перезагружена с сохранёнными значениями
     (браузер может восстановить форму F5-ем)
     ------------------------------------------ */
  fieldNames.forEach(function (name) {
    clearError(fields[name]);
  });
})();

/** Мобильная навигация AutoShine */
(function () {
  'use strict';
  const button = document.querySelector('.header__menu-toggle');
  const nav = document.getElementById('main-nav');
  if (!button || !nav) return;

  function closeMenu() {
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Открыть меню');
    nav.classList.remove('header__nav--open');
  }

  button.addEventListener('click', function () {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    nav.classList.toggle('header__nav--open', open);
  });
  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
  });
  document.addEventListener('click', function (event) {
    if (!nav.contains(event.target) && !button.contains(event.target)) closeMenu();
  });
  const media = window.matchMedia('(min-width: 769px)');
  if (media.addEventListener) media.addEventListener('change', closeMenu);
})();
