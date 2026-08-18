# 🚀 Deploy на Coolify - Инструкция

## Быстрый старт

### Вариант 1: Создать GitHub репо (рекомендуется)

```bash
# 1. Скопируй все файлы из /agent/ к себе на комп
# Или если работаешь в терминале:

cd /agent

# 2. Создай репо на GitHub (через веб-интерфейс)
# Назови например: california-handyman-landing

# 3. Подключи remote и запуш:
git remote add origin https://github.com/YOUR_USERNAME/california-handyman-landing.git
git branch -M main
git push -u origin main

# Готово! Репо создано
```

### Вариант 2: Быстрый deploy через Coolify

```bash
# Если Coolify поддерживает direct deploy:

# 1. Создай .zip архив
cd /agent
zip -r handyman-landing.zip .

# 2. Загрузи в Coolify через UI
```

---

## 📦 Что в проекте (готово к деплою):

```
/agent/
├── index.html              - Основной файл (точка входа)
├── styles.css              - Все стили
├── script.js               - Весь JS
├── preview.html            - Страница превью
├── robots.txt              - SEO
├── sitemap.xml             - SEO
├── .gitignore              - Git настройки
├── README.md               - Документация
├── MARKETING_GUIDE.md      - Гайд по рекламе
└── PROJECT_SUMMARY.md      - Описание проекта
```

**Размер:** ~140KB (супер легкий!)

---

## ⚙️ Настройка Coolify

### 1. Build Settings:

```yaml
# Это статический сайт, никакого build не нужно!
Build Command: (оставь пустым)
Install Command: (оставь пустым)
```

### 2. Deploy Settings:

```yaml
Framework: Static Site
Port: 80 (или любой)
Publish Directory: . (корень проекта)
```

### 3. Environment Variables (опционально):

Если будешь добавлять backend для форм:
```bash
API_ENDPOINT=https://your-api.com/submit
GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX
FACEBOOK_PIXEL_ID=XXXXXXXXXXXXXXX
```

---

## 🌐 После деплоя

### Обязательные изменения:

1. **Замени контакты в index.html:**
   ```html
   Поиск: (888) 888-8888
   Замени на: твой реальный телефон (3 места)
   
   Поиск: info@californiahandyman.com
   Замени на: твой email
   ```

2. **Настрой tracking в script.js:**
   ```javascript
   // Строка ~52
   gtag('config', 'GA_MEASUREMENT_ID'); // → твой Google Analytics
   
   // Строка ~65
   fbq('init', 'YOUR_PIXEL_ID'); // → твой Facebook Pixel
   ```

3. **Настрой API для форм в script.js:**
   ```javascript
   // Строка ~166
   const API_ENDPOINT = '/api/submit-quote'; // → твой endpoint
   ```

### Опциональные улучшения:

4. **Добавь реальные изображения:**
   - Замени SVG placeholders
   - Добавь фото работ (до/после)
   - Логотип компании
   - Фото команды

5. **Custom Domain:**
   - Подключи свой домен в Coolify
   - Настрой SSL (Let's Encrypt)
   - Обнови sitemap.xml с новым доменом

---

## 🔧 Настройка форм

### Вариант 1: EmailJS (бесплатно, просто)

```javascript
// В script.js замени функцию submitToAPI:
emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", data)
  .then(() => console.log('Success!'));
```

### Вариант 2: Formspree (бесплатно)

```html
<!-- В index.html замени action формы: -->
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
```

### Вариант 3: Свой Backend

```javascript
// Уже готово в script.js, просто укажи свой API_ENDPOINT
const API_ENDPOINT = 'https://your-api.com/leads';
```

---

## 📊 После запуска

### 1. Проверь что работает:

- [ ] Страница открывается
- [ ] Все стили загружены
- [ ] Формы работают
- [ ] Телефоны кликабельны (на мобилке)
- [ ] Анимации плавные
- [ ] Мобильная версия ОК

### 2. Проверь производительность:

```bash
# Google PageSpeed Insights
https://pagespeed.web.dev/

# Должно быть:
Performance: > 90
Accessibility: > 95
Best Practices: > 90
SEO: > 95
```

### 3. Настрой мониторинг:

- Google Analytics (отслеживание визитов)
- Google Search Console (SEO)
- Uptime monitoring (например UptimeRobot)

---

## 🚀 Запуск рекламы

После деплоя:

### Google Ads:
1. Создай аккаунт Google Ads
2. Настрой конверсию (форма submit)
3. Запусти Search кампанию:
   - Keywords: "handyman California", "emergency handyman"
   - Budget: $50-70/день
   - Location: California

### Facebook Ads:
1. Создай Facebook Pixel
2. Добавь Pixel ID в код
3. Запусти Lead Generation:
   - Audience: Homeowners 30-65 в CA
   - Budget: $30/день
   - Creative: До/После фото

**Детали в MARKETING_GUIDE.md!**

---

## 🐛 Troubleshooting

### Формы не отправляются?
→ Проверь API_ENDPOINT в script.js  
→ Смотри console в браузере (F12)

### Стили сломаны?
→ Проверь что styles.css загружается  
→ Проверь пути к файлам

### Медленная загрузка?
→ Оптимизируй изображения (WebP формат)  
→ Включи CDN в Coolify  
→ Включи gzip compression

---

## 📞 Support Checklist

После деплоя настрой:

- [ ] Автоответчик на формы
- [ ] SMS уведомления о лидах
- [ ] CRM интеграция (HubSpot/Pipedrive)
- [ ] Call tracking (CallRail)
- [ ] Email автоматизация
- [ ] Backup системы

---

## 🎯 Success Metrics

**Week 1:**
- 500-1000 visitors
- 10-20 leads
- Bounce rate < 60%

**Month 1:**
- 2000-3000 visitors  
- 50-100 leads
- CPL < $50

**Month 3:**
- 5000+ visitors
- 150-200 leads
- ROAS > 3:1

---

## 💡 Pro Tips для Coolify

1. **Включи auto-deploy**
   - Push на main → автоматический deploy

2. **Настрой preview deployments**
   - Каждый PR = preview URL

3. **Добавь healthcheck**
   ```yaml
   healthcheck:
     path: /
     interval: 30s
   ```

4. **Включи caching**
   - Кэш статических файлов на 1 год
   - HTML на 1 час

5. **Настрой redirects (если нужно)**
   ```
   /old-page → /new-page (301)
   ```

---

## 🎊 Готово к запуску!

После деплоя на Coolify у тебя будет:

✅ Быстрый премиум лендинг  
✅ SSL сертификат  
✅ Автоматический deploy  
✅ Готовность к рекламе  

**Время привлекать клиентов!** 🚀

---

**Need help?** Все файлы в `/agent/`  
**Questions?** Смотри README.md и MARKETING_GUIDE.md  

*Good luck with your handyman business!* 🛠️
